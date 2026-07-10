'use client';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import {
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { NetWorth, NetWorthHistoryPoint } from '@/lib/db/types';
import { formatCurrency } from './format';
import { rangeForScale, TimeScale } from './time-range';
import {
    ChartSkeleton,
    computeTicks,
    formatAxisDate,
    formatTooltipDate,
    ScaleSelector,
} from './chart-controls';
import type { AccountDTO } from './types';

function CurrentNetWorthSkeleton() {
    return (
        <div className="mt-2 flex flex-col gap-2">
            <div className="h-7 w-32 animate-pulse rounded bg-black/10 motion-reduce:animate-none dark:bg-white/10" />
            <div className="h-3 w-40 animate-pulse rounded bg-black/10 motion-reduce:animate-none dark:bg-white/10" />
        </div>
    );
}

const COLLAPSED_ACCOUNT_COUNT = 3;

export function NetWorthChart({
    netWorth,
    accounts,
    summaryStatus,
}: {
    netWorth: NetWorth | null;
    accounts: AccountDTO[];
    summaryStatus: 'loading' | 'ready' | 'error';
}) {
    const [scale, setScale] = useState<TimeScale>('month');
    const [history, setHistory] = useState<NetWorthHistoryPoint[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading'
    );
    const [accountsExpanded, setAccountsExpanded] = useState(false);

    const fetchHistory = useCallback(async (currentScale: TimeScale) => {
        setStatus('loading');
        try {
            const { from, to } = rangeForScale(currentScale);
            const response = await axios.get('/api/analytics/net-worth/history', {
                params: { from, to },
            });
            setHistory(response.data.net_worth_history ?? []);
            setStatus('ready');
        } catch {
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        fetchHistory(scale);
    }, [fetchHistory, scale]);

    return (
        <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-sm font-medium text-black/60 dark:text-white/60">
                        Net Worth
                    </h2>
                    {summaryStatus === 'loading' || !netWorth ? (
                        <CurrentNetWorthSkeleton />
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
                        </>
                    )}
                </div>
                <ScaleSelector scale={scale} onChange={setScale} />
            </div>

            {status === 'loading' && <ChartSkeleton />}

            {status === 'error' && (
                <div
                    role="alert"
                    className="mt-4 flex flex-col items-center gap-3 py-10 text-center"
                >
                    <p className="text-sm text-black/70 dark:text-white/70">
                        We couldn&apos;t load your net worth history.
                    </p>
                    <button
                        type="button"
                        onClick={() => fetchHistory(scale)}
                        className="cursor-pointer rounded-lg border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/15 dark:hover:bg-white/5"
                    >
                        Try again
                    </button>
                </div>
            )}

            {status === 'ready' && history.length === 0 && (
                <p className="mt-6 py-10 text-center text-sm text-black/60 dark:text-white/60">
                    Not enough history yet to chart net worth.
                </p>
            )}

            {status === 'ready' && history.length > 0 && (
                <div className="mt-4 h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={history}>
                            <XAxis
                                dataKey="date"
                                tickFormatter={(date: string) =>
                                    formatAxisDate(date, scale)
                                }
                                tick={{ fontSize: 12 }}
                                stroke="currentColor"
                                className="text-black/40 dark:text-white/40"
                                minTickGap={32}
                                ticks={computeTicks(
                                    history.map((h) => h.date),
                                    scale
                                )}
                            />
                            <YAxis
                                tickFormatter={(value: number) =>
                                    formatCurrency(value)
                                }
                                tick={{ fontSize: 12 }}
                                stroke="currentColor"
                                className="text-black/40 dark:text-white/40"
                                width={80}
                            />
                            <Tooltip
                                formatter={(value) => formatCurrency(Number(value))}
                                labelFormatter={(date) =>
                                    formatTooltipDate(String(date))
                                }
                            />
                            <Line
                                type="monotone"
                                dataKey="net"
                                name="Net worth"
                                stroke="#2563eb"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {summaryStatus === 'ready' && accounts.length > 0 && (
                <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/5">
                    <h3 className="text-xs font-medium text-black/60 dark:text-white/60">
                        Accounts
                    </h3>
                    <ul className="mt-2 flex flex-col gap-2">
                        {(accountsExpanded
                            ? accounts
                            : accounts.slice(0, COLLAPSED_ACCOUNT_COUNT)
                        ).map((a) => (
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
                    {accounts.length > COLLAPSED_ACCOUNT_COUNT && (
                        <button
                            type="button"
                            onClick={() => setAccountsExpanded((v) => !v)}
                            className="mt-2 cursor-pointer text-xs font-medium text-blue-700 hover:underline dark:text-blue-400"
                        >
                            {accountsExpanded
                                ? 'Show less'
                                : `Expand all (${accounts.length})`}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

