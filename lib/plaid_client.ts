import { Configuration, PlaidApi, PlaidEnvironments, Products } from 'plaid';

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
