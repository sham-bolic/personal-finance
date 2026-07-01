import { after } from 'next/server';
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
    ].map((transaction) => ({
        plaidTransactionId: transaction.transaction_id,
        accountId: accountIdByPlaidId.get(transaction.account_id)!,
        amount: transaction.amount,
        date: transaction.date,
        name: transaction.name,
        isoCurrencyCode: transaction.iso_currency_code ?? undefined,
        authorizedDate: transaction.authorized_date ?? undefined,
        merchantName: transaction.merchant_name ?? undefined,
        pfcPrimary: transaction.personal_finance_category?.primary ?? undefined,
        pfcDetailed:
            transaction.personal_finance_category?.detailed ?? undefined,
        pending: transaction.pending,
        pendingTransactionId: transaction.pending_transaction_id ?? undefined,
        paymentChannel: transaction.payment_channel ?? undefined,
    }));

    const removedIds = data.removed.map((r) => r.transaction_id!);

    await Promise.all([
        upsertTransactions(convertedTransactions),
        deleteTransactions(removedIds),
    ]);
    // persist per-page so background failures don't lose progress
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

export async function POST() {
    const user = await getCurrentUser();
    const items = await getItemsByUser(user.id);

    await Promise.all(
        items.map(async (item) => {
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

            // Remaining pages continue in the background after the response.
            if (hasMore) {
                after(
                    syncRemainingPages(
                        item.id,
                        accessToken,
                        accountIdByPlaidId,
                        nextCursor
                    )
                );
            }
        })
    );

    return Response.json({ ok: true });
}
