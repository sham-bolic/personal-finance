import { getCurrentUser, getPortfolioValueHistory } from '@/lib/db';
import type { PortfolioValueHistoryOpts } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const params: PortfolioValueHistoryOpts = {
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
    };

    try {
        const user = await getCurrentUser();
        const history = await getPortfolioValueHistory(user.id, params);

        return Response.json(
            { portfolio_value_history: history },
            {
                status: 200,
            }
        );
    } catch (e) {
        console.error('Error fetching portfolio value history', e);
        return Response.json(
            { error: 'Error fetching portfolio value history' },
            { status: 500 }
        );
    }
}
