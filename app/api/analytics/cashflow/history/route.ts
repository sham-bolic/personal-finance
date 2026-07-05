import { getCurrentUser, getCashFlowHistory } from '@/lib/db';
import type { CashFlowHistoryOpts } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const params: CashFlowHistoryOpts = {
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
        accountId: searchParams.get('accountId') ?? undefined,
    };

    try {
        const user = await getCurrentUser();
        const history = await getCashFlowHistory(user.id, params);

        return Response.json({ cash_flow_history: history }, { status: 200 });
    } catch (e) {
        console.error('Error fetching cash flow history', e);
        return Response.json(
            { error: 'Error fetching cash flow history' },
            { status: 500 }
        );
    }
}
