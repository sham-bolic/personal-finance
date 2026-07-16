'use client';
import axios from 'axios';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { HoldingDTO } from '@/lib/db/types';
import { AllocationPieChart } from './AllocationPieChart';
import { AccountHoldingsCard } from './AccountHoldingsCard';

// Human-readable subtitle for an account card: subtype (e.g. "401k", "ira")
// plus the masked account number when present, e.g. "401k · ••1234".
function accountSubtitle(h: HoldingDTO): string | null {
    const parts: string[] = [];
    if (h.accountSubtype) parts.push(h.accountSubtype);
    if (h.accountMask) parts.push(`••${h.accountMask}`);
    return parts.length > 0 ? parts.join(' · ') : null;
}

// Group holdings (already sorted largest-value-first) into per-account buckets,
// each ordered by the account's total market value descending.
type AccountGroup = {
    accountId: string;
    accountName: string;
    subtitle: string | null;
    total: number;
    holdings: HoldingDTO[];
};

function groupByAccount(holdings: HoldingDTO[]): AccountGroup[] {
    const byId = new Map<string, AccountGroup>();
    for (const h of holdings) {
        let group = byId.get(h.accountId);
        if (!group) {
            group = {
                accountId: h.accountId,
                accountName: h.accountName,
                subtitle: accountSubtitle(h),
                total: 0,
                holdings: [],
            };
            byId.set(h.accountId, group);
        }
        group.total += Number(h.marketValue);
        group.holdings.push(h);
    }
    return Array.from(byId.values()).sort((a, b) => b.total - a.total);
}

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
    const accountGroups = useMemo(() => groupByAccount(holdings), [holdings]);

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

                    {accountGroups.map((group) => (
                        <AccountHoldingsCard
                            key={group.accountId}
                            accountId={group.accountId}
                            accountName={group.accountName}
                            accountSubtitle={group.subtitle}
                            accountTotal={group.total}
                            portfolioTotal={total}
                            holdings={group.holdings}
                        />
                    ))}
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
