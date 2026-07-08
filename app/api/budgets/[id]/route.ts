import { getCurrentUser, deleteBudget } from '@/lib/db';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const user = await getCurrentUser();
        const count = await deleteBudget(id, user.id);
        if (count === 0) {
            return Response.json({ error: 'Budget not found' }, { status: 404 });
        }

        return Response.json({ ok: true }, { status: 200 });
    } catch (e) {
        console.error('Error deleting budget', e);
        return Response.json({ error: 'Error deleting budget' }, { status: 500 });
    }
}
