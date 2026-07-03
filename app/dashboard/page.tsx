'use client';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { Account, Transaction } from '@/generated/prisma/client';
import type { CashFlowSummary, NetWorth } from '@/lib/db/types';

type TransactionDTO = Omit<Transaction, 'amount' | 'date'> & {
    amount: string; // Decimal → string over JSON
    date: string; // Date → string over JSON
};

type AccountDTO = Omit<Account, 'currentBalance' | 'availableBalance'> & {
    currentBalance: string | null; // Decimal → string over JSON
    availableBalance: string | null; // Decimal → string over JSON
};

function formatCurrency(value: number, currency: string | null = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency ?? 'USD',
        currencyDisplay: 'narrowSymbol',
    }).format(value);
}

// Plaid convention: positive amount = money out of the account (outflow),
// negative amount = money into the account (inflow).
function formatAmount(amount: string, currency: string | null) {
    const value = Number(amount);
    const isInflow = value < 0;
    const formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency ?? 'USD',
        currencyDisplay: 'narrowSymbol',
    });
    return {
        isInflow,
        // Inflows show a leading "+"; outflows show the plain amount.
        display: `${isInflow ? '+' : ''}${formatter.format(Math.abs(value))}`,
    };
}

// Plaid's personal_finance_category values are SCREAMING_SNAKE_CASE.
function formatCategory(value: string | null) {
    if (!value) return null;
    return value
        .toLowerCase()
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function formatDate(date: string) {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function Spinner({ className = '' }: { className?: string }) {
    return (
        <svg
            className={`animate-spin motion-reduce:animate-none ${className}`}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
        >
            <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
            />
            <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z"
            />
        </svg>
    );
}

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading'
    );
    const [syncing, setSyncing] = useState(false);

    const [netWorth, setNetWorth] = useState<NetWorth | null>(null);
    const [accounts, setAccounts] = useState<AccountDTO[]>([]);
    const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null);
    const [summaryStatus, setSummaryStatus] = useState<
        'loading' | 'ready' | 'error'
    >('loading');

    const fetchTransactions = useCallback(async () => {
        setStatus('loading');
        try {
            const response = await axios.get('/api/transactions');
            // route returns { transaction_data: <Plaid sync response> }
            setTransactions(response.data.transaction_data ?? []);
            setStatus('ready');
        } catch {
            setStatus('error');
        }
    }, []);

    const fetchSummary = useCallback(async () => {
        setSummaryStatus('loading');
        try {
            const [netWorthRes, accountsRes, cashFlowRes] = await Promise.all(
                [
                    axios.get('/api/analytics/net-worth'),
                    axios.get('/api/accounts'),
                    axios.get('/api/analytics/cashflow'),
                ]
            );
            setNetWorth(netWorthRes.data.net_worth ?? null);
            setAccounts(accountsRes.data.accounts ?? []);
            setCashFlow(cashFlowRes.data.cash_flow ?? null);
            setSummaryStatus('ready');
        } catch {
            setSummaryStatus('error');
        }
    }, []);

    useEffect(() => {
        fetchTransactions();
        fetchSummary();
    }, [fetchTransactions, fetchSummary]); // run once on mount

    const handleSync = useCallback(async () => {
        setSyncing(true);
        try {
            await axios.post('/api/sync');
            await Promise.all([fetchTransactions(), fetchSummary()]);
        } finally {
            setSyncing(false);
        }
    }, [fetchTransactions, fetchSummary]);

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
            <DashboardSummary
                status={summaryStatus}
                netWorth={netWorth}
                accounts={accounts}
                cashFlow={cashFlow}
            />

            {/* Header */}
            <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">
                        Transactions
                    </h1>
                    <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                        {status === 'ready'
                            ? `${transactions.length} ${
                                  transactions.length === 1
                                      ? 'transaction'
                                      : 'transactions'
                              }`
                            : 'Your recent account activity'}
                    </p>
                </div>

                <button
                    type="button"
                    onClick={handleSync}
                    disabled={syncing}
                    aria-label="Sync transactions"
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-200 hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {syncing ? (
                        <Spinner className="h-4 w-4" />
                    ) : (
                        <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                            <path d="M21 3v6h-6" />
                        </svg>
                    )}
                    {syncing ? 'Syncing…' : 'Sync'}
                </button>
            </header>

            {/* Content */}
            <div className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
                {status === 'loading' && <TransactionsSkeleton />}

                {status === 'error' && (
                    <div
                        role="alert"
                        className="flex flex-col items-center gap-3 px-6 py-16 text-center"
                    >
                        <p className="text-sm text-black/70 dark:text-white/70">
                            We couldn&apos;t load your transactions.
                        </p>
                        <button
                            type="button"
                            onClick={fetchTransactions}
                            className="cursor-pointer rounded-lg border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/15 dark:hover:bg-white/5"
                        >
                            Try again
                        </button>
                    </div>
                )}

                {status === 'ready' && transactions.length === 0 && (
                    <div className="flex flex-col items-center gap-1 px-6 py-16 text-center">
                        <p className="text-sm font-medium">
                            No transactions yet
                        </p>
                        <p className="text-sm text-black/60 dark:text-white/60">
                            Hit “Sync” to pull in your latest account activity.
                        </p>
                    </div>
                )}

                {status === 'ready' && transactions.length > 0 && (
                    <table className="w-full border-collapse text-sm">
                        <caption className="sr-only">
                            List of account transactions
                        </caption>
                        <thead>
                            <tr className="border-b border-black/10 text-left text-xs font-medium uppercase tracking-wide text-black/50 dark:border-white/10 dark:text-white/50">
                                <th scope="col" className="px-4 py-3 font-medium">
                                    Date
                                </th>
                                <th scope="col" className="px-4 py-3 font-medium">
                                    Description
                                </th>
                                <th scope="col" className="px-4 py-3 font-medium">
                                    Category
                                </th>
                                <th
                                    scope="col"
                                    className="px-4 py-3 text-right font-medium"
                                >
                                    Amount
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.map((t) => {
                                const { isInflow, display } = formatAmount(
                                    t.amount,
                                    t.isoCurrencyCode
                                );
                                const primaryCategory = formatCategory(
                                    t.pfcPrimary
                                );
                                const detailedCategory = formatCategory(
                                    t.pfcDetailed
                                );
                                return (
                                    <tr
                                        key={t.plaidTransactionId}
                                        className="border-b border-black/5 transition-colors last:border-0 hover:bg-black/3 dark:border-white/5 dark:hover:bg-white/4"
                                    >
                                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs tabular-nums text-black/60 dark:text-white/60">
                                            {formatDate(t.date)}
                                        </td>
                                        <td className="px-4 py-3 font-medium">
                                            {t.name}
                                        </td>
                                        <td className="px-4 py-3">
                                            {primaryCategory ? (
                                                <div className="flex flex-col">
                                                    <span className="text-black/80 dark:text-white/80">
                                                        {primaryCategory}
                                                    </span>
                                                    {detailedCategory && (
                                                        <span className="text-xs text-black/50 dark:text-white/50">
                                                            {detailedCategory}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-black/40 dark:text-white/40">
                                                    Uncategorized
                                                </span>
                                            )}
                                        </td>
                                        <td
                                            className={`whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums ${
                                                isInflow
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : 'text-black/80 dark:text-white/80'
                                            }`}
                                        >
                                            {display}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </main>
    );
}

function DashboardSummary({
    status,
    netWorth,
    accounts,
    cashFlow,
}: {
    status: 'loading' | 'ready' | 'error';
    netWorth: NetWorth | null;
    accounts: AccountDTO[];
    cashFlow: CashFlowSummary | null;
}) {
    if (status === 'error') {
        return (
            <div
                role="alert"
                className="mb-8 rounded-xl border border-black/10 px-6 py-8 text-center text-sm text-black/70 dark:border-white/10 dark:text-white/70"
            >
                We couldn&apos;t load your account summary.
            </div>
        );
    }

    return (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <section className="rounded-xl border border-black/10 p-5 dark:border-white/10">
                <h2 className="text-sm font-medium text-black/60 dark:text-white/60">
                    Net Worth
                </h2>
                {status === 'loading' || !netWorth ? (
                    <SummarySkeleton />
                ) : (
                    <>
                        <p className="mt-2 text-2xl font-semibold tracking-tight">
                            {formatCurrency(netWorth.net)}
                        </p>
                        <div className="mt-3 flex gap-4 text-xs text-black/60 dark:text-white/60">
                            <span>
                                Assets{' '}
                                <span className="font-medium text-black/80 dark:text-white/80">
                                    {formatCurrency(netWorth.assets)}
                                </span>
                            </span>
                            <span>
                                Liabilities{' '}
                                <span className="font-medium text-black/80 dark:text-white/80">
                                    {formatCurrency(netWorth.liabilities)}
                                </span>
                            </span>
                        </div>
                        {accounts.length > 0 && (
                            <ul className="mt-4 flex flex-col gap-2 border-t border-black/5 pt-3 dark:border-white/5">
                                {accounts.map((a) => (
                                    <li
                                        key={a.id}
                                        className="flex items-center justify-between text-sm"
                                    >
                                        <span className="text-black/70 dark:text-white/70">
                                            {a.name}
                                            {a.mask && (
                                                <span className="text-black/40 dark:text-white/40">
                                                    {' '}
                                                    ••{a.mask}
                                                </span>
                                            )}
                                        </span>
                                        <span className="font-mono tabular-nums">
                                            {a.currentBalance !== null
                                                ? formatCurrency(
                                                      Number(a.currentBalance),
                                                      a.isoCurrencyCode
                                                  )
                                                : '—'}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </section>

            <section className="rounded-xl border border-black/10 p-5 dark:border-white/10">
                <h2 className="text-sm font-medium text-black/60 dark:text-white/60">
                    Cash Flow
                </h2>
                {status === 'loading' || !cashFlow ? (
                    <SummarySkeleton />
                ) : (
                    <>
                        <p
                            className={`mt-2 text-2xl font-semibold tracking-tight ${
                                cashFlow.net >= 0
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : ''
                            }`}
                        >
                            {cashFlow.net >= 0 ? '+' : ''}
                            {formatCurrency(cashFlow.net)}
                        </p>
                        <div className="mt-3 flex gap-4 text-xs text-black/60 dark:text-white/60">
                            <span>
                                Income{' '}
                                <span className="font-medium text-black/80 dark:text-white/80">
                                    {formatCurrency(cashFlow.totalIn)}
                                </span>
                            </span>
                            <span>
                                Spending{' '}
                                <span className="font-medium text-black/80 dark:text-white/80">
                                    {formatCurrency(cashFlow.totalOut)}
                                </span>
                            </span>
                        </div>
                    </>
                )}
            </section>
        </div>
    );
}

function SummarySkeleton() {
    return (
        <div className="mt-2 flex flex-col gap-2">
            <div className="h-7 w-32 animate-pulse rounded bg-black/10 motion-reduce:animate-none dark:bg-white/10" />
            <div className="h-3 w-40 animate-pulse rounded bg-black/10 motion-reduce:animate-none dark:bg-white/10" />
        </div>
    );
}

function TransactionsSkeleton() {
    return (
        <div className="divide-y divide-black/5 dark:divide-white/5">
            {Array.from({ length: 6 }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-center justify-between gap-4 px-4 py-3.5"
                >
                    <div className="h-3 w-16 animate-pulse rounded bg-black/10 motion-reduce:animate-none dark:bg-white/10" />
                    <div className="h-3 flex-1 animate-pulse rounded bg-black/10 motion-reduce:animate-none dark:bg-white/10" />
                    <div className="h-3 w-24 animate-pulse rounded bg-black/10 motion-reduce:animate-none dark:bg-white/10" />
                    <div className="h-3 w-20 animate-pulse rounded bg-black/10 motion-reduce:animate-none dark:bg-white/10" />
                </div>
            ))}
        </div>
    );
}
