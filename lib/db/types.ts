// Input shapes for the data-access layer. External API responses (Plaid) are
// mapped into the write-side shapes at the route boundary, so lib/db stays
// decoupled from any SDK's wire format. Read-side query/filter shapes live here
// too, so consumers import all lib/db types from one place.

export type PlaidItemInput = {
    userId: string;
    plaidItemId: string; // Plaid's item_id
    accessToken: string; // encrypted before storage in upsertPlaidItem
    institutionId?: string;
    institutionName?: string;
};

export type AccountInput = {
    plaidAccountId: string; // Plaid's account_id
    name: string;
    officialName?: string;
    mask?: string;
    type: string; // depository | credit | loan | investment
    subtype?: string;
    currentBalance?: number;
    availableBalance?: number;
    isoCurrencyCode?: string;
};

export type TransactionInput = {
    plaidTransactionId: string; // Plaid's transaction_id (upsert key)
    accountId: string; // your internal Account.id (not Plaid's account_id)
    amount: number;
    date: string; // 'YYYY-MM-DD'
    name: string;
    isoCurrencyCode?: string;
    authorizedDate?: string;
    merchantName?: string;
    pfcPrimary?: string;
    pfcDetailed?: string;
    pending: boolean;
    pendingTransactionId?: string;
    paymentChannel?: string;
};

// Read-side filters + pagination for listTransactions.
export type ListTransactionsOpts = {
    from?: string; // 'YYYY-MM-DD' inclusive lower bound
    to?: string; // 'YYYY-MM-DD' inclusive upper bound
    accountId?: string;
    take?: number;
    cursor?: string; // last Transaction.id from the previous page
};
