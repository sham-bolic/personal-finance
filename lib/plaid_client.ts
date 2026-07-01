import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

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
