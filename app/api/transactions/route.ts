import { client } from '@/lib/plaid_client';
import { getAccessToken } from '@/lib/token_store';

export async function GET() {
    const access_token = getAccessToken();

    if (!access_token) {
        console.error('Missing access token');
        return Response.json(
            { error: 'Missing access token' },
            { status: 400 }
        );
    }

    try {
        const response = await client.transactionsSync({ access_token });

        return Response.json(
            { transaction_data: response.data },
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
