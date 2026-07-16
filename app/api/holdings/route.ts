import { getCurrentUser, getHoldingsByUser } from '@/lib/db';

export async function GET() {
    try {
        const user = await getCurrentUser();
        const holdings = await getHoldingsByUser(user.id);

        return Response.json({ holdings }, { status: 200 });
    } catch (e) {
        console.error('Error fetching holdings', e);
        return Response.json(
            { error: 'Error fetching holdings' },
            { status: 500 }
        );
    }
}
