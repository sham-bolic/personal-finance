import { getCurrentUser, getNetWorthHistory } from '@/lib/db';
import type { NetWorthHistoryOpts } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const params: NetWorthHistoryOpts = {
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
    };

    try {
        const user = await getCurrentUser();
        const history = await getNetWorthHistory(user.id, params);

        return Response.json({ net_worth_history: history }, { status: 200 });
    } catch (e) {
        console.error('Error fetching net worth history', e);
        return Response.json(
            { error: 'Error fetching net worth history' },
            { status: 500 }
        );
    }
}
