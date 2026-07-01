import { getCurrentUser, listTransactions } from '@/lib/db';
import type { ListTransactionsOpts } from '@/lib/db';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    const params: ListTransactionsOpts = {
        from: searchParams.get('from') ?? undefined,
        to: searchParams.get('to') ?? undefined,
        accountId: searchParams.get('accountId') ?? undefined,
        take: Number(searchParams.get('take') ?? 50),
        cursor: searchParams.get('cursor') ?? undefined,
    };

    try {
        const user = await getCurrentUser();
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
