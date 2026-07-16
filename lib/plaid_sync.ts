import type { PlaidItem } from '@/generated/prisma/client';
import { decrypt } from '@/lib/crypto';
import {
    backfillAccountBalanceHistory,
    deleteTransactions,
    getAccountsByItem,
    HoldingInput,
    itemHasInvestmentAccount,
    reconcileHoldings,
    snapshotAccountBalances,
    SecurityInput,
    TransactionInput,
    updateSyncCursor,
    upsertTransactions,
} from '@/lib/db';
import { client } from '@/lib/plaid_client';

type AccountMap = Map<string, string>; // plaidAccountId -> internal Account.id

// Process a single transactionsSync page: persist added/modified/removed and
// advance the stored cursor. Returns where the sync stands afterward.
export async function syncPage(
    itemId: string,
    accessToken: string,
    accountIdByPlaidId: AccountMap,
    cursor: string | undefined
): Promise<{ nextCursor: string; hasMore: boolean }> {
    const { data } = await client.transactionsSync({
        access_token: accessToken,
        cursor,
    });

    const convertedTransactions: TransactionInput[] = [
        ...data.added,
        ...data.modified,
    ].map((transaction) => {
        const accountId = accountIdByPlaidId.get(transaction.account_id);
        if (!accountId) {
            throw new Error(
                `Sync failed for item ${itemId}: transaction ${transaction.transaction_id} ` +
                    `references unknown Plaid account_id ${transaction.account_id} ` +
                    `(no matching Account row - accounts may be out of date, re-link or refresh accounts)`
            );
        }

        return {
            plaidTransactionId: transaction.transaction_id,
            accountId,
            amount: transaction.amount,
            date: transaction.date,
            name: transaction.merchant_name ?? '',
            isoCurrencyCode: transaction.iso_currency_code ?? undefined,
            authorizedDate: transaction.authorized_date ?? undefined,
            merchantName: transaction.merchant_name ?? undefined,
            pfcPrimary:
                transaction.personal_finance_category?.primary ?? undefined,
            pfcDetailed:
                transaction.personal_finance_category?.detailed ?? undefined,
            pending: transaction.pending,
            pendingTransactionId:
                transaction.pending_transaction_id ?? undefined,
            paymentChannel: transaction.payment_channel ?? undefined,
        };
    });

    const removedIds = data.removed.map((r) => r.transaction_id!);

    await Promise.all([
        upsertTransactions(convertedTransactions),
        deleteTransactions(removedIds),
    ]);
    await updateSyncCursor(itemId, data.next_cursor);

    return { nextCursor: data.next_cursor, hasMore: data.has_more };
}

// Pages through transactionsSync until exhausted, starting from whatever
// cursor the item is already at. Used both for the remaining-pages
// background continuation and for a full from-scratch sync.
export async function syncItemAllPages(
    item: PlaidItem,
    accessToken: string,
    accountIdByPlaidId: AccountMap,
    cursor: string | undefined
): Promise<void> {
    let hasMore = true;
    while (hasMore) {
        const result = await syncPage(
            item.id,
            accessToken,
            accountIdByPlaidId,
            cursor
        );
        cursor = result.nextCursor;
        hasMore = result.hasMore;
    }
}

async function accountMapForItem(item: PlaidItem): Promise<AccountMap> {
    const accounts = await getAccountsByItem(item.id);
    return new Map(
        accounts.map((account) => [account.plaidAccountId, account.id])
    );
}

// Sync a single item: first page synchronously, rest in the background.
// Returns the first page's result so the caller can decide whether to
// continue in the background (see app/api/sync/route.ts's use of `after`).
export async function syncItemFirstPage(item: PlaidItem): Promise<{
    accessToken: string;
    accountIdByPlaidId: AccountMap;
    nextCursor: string;
    hasMore: boolean;
}> {
    const accessToken = decrypt(item.accessToken);
    const accountIdByPlaidId = await accountMapForItem(item);

    const { nextCursor, hasMore } = await syncPage(
        item.id,
        accessToken,
        accountIdByPlaidId,
        item.syncCursor ?? undefined
    );

    return { accessToken, accountIdByPlaidId, nextCursor, hasMore };
}

/**
 * Pull current investment holdings for an item and reconcile them into the DB
 * (upsert securities + holdings, delete sold positions). No-op unless the item
 * both granted Investments consent and actually has an investment-type account,
 * so checking-only items never trigger the (billed) investmentsHoldingsGet call.
 * Pass an already-decrypted token to avoid decrypting twice when the caller has
 * one on hand.
 */
export async function syncItemHoldings(
    item: PlaidItem,
    accessToken?: string
): Promise<void> {
    if (!item.investmentsConsented) return;
    if (!(await itemHasInvestmentAccount(item.id))) return;

    const token = accessToken ?? decrypt(item.accessToken);
    const { data } = await client.investmentsHoldingsGet({
        access_token: token,
    });

    const securities: SecurityInput[] = data.securities.map((security) => ({
        plaidSecurityId: security.security_id,
        tickerSymbol: security.ticker_symbol ?? undefined,
        type: security.type ?? undefined,
        name: security.name ?? undefined,
        closePrice: security.close_price ?? undefined,
        closePriceAsOf: security.close_price_as_of ?? undefined,
        isoCurrencyCode: security.iso_currency_code ?? undefined,
    }));

    const holdings: HoldingInput[] = data.holdings.map((holding) => ({
        plaidAccountId: holding.account_id,
        plaidSecurityId: holding.security_id,
        quantity: holding.quantity,
        marketValue: holding.institution_value,
        costBasis: holding.cost_basis ?? undefined,
        price: holding.institution_price,
        isoCurrencyCode: holding.iso_currency_code ?? undefined,
    }));

    await reconcileHoldings(item.id, securities, holdings);
}

/**
 * Full historical sync for a freshly-linked item, followed by deriving
 * balance history for each of its accounts from the now-synced transactions.
 * Meant to run in the background (via `after()`) right after linking, so the
 * net worth graph isn't a flat line starting the day the item was linked.
 */
export async function backfillNewItem(item: PlaidItem): Promise<void> {
    const accessToken = decrypt(item.accessToken);
    const accountIdByPlaidId = await accountMapForItem(item);

    await syncItemAllPages(
        item,
        accessToken,
        accountIdByPlaidId,
        item.syncCursor ?? undefined
    );

    await Promise.all(
        Array.from(accountIdByPlaidId.values()).map((accountId) =>
            backfillAccountBalanceHistory(accountId)
        )
    );

    // Guarantee a data point for today. The transaction-delta backfill above
    // reaches back from the newest *transaction* date, so it leaves no snapshot
    // for today when the newest transaction is older — and none at all for
    // investment accounts, which have no Transaction rows. Without this, the
    // portfolio chart (investment-only) would stay blank until the first daily
    // cron run. Idempotent: snapshots upsert on (accountId, date).
    await snapshotAccountBalances(item.userId);
}
