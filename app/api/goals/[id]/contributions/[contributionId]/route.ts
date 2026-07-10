import { getCurrentUser, deleteGoalContribution } from '@/lib/db';

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string; contributionId: string }> }
) {
    const { id, contributionId } = await params;

    try {
        const user = await getCurrentUser();
        const count = await deleteGoalContribution(contributionId, id, user.id);
        if (count === 0) {
            return Response.json(
                { error: 'Contribution not found' },
                { status: 404 }
            );
        }

        return Response.json({ ok: true }, { status: 200 });
    } catch (e) {
        console.error('Error deleting goal contribution', e);
        return Response.json(
            { error: 'Error deleting goal contribution' },
            { status: 500 }
        );
    }
}
