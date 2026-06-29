import { client } from '@/lib/plaid_client';
import { setAccessToken } from '@/lib/token_store';

export async function POST(request: Request) {
    const { public_token } = await request.json();

    if (!public_token) {
        console.error('Missing public token');
        return Response.json(
            { error: 'Missing public token' },
            { status: 400 }
        );
    }

    try {
        const response = await client.itemPublicTokenExchange({ public_token });

        // TODO: make the access token persist to a backend
        setAccessToken(response.data.access_token);

        return Response.json({ status: 200 });
    } catch (e) {
        console.error('Error exchanging public token for access token', e);
        return Response.json(
            { error: 'Unable to exchange public token for access token' },
            { status: 500 }
        );
    }
}
