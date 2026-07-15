import { getCurrentUser, snapshotAccountBalances } from '@/lib/db';

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
