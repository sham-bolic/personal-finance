import { getCurrentUser, getCashFlowSummary } from '@/lib/db';
import type { CashFlowOpts } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const params: CashFlowOpts = {
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
        accountId: searchParams.get('accountId') ?? undefined,
    };

    try {
        const user = await getCurrentUser();
        const summary = await getCashFlowSummary(user.id, params);

        return Response.json({ cash_flow: summary }, { status: 200 });
    } catch (e) {
        console.error('Error fetching cash flow summary', e);
        return Response.json(
            { error: 'Error fetching cash flow summary' },
            { status: 500 }
        );
    }
}
