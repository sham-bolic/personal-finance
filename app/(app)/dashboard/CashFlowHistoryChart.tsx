'use client';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
    type MouseHandlerDataParam,
} from 'recharts';
import type { CashFlowHistoryPoint } from '@/lib/db/types';
import { formatCurrency } from './format';
import { rangeForScale, TimeScale } from './time-range';
import {
    ChartSkeleton,
    computeTicks,
    dateToTimestamp,
    formatAxisDate,
    formatTooltipDate,
    ScaleSelector,
    usePersistedScale,
} from './chart-controls';

export function CashFlowHistoryChart() {
    const [scale, setScale] = usePersistedScale('dashboard:cashFlowScale');
    const [history, setHistory] = useState<CashFlowHistoryPoint[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading'
    );
    const [hover, setHover] = useState<{ index: number; x: number } | null>(
        null
    );

    const chartData = useMemo(
        () => history.map((h) => ({ ...h, ts: dateToTimestamp(h.date) })),
        [history]
    );
    const dataMinTs = Math.min(...chartData.map((d) => d.ts));
    const dataMaxTs = Math.max(...chartData.map((d) => d.ts));
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
                '/api/analytics/cashflow/history',
                {
                    params: { from, to },
                }
            );
            setHistory(response.data.cash_flow_history ?? []);
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
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-muted-foreground">
                    Cumulative Income vs. Spend
                </h2>
                <ScaleSelector scale={scale} onChange={setScale} />
            </div>

            {status === 'loading' && <ChartSkeleton />}

            {status === 'error' && (
                <div
                    role="alert"
                    className="mt-4 flex flex-col items-center gap-3 py-10 text-center"
                >
                    <p className="text-sm text-muted-foreground">
                        We couldn&apos;t load your cash flow history.
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
                    No transactions in this range yet.
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
                            <div className="flex items-center gap-2 text-xs">
                                <span className="flex items-center gap-1 font-mono font-medium whitespace-nowrap tabular-nums text-positive">
                                    <span
                                        aria-hidden="true"
                                        className="size-1.5 rounded-full bg-positive"
                                    />
                                    {formatCurrency(
                                        activePoint.cumulativeIncome
                                    )}
                                </span>
                                <span className="flex items-center gap-1 font-mono font-medium whitespace-nowrap tabular-nums text-negative">
                                    <span
                                        aria-hidden="true"
                                        className="size-1.5 rounded-full bg-negative"
                                    />
                                    {formatCurrency(
                                        activePoint.cumulativeSpend
                                    )}
                                </span>
                            </div>
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
                                    id="incomeFill"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="var(--positive)"
                                        stopOpacity={0.25}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--positive)"
                                        stopOpacity={0}
                                    />
                                </linearGradient>
                                <linearGradient
                                    id="spendFill"
                                    x1="0"
                                    y1="0"
                                    x2="0"
                                    y2="1"
                                >
                                    <stop
                                        offset="5%"
                                        stopColor="var(--negative)"
                                        stopOpacity={0.2}
                                    />
                                    <stop
                                        offset="95%"
                                        stopColor="var(--negative)"
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
                                ticks={computeTicks(
                                    scale,
                                    dataMinTs,
                                    dataMaxTs
                                )}
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
                            <Legend
                                wrapperStyle={{ fontSize: 12 }}
                                iconType="line"
                            />
                            <Area
                                type="monotone"
                                dataKey="cumulativeIncome"
                                name="Income"
                                stroke="var(--positive)"
                                strokeWidth={2}
                                fill="url(#incomeFill)"
                                dot={false}
                                isAnimationActive={false}
                            />
                            <Area
                                type="monotone"
                                dataKey="cumulativeSpend"
                                name="Spend"
                                stroke="var(--negative)"
                                strokeWidth={2}
                                fill="url(#spendFill)"
                                dot={false}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}
