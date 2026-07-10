'use client';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import type { NetWorth, TransactionDTO } from '@/lib/db/types';
import { formatPlaidCategory } from '@/lib/plaid_categories';
import { NetWorthChart } from './NetWorthChart';
import { CashFlowHistoryChart } from './CashFlowHistoryChart';
import { GoalsBudgetsWidget } from './GoalsBudgetsWidget';
import type { AccountDTO } from './types';

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

const CATEGORY_DOT_CLASSES = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-cyan-500',
    'bg-orange-500',
    'bg-teal-500',
];

// Deterministic color per category name, purely a visual scan aid for the
// category column — not meant to encode meaning, so no legend is needed.
function categoryDotClass(category: string) {
    let hash = 0;
    for (let i = 0; i < category.length; i++) {
        hash = (hash * 31 + category.charCodeAt(i)) >>> 0;
    }
    return CATEGORY_DOT_CLASSES[hash % CATEGORY_DOT_CLASSES.length];
}

// 'date' is a plain 'YYYY-MM-DD' with no time component. `new Date(date)`
// parses that as UTC midnight, so formatting it in a timezone west of UTC
// rolls it back a day — build the Date from local year/month/day instead.
function formatDate(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

const COLLAPSED_TRANSACTION_COUNT = 8;

export default function TransactionsPage() {
    const [transactions, setTransactions] = useState<TransactionDTO[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading'
    );
    const [transactionsExpanded, setTransactionsExpanded] = useState(false);

    const [netWorth, setNetWorth] = useState<NetWorth | null>(null);
    const [accounts, setAccounts] = useState<AccountDTO[]>([]);
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
            const [netWorthRes, accountsRes] = await Promise.all([
                axios.get('/api/analytics/net-worth'),
                axios.get('/api/accounts'),
            ]);
            setNetWorth(netWorthRes.data.net_worth ?? null);
            setAccounts(accountsRes.data.accounts ?? []);
            setSummaryStatus('ready');
        } catch {
            setSummaryStatus('error');
        }
    }, []);

    useEffect(() => {
        queueMicrotask(() => {
            fetchTransactions();
            fetchSummary();
        });
    }, [fetchTransactions, fetchSummary]); // run once on mount

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
            <header className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Dashboard
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Your net worth, cash flow, and recent activity at a
                    glance.
                </p>
            </header>

            <DashboardSummary
                status={summaryStatus}
                netWorth={netWorth}
                accounts={accounts}
            />

            {/* Header */}
            <header className="mb-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                    Transactions
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                    {status === 'ready'
                        ? `${transactions.length} ${
                              transactions.length === 1
                                  ? 'transaction'
                                  : 'transactions'
                          }`
                        : 'Your recent account activity'}
                </p>
            </header>

            {/* Content */}
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                {status === 'loading' && <TransactionsSkeleton />}

                {status === 'error' && (
                    <div
                        role="alert"
                        className="flex flex-col items-center gap-3 px-6 py-16 text-center"
                    >
                        <p className="text-sm text-muted-foreground">
                            We couldn&apos;t load your transactions.
                        </p>
                        <button
                            type="button"
                            onClick={fetchTransactions}
                            className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
                        <p className="text-sm text-muted-foreground">
                            Connect a bank account to see your latest activity.
                        </p>
                    </div>
                )}

                {status === 'ready' && transactions.length > 0 && (
                    <>
                        <table className="w-full border-collapse text-sm">
                            <caption className="sr-only">
                                List of account transactions
                            </caption>
                            <thead>
                                <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                    <th
                                        scope="col"
                                        className="px-4 py-3 font-medium"
                                    >
                                        Date
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 font-medium"
                                    >
                                        Description
                                    </th>
                                    <th
                                        scope="col"
                                        className="px-4 py-3 font-medium"
                                    >
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
                                {(transactionsExpanded
                                    ? transactions
                                    : transactions.slice(
                                          0,
                                          COLLAPSED_TRANSACTION_COUNT
                                      )
                                ).map((t) => {
                                    const { isInflow, display } = formatAmount(
                                        t.amount,
                                        t.isoCurrencyCode
                                    );
                                    const primaryCategory = formatPlaidCategory(
                                        t.pfcPrimary
                                    );
                                    const detailedCategory =
                                        formatPlaidCategory(t.pfcDetailed);
                                    return (
                                        <tr
                                            key={t.plaidTransactionId}
                                            className="border-b border-border transition-colors last:border-0 hover:bg-surface-hover"
                                        >
                                            <td className="font-mono text-xs whitespace-nowrap tabular-nums text-muted-foreground px-4 py-3">
                                                {formatDate(t.date)}
                                            </td>
                                            <td className="px-4 py-3 font-medium">
                                                {t.name}
                                            </td>
                                            <td className="px-4 py-3">
                                                {primaryCategory ? (
                                                    <div className="flex items-center gap-2">
                                                        <span
                                                            aria-hidden="true"
                                                            className={`size-1.5 shrink-0 rounded-full ${categoryDotClass(primaryCategory)}`}
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="text-foreground/90">
                                                                {primaryCategory}
                                                            </span>
                                                            {detailedCategory && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    {
                                                                        detailedCategory
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        Uncategorized
                                                    </span>
                                                )}
                                            </td>
                                            <td
                                                className={`font-mono whitespace-nowrap tabular-nums px-4 py-3 text-right ${
                                                    isInflow
                                                        ? 'text-positive'
                                                        : 'text-foreground/90'
                                                }`}
                                            >
                                                {display}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {transactions.length > COLLAPSED_TRANSACTION_COUNT && (
                            <div className="border-t border-border px-4 py-3">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setTransactionsExpanded((e) => !e)
                                    }
                                    className="cursor-pointer text-xs font-medium text-link hover:underline"
                                >
                                    {transactionsExpanded
                                        ? 'Show less'
                                        : `Expand all (${transactions.length})`}
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}

function DashboardSummary({
    status,
    netWorth,
    accounts,
}: {
    status: 'loading' | 'ready' | 'error';
    netWorth: NetWorth | null;
    accounts: AccountDTO[];
}) {
    if (status === 'error') {
        return (
            <div
                role="alert"
                className="mb-6 rounded-xl border border-border bg-surface px-6 py-8 text-center text-sm text-muted-foreground shadow-sm"
            >
                We couldn&apos;t load your account summary.
            </div>
        );
    }

    return (
        <div className="mb-6 grid grid-cols-1 gap-4">
            <section className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
                <NetWorthChart
                    netWorth={netWorth}
                    accounts={accounts}
                    summaryStatus={status}
                />
            </section>

            <section className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
                <CashFlowHistoryChart />
            </section>

            <section className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
                <GoalsBudgetsWidget />
            </section>
        </div>
    );
}

function TransactionsSkeleton() {
    return (
        <div className="divide-y divide-border">
            {Array.from({ length: 6 }).map((_, i) => (
                <div
                    key={i}
                    className="flex items-center justify-between gap-4 px-4 py-3.5"
                >
                    <div className="h-3 w-16 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                    <div className="h-3 flex-1 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                    <div className="h-3 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                </div>
            ))}
        </div>
    );
}
