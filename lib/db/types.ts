// Input shapes for the data-access layer. External API responses (Plaid) are
// mapped into the write-side shapes at the route boundary, so lib/db stays
// decoupled from any SDK's wire format. Read-side query/filter shapes live here
// too, so consumers import all lib/db types from one place.

import type { PlaidPrimaryCategory, Source } from '@/generated/prisma/client';

export type PlaidItemInput = {
    userId: string;
    plaidItemId: string; // Plaid's item_id
    accessToken: string; // encrypted before storage in upsertPlaidItem
    institutionId?: string;
    institutionName?: string;
    // Set true when Investments consent was requested for this item (at link
    // time, or after an update-mode reconnect). Defaults to false.
    investmentsConsented?: boolean;
};

// Read-side shape for the linked-institutions list surfaced to the client.
// Deliberately excludes the access token and other sensitive fields.
export type ItemDTO = {
    id: string;
    institutionName: string | null;
    investmentsConsented: boolean;
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

// Write-side shape for a security, mapped from Plaid's `securities` array. The
// db layer decides identity from these fields: tickerSymbol+type when a ticker
// is present, else plaidSecurityId. plaidSecurityId is also the linkage key
// tying a HoldingInput to its SecurityInput within a single sync.
export type SecurityInput = {
    plaidSecurityId: string; // Plaid's per-item security_id
    tickerSymbol?: string;
    type?: string; // Plaid security type; db layer defaults to 'unknown'
    name?: string;
    closePrice?: number;
    closePriceAsOf?: string; // 'YYYY-MM-DD'
    isoCurrencyCode?: string;
};

// Write-side shape for a single holding, mapped from Plaid's `holdings` array.
// References its account and security by Plaid's ids; the db layer resolves
// both to internal ids during reconcile.
export type HoldingInput = {
    plaidAccountId: string; // Plaid's account_id
    plaidSecurityId: string; // links to the matching SecurityInput
    quantity: number;
    marketValue: number; // Plaid institution_value
    costBasis?: number;
    price: number; // Plaid institution_price
    isoCurrencyCode?: string;
};

// Read-side filters + pagination for listTransactions.
export type ListTransactionsOpts = {
    from?: string; // 'YYYY-MM-DD' inclusive lower bound
    to?: string; // 'YYYY-MM-DD' inclusive upper bound
    accountId?: string;
    take?: number;
    cursor?: string; // last Transaction.id from the previous page
};

export type TransactionDTO = {
    id: string;
    accountId: string;
    plaidTransactionId: string;
    amount: string; // Decimal → string
    isoCurrencyCode: string | null;
    date: string; // 'YYYY-MM-DD'
    authorizedDate: string | null; // 'YYYY-MM-DD'
    name: string;
    merchantName: string | null;
    pfcPrimary: string | null;
    pfcDetailed: string | null;
    pending: boolean;
    pendingTransactionId: string | null;
    paymentChannel: string | null;
};

export type CategoryTotalsOpts = {
    from?: string;
    to?: string;
    accountId?: string;
    direction: 'spending' | 'income';
    groupBy?: 'pfcPrimary' | 'pfcDetailed'; // defaults to 'pfcDetailed'
};

export type CategoryTotal = {
    category: string;
    total: number;
    count: number;
};

export type CashFlowOpts = {
    from?: string;
    to?: string;
    accountId?: string;
};

export type CashFlowSummary = {
    totalIn: number;
    totalOut: number;
    net: number;
};

export type TopMerchantsOpts = {
    from?: string;
    to?: string;
    accountId?: string;
    limit?: number;
};

export type MerchantTotal = {
    merchantName: string;
    total: number;
    count: number;
};

export type AccountTypeTotal = {
    type: string;
    total: number;
};

export type NetWorth = {
    assets: number;
    liabilities: number;
    net: number;
};

export type NetWorthHistoryOpts = {
    from?: string;
    to?: string;
};

export type NetWorthHistoryPoint = {
    date: string;
    assets: number;
    liabilities: number;
    net: number;
};

export type CashFlowHistoryOpts = {
    from?: string;
    to?: string;
    accountId?: string;
};

export type CashFlowHistoryPoint = {
    date: string;
    income: number;
    spend: number;
    cumulativeIncome: number;
    cumulativeSpend: number;
};

export type BudgetInput = {
    userId: string;
    category: PlaidPrimaryCategory;
    monthlyAmount: number;
    effectiveFrom?: string; // 'YYYY-MM-DD', defaults to today in the db layer
    source?: Source; // defaults to 'user' in the db layer; only applied on create, never on update
};

export type BudgetProgress = {
    id: string;
    category: PlaidPrimaryCategory;
    monthlyAmount: number;
    spent: number;
    remaining: number;
};

export type GoalInput = {
    userId: string;
    name: string;
    targetAmount: number;
    targetDate?: string; // 'YYYY-MM-DD'
    source?: Source; // defaults to 'user' in the db layer
};

export type GoalUpdateInput = {
    name?: string;
    targetAmount?: number;
    targetDate?: string | null;
    status?: string;
};

export type GoalContributionInput = {
    goalId: string;
    amount: number;
    date?: string; // 'YYYY-MM-DD', defaults to today in the db layer
    note?: string;
    source?: Source; // defaults to 'user' in the db layer
};

export type GoalWithProgress = {
    id: string;
    name: string;
    targetAmount: number;
    targetDate: string | null;
    status: string;
    contributed: number;
    remaining: number;
};
