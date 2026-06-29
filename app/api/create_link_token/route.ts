import { client } from '@/lib/plaid_client';
import { Products, CountryCode } from 'plaid';

export async function POST() {
    const config = {
        // TODO implement real user_id identification
        user: { client_user_id: 'user_id' },
        client_name: 'My Finances',
        products: [Products.Transactions],
        country_codes: [CountryCode.Us],
        language: 'en',
    };

    try {
        const response = await client.linkTokenCreate(config);
        return Response.json(
            { link_token: response.data.link_token },
            { status: 200 }
        );
    } catch (e) {
        console.error('Error creating link token', e);
        return Response.json(
            { error: 'Unable to create link token' },
            { status: 500 }
        );
    }
}
