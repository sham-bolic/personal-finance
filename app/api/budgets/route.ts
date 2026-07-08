import { getCurrentUser, getBudgetProgress, upsertBudget } from '@/lib/db';
import { PlaidPrimaryCategory } from '@/generated/prisma/client';

function currentMonth(): string {
    return new Date().toISOString().slice(0, 7);
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') ?? currentMonth();

    try {
        const user = await getCurrentUser();
        const budgets = await getBudgetProgress(user.id, month);

        return Response.json({ budgets }, { status: 200 });
    } catch (e) {
        console.error('Error fetching budgets', e);
        return Response.json({ error: 'Error fetching budgets' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const body = await request.json();
    const { category, monthlyAmount, effectiveFrom } = body;

    if (!Object.values(PlaidPrimaryCategory).includes(category)) {
        return Response.json({ error: 'Invalid category' }, { status: 400 });
    }
    if (typeof monthlyAmount !== 'number' || monthlyAmount <= 0) {
        return Response.json({ error: 'monthlyAmount must be a positive number' }, { status: 400 });
    }

    try {
        const user = await getCurrentUser();
        const budget = await upsertBudget({
            userId: user.id,
            category,
            monthlyAmount,
            effectiveFrom,
        });

        return Response.json({ budget }, { status: 201 });
    } catch (e) {
        console.error('Error creating budget', e);
        return Response.json({ error: 'Error creating budget' }, { status: 500 });
    }
}
