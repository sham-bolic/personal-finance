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
import type { PortfolioValueHistoryPoint } from '@/lib/db/types';
import { rangeForScale, TimeScale } from '@/app/(app)/dashboard/time-range';
import {
    ChartSkeleton,
    computeTicks,
    dateToTimestamp,
    formatAxisDate,
    formatTooltipDate,
    ScaleSelector,
    usePersistedScale,
} from '@/app/(app)/dashboard/chart-controls';
import { formatCurrency } from './format';

export function PortfolioHistoryChart({
    currentValue,
}: {
    currentValue: number;
}) {
    const [scale, setScale] = usePersistedScale('investments:portfolioScale');
    const [history, setHistory] = useState<PortfolioValueHistoryPoint[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading'
    );
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
                '/api/analytics/portfolio/history',
                {
                    params: { from, to },
                }
            );
            setHistory(response.data.portfolio_value_history ?? []);
            setStatus('ready');
        } catch {
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        queueMicrotask(() => fetchHistory(scale));
    }, [fetchHistory, scale]);

    return (
        <section className="rounded-2xl border border-border/60 bg-surface p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h2 className="text-sm font-medium text-muted-foreground">
                        Portfolio value
                    </h2>
                    <p className="mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
                        {formatCurrency(currentValue)}
                    </p>
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
                        We couldn&apos;t load your portfolio history.
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
                    Not enough history yet to chart portfolio value.
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
                                {formatCurrency(activePoint.value)}
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
                                    id="portfolioValueFill"
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
                                dataKey="value"
                                name="Portfolio value"
                                stroke="var(--primary)"
                                strokeWidth={2}
                                fill="url(#portfolioValueFill)"
                                dot={false}
                                isAnimationActive={false}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </section>
    );
}
