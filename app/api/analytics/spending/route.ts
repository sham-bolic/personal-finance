import { getCurrentUser, getTotalsByCategory } from '@/lib/db';
import type { CategoryTotalsOpts } from '@/lib/db';

function parseDirection(value: string | null): CategoryTotalsOpts['direction'] {
    return value === 'income' ? 'income' : 'spending';
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const params: CategoryTotalsOpts = {
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
        accountId: searchParams.get('accountId') ?? undefined,
        direction: parseDirection(searchParams.get('direction')),
    };

    try {
        const user = await getCurrentUser();
        const totals = await getTotalsByCategory(user.id, params);

        return Response.json({ category_totals: totals }, { status: 200 });
    } catch (e) {
        console.error('Error fetching spending by category', e);
        return Response.json(
            { error: 'Error fetching spending by category' },
            { status: 500 }
        );
    }
}
