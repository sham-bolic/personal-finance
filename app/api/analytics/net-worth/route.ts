import { getCurrentUser, getNetWorth } from '@/lib/db';

export async function GET() {
    try {
        const user = await getCurrentUser();
        const netWorth = await getNetWorth(user.id);

        return Response.json({ net_worth: netWorth }, { status: 200 });
    } catch (e) {
        console.error('Error fetching net worth', e);
        return Response.json(
            { error: 'Error fetching net worth' },
            { status: 500 }
        );
    }
}
