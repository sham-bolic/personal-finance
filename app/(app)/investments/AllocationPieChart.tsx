'use client';
import { useMemo } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { HoldingDTO } from '@/lib/db/types';
import { formatCurrency, formatPercent, holdingLabel } from './format';

// The largest N holdings are shown individually; the long tail of smaller
// positions is rolled into a single "Other" slice so the chart stays legible.
const TOP_N = 9;

// Fixed categorical palette. The first TOP_N colors are for individual
// holdings; "Other" always uses the trailing muted grey so the rollup reads as
// distinct from a real position.
const SLICE_COLORS = [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#f59e0b', // amber-500
    '#a855f7', // purple-500
    '#ec4899', // pink-500
    '#06b6d4', // cyan-500
    '#f97316', // orange-500
    '#14b8a6', // teal-500
    '#6366f1', // indigo-500
];
const OTHER_COLOR = '#94a3b8'; // slate-400

export type AllocationSlice = {
    key: string;
    label: string;
    sublabel: string | null;
    value: number;
    fraction: number;
    color: string;
};

/**
 * Build allocation slices from holdings ordered largest-first: keep the top N
 * individually and collapse the remainder into one "Other" slice. Fractions are
 * of `total` - the portfolio's whole market value, computed once by the caller
 * and shared with the holdings table so the pie and the table can never
 * disagree on a security's percentage.
 */
export function buildSlices(
    holdings: HoldingDTO[],
    total: number
): AllocationSlice[] {
    const valued = holdings
        .map((h) => ({ h, value: Number(h.marketValue) }))
        .filter((x) => x.value > 0);

    if (total <= 0 || valued.length === 0) return [];

    const top = valued.slice(0, TOP_N);
    const rest = valued.slice(TOP_N);

    const slices: AllocationSlice[] = top.map((x, i) => ({
        key: x.h.securityId,
        label: holdingLabel(x.h),
        sublabel: x.h.tickerSymbol ? x.h.securityName : null,
        value: x.value,
        fraction: x.value / total,
        color: SLICE_COLORS[i % SLICE_COLORS.length],
    }));

    if (rest.length > 0) {
        const restValue = rest.reduce((sum, x) => sum + x.value, 0);
        slices.push({
            key: '__other__',
            label: 'Other',
            sublabel: `${rest.length} smaller ${
                rest.length === 1 ? 'holding' : 'holdings'
            }`,
            value: restValue,
            fraction: restValue / total,
            color: OTHER_COLOR,
        });
    }

    return slices;
}

export function AllocationPieChart({
    holdings,
    total,
}: {
    holdings: HoldingDTO[];
    total: number;
}) {
    const slices = useMemo(
        () => buildSlices(holdings, total),
        [holdings, total]
    );

    if (slices.length === 0) {
        return (
            <p className="py-10 text-center text-sm text-muted-foreground">
                No positions with a market value to chart yet.
            </p>
        );
    }

    return (
        <div className="flex flex-col items-center gap-8 lg:flex-row lg:items-center lg:gap-10">
            <div className="relative h-56 w-56 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={slices}
                            dataKey="value"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={62}
                            outerRadius={100}
                            paddingAngle={1}
                            stroke="var(--surface)"
                            strokeWidth={2}
                            isAnimationActive={false}
                        >
                            {slices.map((slice) => (
                                <Cell key={slice.key} fill={slice.color} />
                            ))}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className="font-mono text-lg font-semibold tabular-nums">
                        {formatCurrency(total)}
                    </span>
                </div>
            </div>

            <ul className="flex w-full flex-col gap-2">
                {slices.map((slice) => (
                    <li
                        key={slice.key}
                        className="flex items-center gap-3 text-sm"
                    >
                        <span
                            aria-hidden="true"
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: slice.color }}
                        />
                        <span className="min-w-0 flex-1 truncate">
                            <span className="font-medium">{slice.label}</span>
                            {slice.sublabel && (
                                <span className="text-muted-foreground">
                                    {' '}
                                    · {slice.sublabel}
                                </span>
                            )}
                        </span>
                        <span className="font-mono tabular-nums text-muted-foreground">
                            {formatPercent(slice.fraction)}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
