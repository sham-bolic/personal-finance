'use client';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    type MouseHandlerDataParam,
} from 'recharts';
import type { NetWorth, NetWorthHistoryPoint } from '@/lib/db/types';
import { formatCurrency } from './format';
import { rangeForScale, TimeScale } from './time-range';
import {
    ChartSkeleton,
    computeTicks,
    dateToTimestamp,
    formatAxisDate,
    formatTooltipDate,
    ScaleSelector,
} from './chart-controls';
import type { AccountDTO } from './types';

function CurrentNetWorthSkeleton() {
    return (
        <div className="mt-2 flex flex-col gap-2">
            <div className="h-7 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
            <div className="h-3 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
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
    const [hover, setHover] = useState<{ index: number; x: number } | null>(
        null
    );

    const { from: rangeFrom, to: rangeTo } = rangeForScale(scale);

    const chartData = useMemo(
        () => history.map((h) => ({ ...h, ts: dateToTimestamp(h.date) })),
        [history]
    );
    const activePoint = hover ? chartData[hover.index] : null;

    const handleHover = useCallback((state: MouseHandlerDataParam) => {
        const index = Number(state.activeTooltipIndex);
        if (!Number.isNaN(index) && state.activeCoordinate) {
            setHover({ index, x: state.activeCoordinate.x });
        }
    }, []);
    const handleHoverEnd = useCallback(() => setHover(null), []);

    const fetchHistory = useCallback(async (currentScale: TimeScale) => {
        setStatus('loading');
        setHover(null);
        try {
            const { from, to } = rangeForScale(currentScale);
            const response = await axios.get(
                '/api/analytics/net-worth/history',
                {
                    params: { from, to },
                }
            );
            setHistory(response.data.net_worth_history ?? []);
            setStatus('ready');
        } catch {
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        queueMicrotask(() => fetchHistory(scale));
    }, [fetchHistory, scale]);

    return (
        <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-sm font-medium text-muted-foreground">
                        Net Worth
                    </h2>
                    {summaryStatus === 'loading' || !netWorth ? (
                        <CurrentNetWorthSkeleton />
                    ) : (
                        <>
                            <p className="mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                                {formatCurrency(netWorth.net)}
                            </p>
                            <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
                                <span>
                                    Assets{' '}
                                    <span className="font-medium text-foreground">
                                        {formatCurrency(netWorth.assets)}
                                    </span>
                                </span>
                                <span>
                                    Liabilities{' '}
                                    <span className="font-medium text-foreground">
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
                    <p className="text-sm text-muted-foreground">
                        We couldn&apos;t load your net worth history.
                    </p>
                    <button
                        type="button"
                        onClick={() => fetchHistory(scale)}
                        className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        Try again
                    </button>
                </div>
            )}

            {status === 'ready' && history.length === 0 && (
                <p className="mt-6 py-10 text-center text-sm text-muted-foreground">
                    Not enough history yet to chart net worth.
                </p>
            )}

            {status === 'ready' && history.length > 0 && (
                <div className="relative mt-4 h-72 w-full">
                    {hover && activePoint && (
                        <div
                            className="pointer-events-none absolute top-1 z-10 -translate-x-1/2 rounded-md border border-border bg-surface px-2 py-1 text-center shadow-sm"
                            style={{ left: hover.x }}
                        >
                            <p className="text-[10px] whitespace-nowrap text-muted-foreground">
                                {formatTooltipDate(activePoint.ts)}
                            </p>
                            <p className="font-mono text-xs font-medium whitespace-nowrap tabular-nums">
                                {formatCurrency(activePoint.net)}
                            </p>
                        </div>
                    )}
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                            data={chartData}
                            onMouseMove={handleHover}
                            onMouseLeave={handleHoverEnd}
                        >
                            <defs>
                                <linearGradient
                                    id="netWorthFill"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="var(--primary)"
                                        stopOpacity={0.32}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--primary)"
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                vertical={false}
                                stroke="var(--border)"
                            />
                            <XAxis
                                dataKey="ts"
                                type="number"
                                scale="time"
                                domain={['dataMin', 'dataMax']}
                                tickFormatter={(ts: number) =>
                                    formatAxisDate(ts, scale)
                                }
                                tick={{ fontSize: 12 }}
                                stroke="currentColor"
                                className="text-muted-foreground"
                                axisLine={false}
                                tickLine={false}
                                minTickGap={32}
                                ticks={computeTicks(scale, rangeFrom, rangeTo)}
                            />
                            <YAxis
                                tickFormatter={(value: number) =>
                                    formatCurrency(value)
                                }
                                tick={{ fontSize: 12 }}
                                stroke="currentColor"
                                className="text-muted-foreground"
                                axisLine={false}
                                tickLine={false}
                                width={80}
                            />
                            <Tooltip
                                content={() => null}
                                cursor={{ stroke: 'var(--border)' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="net"
                                name="Net worth"
                                stroke="var(--primary)"
                                strokeWidth={2}
                                fill="url(#netWorthFill)"
                                dot={false}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}

            {summaryStatus === 'ready' && accounts.length > 0 && (
                <div className="mt-4 border-t border-border pt-3">
                    <h3 className="text-xs font-medium text-muted-foreground">
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
                                <span className="text-foreground/90">
                                    {a.name}
                                    {a.mask && (
                                        <span className="text-muted-foreground">
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
                            className="mt-2 cursor-pointer text-xs font-medium text-link hover:underline"
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
