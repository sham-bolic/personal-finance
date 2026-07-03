import { after } from 'next/server';
import type { PlaidItem } from '@/generated/prisma/client';
import { getCurrentUser, getItemsByUser, snapshotAccountBalances } from '@/lib/db';
import { syncItemAllPages, syncItemFirstPage } from '@/lib/plaid_sync';

// Sync a single item: first page synchronously, rest in the background.
async function syncItem(item: PlaidItem): Promise<void> {
    const { accessToken, accountIdByPlaidId, nextCursor, hasMore } =
        await syncItemFirstPage(item);

    if (!hasMore) return;

    // Remaining pages continue in the background after the response.
    after(
        syncItemAllPages(
            item,
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

// Daily cron target (see vercel.json): snapshots each account's current
// balance so net worth history survives Account.currentBalance being
// overwritten in place on every Plaid sync.
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await getCurrentUser();
        await snapshotAccountBalances(user.id);
    } catch (e) {
        console.error('Net worth snapshot failed', e);
        return Response.json(
            { error: 'Failed to snapshot net worth' },
            { status: 500 }
        );
    }

    return Response.json({ ok: true });
}
