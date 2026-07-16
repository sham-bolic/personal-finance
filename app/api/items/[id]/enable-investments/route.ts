import { getCurrentUser, setInvestmentsConsented } from '@/lib/db';

/**
 * Mark an item as having granted Investments consent. Called by the client
 * after the Plaid update-mode Link flow completes successfully.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const user = await getCurrentUser();
        const count = await setInvestmentsConsented(user.id, id);
        if (count === 0) {
            return Response.json({ error: 'Item not found' }, { status: 404 });
        }

        return Response.json({ ok: true }, { status: 200 });
    } catch (e) {
        console.error('Error enabling investments consent', e);
        return Response.json(
            { error: 'Error enabling investments consent' },
            { status: 500 }
        );
    }
}
