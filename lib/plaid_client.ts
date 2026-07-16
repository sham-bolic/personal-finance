import {
    Configuration,
    PlaidApi,
    PlaidEnvironments,
    Products,
    CountryCode,
} from 'plaid';

const PLAID_ENV = process.env.PLAID_ENV || 'sandbox';
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID || '';
const PLAID_SECRET = process.env.PLAID_SECRET || '';

if (!PLAID_CLIENT_ID || !PLAID_SECRET)
    throw new Error(
        'Error creating Plaid client due to missing ENV varaibles, check PLAID_CLIENT_ID or PLAID_SECRET'
    );

const configuration = new Configuration({
    basePath: PlaidEnvironments[PLAID_ENV],
    baseOptions: {
        headers: {
            'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
            'PLAID-SECRET': PLAID_SECRET,
            'PLAID-VERSION': '2020-09-14',
        },
    },
});

export const client = new PlaidApi(configuration);

// Shown to users inside Plaid Link. Kept here so every linkTokenCreate call
// (new link and update-mode reconnect) uses one consistent name.
export const PLAID_CLIENT_NAME = 'My Finances';

// Products for which we collect consent but do not require at link time, so
// plain checking-only banks still link while brokerages grant them. Consent is
// requested both at initial link and via the update-mode reconnect flow. Not
// billed until the corresponding endpoints are actually called.
export const ADDITIONAL_CONSENTED_PRODUCTS = [Products.Investments];

/**
 * Resolve the human-readable institution name (and id) for an item from its
 * access token. Best-effort: returns an empty object if the item has no
 * institution (some sandbox items) or the lookup fails, so a naming hiccup
 * never blocks linking.
 */
export async function fetchInstitutionForItem(
    accessToken: string
): Promise<{ institutionId?: string; institutionName?: string }> {
    try {
        const itemRes = await client.itemGet({ access_token: accessToken });
        const institutionId = itemRes.data.item.institution_id ?? undefined;
        if (!institutionId) return {};

        const instRes = await client.institutionsGetById({
            institution_id: institutionId,
            country_codes: [CountryCode.Us],
        });
        return {
            institutionId,
            institutionName: instRes.data.institution.name,
        };
    } catch (e) {
        console.error('Failed to resolve institution for item', e);
        return {};
    }
}
