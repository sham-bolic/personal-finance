import { after } from 'next/server';
import type { PlaidItem } from '@/generated/prisma/client';
import { decrypt } from '@/lib/crypto';
import {
    deleteTransactions,
    getAccountsByItem,
    getCurrentUser,
    getItemsByUser,
    TransactionInput,
    updateSyncCursor,
    upsertTransactions,
} from '@/lib/db';
import { client } from '@/lib/plaid_client';

type AccountMap = Map<string, string>; // plaidAccountId -> internal Account.id

// Process a single transactionsSync page: persist added/modified/removed and
// advance the stored cursor. Returns where the sync stands afterward.
async function syncPage(
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
                    `(no matching Account row — accounts may be out of date, re-link or refresh accounts)`
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

// Sync the remaining pages after the first — runs in the background via after().
async function syncRemainingPages(
    itemId: string,
    accessToken: string,
    accountIdByPlaidId: AccountMap,
    cursor: string
): Promise<void> {
    let hasMore = true;
    while (hasMore) {
        const result = await syncPage(
            itemId,
            accessToken,
            accountIdByPlaidId,
            cursor
        );
        cursor = result.nextCursor;
        hasMore = result.hasMore;
    }
}

// Sync a single item: first page synchronously, rest in the background.
async function syncItem(item: PlaidItem): Promise<void> {
    const accessToken = decrypt(item.accessToken);
    const accounts = await getAccountsByItem(item.id);
    const accountIdByPlaidId: AccountMap = new Map(
        accounts.map((account) => [account.plaidAccountId, account.id])
    );

    // First page synchronously so the response reflects fresh data.
    const { nextCursor, hasMore } = await syncPage(
        item.id,
        accessToken,
        accountIdByPlaidId,
        item.syncCursor ?? undefined
    );

    if (!hasMore) return;

    // Remaining pages continue in the background after the response.
    after(
        syncRemainingPages(
            item.id,
            accessToken,
            accountIdByPlaidId,
            nextCursor
        ).catch((e) =>
            console.error('Background sync failed', {
                itemId: item.id,
                error: e,
            })
        )
    );
}

export async function POST() {
    try {
        const user = await getCurrentUser();
        const items = await getItemsByUser(user.id);
        await Promise.all(items.map(syncItem));
    } catch (e) {
        console.error('Sync failed', e);
        return Response.json(
            { error: 'Failed to sync transactions' },
            { status: 500 }
        );
    }

    return Response.json({ ok: true });
}
