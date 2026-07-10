import {
    getCurrentUser,
    getGoalById,
    listGoalContributions,
    addGoalContribution,
} from '@/lib/db';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const user = await getCurrentUser();
        const goal = await getGoalById(id, user.id);
        if (!goal) {
            return Response.json({ error: 'Goal not found' }, { status: 404 });
        }

        const contributions = await listGoalContributions(id, user.id);
        return Response.json({ contributions }, { status: 200 });
    } catch (e) {
        console.error('Error fetching goal contributions', e);
        return Response.json(
            { error: 'Error fetching goal contributions' },
            { status: 500 }
        );
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();
    const { amount, date, note } = body;

    if (typeof amount !== 'number' || amount <= 0) {
        return Response.json(
            { error: 'amount must be a positive number' },
            { status: 400 }
        );
    }

    try {
        const user = await getCurrentUser();
        const goal = await getGoalById(id, user.id);
        if (!goal) {
            return Response.json({ error: 'Goal not found' }, { status: 404 });
        }

        const contribution = await addGoalContribution({
            goalId: id,
            amount,
            date,
            note,
        });
        return Response.json({ contribution }, { status: 201 });
    } catch (e) {
        console.error('Error adding goal contribution', e);
        return Response.json(
            { error: 'Error adding goal contribution' },
            { status: 500 }
        );
    }
}
