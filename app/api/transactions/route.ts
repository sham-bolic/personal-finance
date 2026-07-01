import { getCurrentUser, listTransactions } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const user = await getCurrentUser();

    const params = {
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
        acountId: searchParams.get('accountId') ?? undefined,
        take: Number(searchParams.get('take') ?? 50),
        cursor: searchParams.get('cursor') ?? undefined,
    };

    try {
        const transactions = await listTransactions(user.id, params);

        return Response.json(
            { transaction_data: transactions },
            { status: 200 }
        );
    } catch (e) {
        console.error('Error fetching user transaction data', e);
        return Response.json(
            { error: 'Error fetching user transaction data' },
            { status: 500 }
        );
    }
}
