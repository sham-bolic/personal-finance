'use client';
import { useMemo, useState } from 'react';
import { CaretDown, CaretUp } from '@phosphor-icons/react';
import type { HoldingDTO } from '@/lib/db/types';
import {
    formatCurrency,
    formatPercent,
    formatQuantity,
    holdingLabel,
} from './format';
import {
    DEFAULT_SORT,
    nextSortState,
    sortHoldings,
    type SortKey,
    type SortState,
} from './sortHoldings';

const TOP_N = 3;

const COLUMNS: { key: SortKey; label: string; align: 'left' | 'right' }[] = [
    { key: 'security', label: 'Security', align: 'left' },
    { key: 'quantity', label: 'Quantity', align: 'right' },
    { key: 'price', label: 'Price', align: 'right' },
    { key: 'marketValue', label: 'Market value', align: 'right' },
    { key: 'percent', label: '% of portfolio', align: 'right' },
];

// A single investment account and its holdings, sorted largest-position-first
// by the caller. Shows the top few by market value with a toggle to reveal the
// rest, so an account with many positions stays scannable.
export function AccountHoldingsCard({
    accountName,
    accountSubtitle,
    accountTotal,
    portfolioTotal,
    holdings,
}: {
    accountName: string;
    accountSubtitle: string | null;
    accountTotal: number;
    portfolioTotal: number;
    holdings: HoldingDTO[];
}) {
    const [expanded, setExpanded] = useState(false);
    const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
    const sorted = useMemo(
        () => sortHoldings(holdings, sort),
        [holdings, sort]
    );
    const hasMore = sorted.length > TOP_N;
    const visible = expanded ? sorted : sorted.slice(0, TOP_N);
    const accountFraction =
        portfolioTotal > 0 ? accountTotal / portfolioTotal : 0;
    const currency = holdings[0]?.isoCurrencyCode ?? 'USD';

    return (
        <section className="overflow-hidden rounded-2xl border border-border/60 bg-surface">
            <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
                <div className="flex flex-col">
                    <h2 className="text-sm font-medium">{accountName}</h2>
                    {accountSubtitle && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {accountSubtitle}
                        </p>
                    )}
                </div>
                <div className="flex flex-col items-end">
                    <span className="font-mono text-sm font-medium tabular-nums">
                        {formatCurrency(accountTotal, currency)}
                    </span>
                    <span className="mt-0.5 font-mono text-xs tabular-nums text-muted-foreground">
                        {formatPercent(accountFraction)} of portfolio
                    </span>
                </div>
            </header>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                    <caption className="sr-only">
                        Holdings in {accountName}
                    </caption>
                    <thead>
                        <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            {COLUMNS.map((col) => {
                                const active = sort.key === col.key;
                                const alignRight = col.align === 'right';
                                const Caret =
                                    sort.direction === 'asc'
                                        ? CaretUp
                                        : CaretDown;
                                const ariaSort = !active
                                    ? undefined
                                    : sort.direction === 'asc'
                                      ? 'ascending'
                                      : 'descending';
                                return (
                                    <th
                                        key={col.key}
                                        scope="col"
                                        aria-sort={ariaSort}
                                        className={`px-4 py-3 font-medium ${
                                            alignRight
                                                ? 'text-right'
                                                : 'text-left'
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setSort((current) =>
                                                    nextSortState(
                                                        current,
                                                        col.key
                                                    )
                                                )
                                            }
                                            className={`inline-flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 -mx-1 uppercase tracking-wide transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                                                alignRight
                                                    ? 'flex-row-reverse'
                                                    : ''
                                            } ${active ? 'text-foreground' : ''}`}
                                        >
                                            {col.label}
                                            {active && (
                                                <Caret
                                                    size={11}
                                                    weight="bold"
                                                    aria-hidden="true"
                                                />
                                            )}
                                        </button>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((h) => {
                            const marketValue = Number(h.marketValue);
                            const fraction =
                                portfolioTotal > 0
                                    ? marketValue / portfolioTotal
                                    : 0;
                            return (
                                <tr
                                    key={h.id}
                                    className="border-b border-border transition-colors last:border-0 hover:bg-surface-hover"
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                            <span className="font-medium">
                                                {holdingLabel(h)}
                                            </span>
                                            {h.tickerSymbol &&
                                                h.securityName && (
                                                    <span className="text-xs text-muted-foreground">
                                                        {h.securityName}
                                                    </span>
                                                )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono whitespace-nowrap tabular-nums text-muted-foreground">
                                        {formatQuantity(Number(h.quantity))}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono whitespace-nowrap tabular-nums text-muted-foreground">
                                        {formatCurrency(
                                            Number(h.price),
                                            h.isoCurrencyCode
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono whitespace-nowrap tabular-nums">
                                        {formatCurrency(
                                            marketValue,
                                            h.isoCurrencyCode
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono whitespace-nowrap tabular-nums text-muted-foreground">
                                        {formatPercent(fraction)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {hasMore && (
                <div className="border-t border-border px-4 py-2">
                    <button
                        type="button"
                        onClick={() => setExpanded((v) => !v)}
                        className="cursor-pointer rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        {expanded
                            ? 'Show less'
                            : `Show all ${holdings.length} holdings`}
                    </button>
                </div>
            )}
        </section>
    );
}
