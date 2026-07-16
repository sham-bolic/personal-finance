import { getAllUsers, getItemsByUser, snapshotAccountBalances } from '@/lib/db';
import { syncItemHoldings } from '@/lib/plaid_sync';

// Daily cron target (see vercel.json): for every user, snapshots each account's
// current balance so net worth history survives Account.currentBalance being
// overwritten in place on every Plaid sync, and refreshes investment holdings.
// Authorized by CRON_SECRET, not a session - so it processes all users, not a
// single caller.
export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');

    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const users = await getAllUsers();

        // Each user is isolated so one user's failure doesn't abort the rest.
        await Promise.all(users.map((user) => syncUser(user.id)));
    } catch (e) {
        console.error('Daily sync failed', e);
        return Response.json(
            { error: 'Failed to run daily sync' },
            {
                status: 500,
            }
        );
    }

    return Response.json({ ok: true });
}

async function syncUser(userId: string): Promise<void> {
    try {
        await snapshotAccountBalances(userId);

        // Reconcile holdings per item. Each is isolated so one item's failure
        // doesn't abort the rest; syncItemHoldings is a no-op for
        // non-investment / non-consented items.
        const items = await getItemsByUser(userId);
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
        console.error('Daily sync failed for user', { userId, error: e });
    }
}
