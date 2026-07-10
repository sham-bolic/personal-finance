'use client';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { Transaction } from '@/generated/prisma/client';
import type { NetWorth } from '@/lib/db/types';
import { formatPlaidCategory } from '@/lib/plaid_categories';
import { NetWorthChart } from './NetWorthChart';
import { CashFlowHistoryChart } from './CashFlowHistoryChart';
import { GoalsBudgetsWidget } from './GoalsBudgetsWidget';
import type { AccountDTO } from './types';

type TransactionDTO = Omit<Transaction, 'amount' | 'date'> & {
    amount: string; // Decimal → string over JSON
    date: string; // Date → string over JSON
};

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
        fetchTransactions();
        fetchSummary();
    }, [fetchTransactions, fetchSummary]); // run once on mount

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
            <DashboardSummary
                status={summaryStatus}
                netWorth={netWorth}
                accounts={accounts}
            />

            {/* Header */}
            <header className="mb-3">
                <h2 className="text-sm font-medium text-black/60 dark:text-white/60">
                    Transactions
                </h2>
                <p className="mt-1 text-xs text-black/60 dark:text-white/60">
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
                                <tr className="border-b border-black/10 text-left text-xs font-medium uppercase tracking-wide text-black/50 dark:border-white/10 dark:text-white/50">
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
                                                                {
                                                                    detailedCategory
                                                                }
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
                        {transactions.length > COLLAPSED_TRANSACTION_COUNT && (
                            <div className="border-t border-black/10 px-4 py-3 dark:border-white/10">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setTransactionsExpanded((e) => !e)
                                    }
                                    className="cursor-pointer text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
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
                className="mb-6 rounded-xl border border-black/10 px-6 py-8 text-center text-sm text-black/70 dark:border-white/10 dark:text-white/70"
            >
                We couldn&apos;t load your account summary.
            </div>
        );
    }

    return (
        <div className="mb-6 grid grid-cols-1 gap-4">
            <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
                <NetWorthChart
                    netWorth={netWorth}
                    accounts={accounts}
                    summaryStatus={status}
                />
            </section>

            <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
                <CashFlowHistoryChart />
            </section>

            <section className="rounded-xl border border-black/10 p-4 dark:border-white/10">
                <GoalsBudgetsWidget />
            </section>
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
