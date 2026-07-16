import {
    getCurrentUser,
    getItemsByUser,
    snapshotAccountBalances,
} from '@/lib/db';
import { syncItemHoldings } from '@/lib/plaid_sync';

// Daily cron target (see vercel.json): snapshots each account's current
// balance so net worth history survives Account.currentBalance being
// overwritten in place on every Plaid sync, and refreshes investment holdings.
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const user = await getCurrentUser();
        await snapshotAccountBalances(user.id);

        // Reconcile holdings per item. Each is isolated so one item's failure
        // doesn't abort the rest; syncItemHoldings is a no-op for
        // non-investment / non-consented items.
        const items = await getItemsByUser(user.id);
        await Promise.all(
            items.map((item) =>
                syncItemHoldings(item).catch((e) =>
                    console.error('Holdings sync failed', {
                        itemId: item.id,
                        error: e,
                    })
                )
            )
        );
    } catch (e) {
        console.error('Net worth snapshot failed', e);
        return Response.json(
            { error: 'Failed to snapshot net worth' },
            { status: 500 }
        );
    }

    return Response.json({ ok: true });
}
