import { getCurrentUser, getGoalWithProgress, updateGoal, deleteGoal } from '@/lib/db';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const user = await getCurrentUser();
        const goal = await getGoalWithProgress(id, user.id);
        if (!goal) {
            return Response.json({ error: 'Goal not found' }, { status: 404 });
        }

        return Response.json({ goal }, { status: 200 });
    } catch (e) {
        console.error('Error fetching goal', e);
        return Response.json({ error: 'Error fetching goal' }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const body = await request.json();

    try {
        const user = await getCurrentUser();
        const goal = await updateGoal(id, user.id, body);

        return Response.json({ goal }, { status: 200 });
    } catch (e) {
        if (e instanceof Error && e.message === 'Goal not found') {
            return Response.json({ error: 'Goal not found' }, { status: 404 });
        }
        console.error('Error updating goal', e);
        return Response.json({ error: 'Error updating goal' }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const user = await getCurrentUser();
        const count = await deleteGoal(id, user.id);
        if (count === 0) {
            return Response.json({ error: 'Goal not found' }, { status: 404 });
        }

        return Response.json({ ok: true }, { status: 200 });
    } catch (e) {
        console.error('Error deleting goal', e);
        return Response.json({ error: 'Error deleting goal' }, { status: 500 });
    }
}
