'use client';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import {
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import type { CashFlowHistoryPoint } from '@/lib/db/types';
import { formatCurrency } from './format';
import { rangeForScale, TimeScale } from './time-range';
import {
    ChartSkeleton,
    computeTicks,
    formatAxisDate,
    formatTooltipDate,
    ScaleSelector,
} from './chart-controls';

export function CashFlowHistoryChart() {
    const [scale, setScale] = useState<TimeScale>('month');
    const [history, setHistory] = useState<CashFlowHistoryPoint[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading'
    );

    const fetchHistory = useCallback(async (currentScale: TimeScale) => {
        setStatus('loading');
        try {
            const { from, to } = rangeForScale(currentScale);
            const response = await axios.get('/api/analytics/cashflow/history', {
                params: { from, to },
            });
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
                <h2 className="text-sm font-medium text-black/60 dark:text-white/60">
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
                        className="cursor-pointer rounded-lg border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/15 dark:hover:bg-white/5"
                    >
                        Try again
                    </button>
                </div>
            )}

            {status === 'ready' && history.length === 0 && (
                <p className="mt-6 py-10 text-center text-sm text-black/60 dark:text-white/60">
                    No transactions in this range yet.
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
                            <Legend
                                wrapperStyle={{ fontSize: 12 }}
                                iconType="line"
                            />
                            <Line
                                type="monotone"
                                dataKey="cumulativeIncome"
                                name="Income"
                                stroke="#059669"
                                strokeWidth={2}
                                dot={false}
                            />
                            <Line
                                type="monotone"
                                dataKey="cumulativeSpend"
                                name="Spend"
                                stroke="#dc2626"
                                strokeWidth={2}
                                dot={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
}

