import {
    client,
    PLAID_CLIENT_NAME,
    ADDITIONAL_CONSENTED_PRODUCTS,
} from '@/lib/plaid_client';
import { Products, CountryCode } from 'plaid';
import { getCurrentUser } from '@/lib/db';

export async function POST() {
    let user;
    try {
        user = await getCurrentUser();
    } catch {
        return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const config = {
        user: { client_user_id: user.id },
        client_name: PLAID_CLIENT_NAME,
        // Keep the required product set minimal so plain checking-only banks
        // still link. Investments is requested as additional consent only:
        // brokerages grant it, other institutions are unaffected.
        products: [Products.Transactions],
        additional_consented_products: ADDITIONAL_CONSENTED_PRODUCTS,
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
