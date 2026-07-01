import { client } from '@/lib/plaid_client';
import { AccountInput, getCurrentUser, linkPlaidItem } from '@/lib/db';

export async function POST(request: Request) {
    let public_token: string | undefined;

    try {
        ({ public_token } = await request.json());
    } catch {
        console.error('Invalid JSON body');
        return Response.json({ error: 'Invalid JSON body', status: 400 });
    }

    if (!public_token) {
        console.error('Missing public token');
        return Response.json(
            { error: 'Missing public token' },
            { status: 400 }
        );
    }

    let access_token: string, item_id: string;

    try {
        const { data } = await client.itemPublicTokenExchange({ public_token });

        access_token = data.access_token;
        item_id = data.item_id;
    } catch (e) {
        console.error('Error exchanging public token for access token', e);
        return Response.json(
            { error: 'Unable to exchange public token for access token' },
            { status: 500 }
        );
    }

    try {
        // user lookup and accountsGet are independent — run them concurrently.
        const [user, accountsRes] = await Promise.all([
            getCurrentUser(),
            client.accountsGet({ access_token }),
        ]);

        const accounts: AccountInput[] = accountsRes.data.accounts.map(
            (account) => ({
                plaidAccountId: account.account_id,
                name: account.name,
                officialName: account.official_name ?? undefined,
                mask: account.mask ?? undefined,
                type: String(account.type),
                subtype: account.subtype ?? undefined,
                currentBalance: account.balances.current ?? undefined,
                availableBalance: account.balances.available ?? undefined,
                isoCurrencyCode:
                    account.balances.iso_currency_code ?? undefined,
            })
        );

        const item = await linkPlaidItem({
            userId: user.id,
            plaidItemId: item_id,
            accessToken: access_token,
            accounts,
        });

        return Response.json({ itemId: item.plaidItemId }, { status: 200 });
    } catch (e) {
        // We already hold a valid access_token here; log enough to recover the
        // link if persistence failed (the public_token is single-use).
        console.error('Failed to persist linked item', { item_id, e });
        return Response.json(
            { error: 'Linked, but failed to save account data' },
            { status: 500 }
        );
    }
}
