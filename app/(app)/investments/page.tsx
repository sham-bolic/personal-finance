'use client';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HoldingDTO } from '@/lib/db/types';
import { AllocationPieChart } from './AllocationPieChart';
import {
    formatCurrency,
    formatPercent,
    formatQuantity,
    holdingLabel,
} from './format';

export default function InvestmentsPage() {
    const [holdings, setHoldings] = useState<HoldingDTO[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading'
    );

    const fetchHoldings = useCallback(async () => {
        setStatus('loading');
        try {
            const response = await axios.get('/api/holdings');
            setHoldings(response.data.holdings ?? []);
            setStatus('ready');
        } catch {
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        queueMicrotask(() => fetchHoldings());
    }, [fetchHoldings]);

    const total = useMemo(
        () => holdings.reduce((sum, h) => sum + Number(h.marketValue), 0),
        [holdings]
    );

    return (
        <main className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
            <header className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Investments
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Where your invested money is allocated across your holdings.
                </p>
            </header>

            {status === 'loading' && <InvestmentsSkeleton />}

            {status === 'error' && (
                <div
                    role="alert"
                    className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-surface px-6 py-16 text-center"
                >
                    <p className="text-sm text-muted-foreground">
                        We couldn&apos;t load your investments.
                    </p>
                    <button
                        type="button"
                        onClick={fetchHoldings}
                        className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        Try again
                    </button>
                </div>
            )}

            {status === 'ready' && holdings.length === 0 && (
                <div className="flex flex-col items-center gap-1 rounded-2xl border border-border/60 bg-surface px-6 py-16 text-center">
                    <p className="text-sm font-medium">No investments yet</p>
                    <p className="text-sm text-muted-foreground">
                        Link an investment or brokerage account to see how your
                        portfolio is allocated.
                    </p>
                </div>
            )}

            {status === 'ready' && holdings.length > 0 && (
                <div className="flex flex-col gap-6">
                    <section className="rounded-2xl border border-border/60 bg-surface p-6">
                        <h2 className="mb-6 text-sm font-medium text-muted-foreground">
                            Allocation by security
                        </h2>
                        <AllocationPieChart holdings={holdings} total={total} />
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-border/60 bg-surface">
                        <header className="border-b border-border px-4 py-3">
                            <h2 className="text-sm font-medium text-muted-foreground">
                                Holdings
                            </h2>
                            <p className="mt-1 text-xs text-muted-foreground">
                                {holdings.length}{' '}
                                {holdings.length === 1
                                    ? 'position'
                                    : 'positions'}
                            </p>
                        </header>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-sm">
                                <caption className="sr-only">
                                    List of investment holdings
                                </caption>
                                <thead>
                                    <tr className="border-b border-border text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                        <th
                                            scope="col"
                                            className="px-4 py-3 font-medium"
                                        >
                                            Security
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-right font-medium"
                                        >
                                            Quantity
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-right font-medium"
                                        >
                                            Price
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-right font-medium"
                                        >
                                            Market value
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-right font-medium"
                                        >
                                            % of portfolio
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {holdings.map((h) => {
                                        const marketValue = Number(
                                            h.marketValue
                                        );
                                        const fraction =
                                            total > 0 ? marketValue / total : 0;
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
                                                                    {
                                                                        h.securityName
                                                                    }
                                                                </span>
                                                            )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-right font-mono whitespace-nowrap tabular-nums text-muted-foreground">
                                                    {formatQuantity(
                                                        Number(h.quantity)
                                                    )}
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
                    </section>
                </div>
            )}
        </main>
    );
}

function InvestmentsSkeleton() {
    return (
        <div className="flex flex-col gap-6">
            <section className="rounded-2xl border border-border/60 bg-surface p-6">
                <div className="mb-6 h-3 w-40 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                <div className="flex flex-col items-center gap-8 lg:flex-row lg:gap-10">
                    <div className="size-56 shrink-0 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
                    <div className="flex w-full flex-col gap-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-3 w-full animate-pulse rounded bg-muted motion-reduce:animate-none"
                            />
                        ))}
                    </div>
                </div>
            </section>
            <section className="rounded-2xl border border-border/60 bg-surface p-6">
                <div className="flex flex-col gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className="h-4 w-full animate-pulse rounded bg-muted motion-reduce:animate-none"
                        />
                    ))}
                </div>
            </section>
        </div>
    );
}
