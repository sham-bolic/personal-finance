import {
    client,
    PLAID_CLIENT_NAME,
    ADDITIONAL_CONSENTED_PRODUCTS,
} from '@/lib/plaid_client';
import { CountryCode } from 'plaid';
import { getCurrentUser, getItemById } from '@/lib/db';
import { decrypt } from '@/lib/crypto';

/**
 * Create a Plaid Link token in update mode for an existing item, requesting
 * Investments as additional consent. Launching Link with this token lets an
 * already-linked user opt in to Investments without re-linking - consent is
 * granted for the same item and access token stays valid.
 */
export async function POST(request: Request) {
    let itemId: string | undefined;
    try {
        ({ itemId } = await request.json());
    } catch {
        return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    if (!itemId) {
        return Response.json({ error: 'Missing itemId' }, { status: 400 });
    }

    let user;
    try {
        user = await getCurrentUser();
    } catch {
        return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const item = await getItemById(user.id, itemId);
    if (!item) {
        // Not-found and not-yours are indistinguishable on purpose.
        return Response.json({ error: 'Item not found' }, { status: 404 });
    }

    try {
        const response = await client.linkTokenCreate({
            user: { client_user_id: user.id },
            client_name: PLAID_CLIENT_NAME,
            // Update mode: omit `products`, pass the item's access_token. The
            // new consent goes in additional_consented_products.
            access_token: decrypt(item.accessToken),
            additional_consented_products: ADDITIONAL_CONSENTED_PRODUCTS,
            country_codes: [CountryCode.Us],
            language: 'en',
        });
        return Response.json(
            { link_token: response.data.link_token },
            { status: 200 }
        );
    } catch (e) {
        console.error('Error creating update-mode link token', e);
        return Response.json(
            { error: 'Unable to create link token' },
            { status: 500 }
        );
    }
}
