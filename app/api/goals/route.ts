import { getCurrentUser, getGoalsWithProgress, createGoal } from '@/lib/db';

export async function GET() {
    try {
        const user = await getCurrentUser();
        const goals = await getGoalsWithProgress(user.id);

        return Response.json({ goals }, { status: 200 });
    } catch (e) {
        console.error('Error fetching goals', e);
        return Response.json(
            { error: 'Error fetching goals' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const body = await request.json();
    const { name, targetAmount, targetDate } = body;

    if (typeof name !== 'string' || name.trim().length === 0) {
        return Response.json({ error: 'name is required' }, { status: 400 });
    }
    if (typeof targetAmount !== 'number' || targetAmount <= 0) {
        return Response.json(
            { error: 'targetAmount must be a positive number' },
            { status: 400 }
        );
    }

    try {
        const user = await getCurrentUser();
        const goal = await createGoal({
            userId: user.id,
            name,
            targetAmount,
            targetDate,
        });

        return Response.json({ goal }, { status: 201 });
    } catch (e) {
        console.error('Error creating goal', e);
        return Response.json({ error: 'Error creating goal' }, { status: 500 });
    }
}
