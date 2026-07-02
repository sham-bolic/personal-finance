import { getCurrentUser, getAccountsByUser } from '@/lib/db';

export async function GET() {
    try {
        const user = await getCurrentUser();
        const accounts = await getAccountsByUser(user.id);

        return Response.json({ accounts }, { status: 200 });
    } catch (e) {
        console.error('Error fetching accounts', e);
        return Response.json(
            { error: 'Error fetching accounts' },
            { status: 500 }
        );
    }
}
