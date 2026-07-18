// Shared formatting helpers for the investments page.

import type { HoldingDTO } from '@/lib/db/types';

// A holding's display label: prefer its ticker, then the security name, else a
// neutral fallback. Cash / tickerless securities carry their own name and so
// appear under it rather than being force-classified as a stock.
export function holdingLabel(h: HoldingDTO): string {
    return h.tickerSymbol ?? h.securityName ?? 'Unknown';
}

export function formatCurrency(
    value: number,
    currency?: string | null
): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency ?? 'USD',
        currencyDisplay: 'narrowSymbol',
    }).format(value);
}

export function formatPercent(fraction: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(fraction);
}

export function formatSignedCurrency(
    value: number,
    currency?: string | null
): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency ?? 'USD',
        currencyDisplay: 'narrowSymbol',
        signDisplay: 'exceptZero',
    }).format(value);
}

export function formatSignedPercent(fraction: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        signDisplay: 'exceptZero',
    }).format(fraction);
}

// Plaid only reports cost basis for some security types (e.g. not for cash),
// so both are nullable - callers fall back to a placeholder when null rather
// than showing a misleading $0 gain.
export function holdingGainLoss(h: HoldingDTO): number | null {
    return h.costBasis === null
        ? null
        : Number(h.marketValue) - Number(h.costBasis);
}

export function holdingGainLossPercent(h: HoldingDTO): number | null {
    const gainLoss = holdingGainLoss(h);
    if (gainLoss === null) return null;
    const costBasis = Number(h.costBasis);
    if (costBasis === 0) return null;
    return gainLoss / costBasis;
}

// Tailwind color token for a gain/loss value - shared by the per-holding
// column and the portfolio-level totals so both agree on what counts as
// "up", "down", or neutral (null or exactly zero).
export function gainLossColor(gainLoss: number | null): string {
    if (gainLoss === null) return 'text-muted-foreground';
    if (gainLoss > 0) return 'text-positive';
    if (gainLoss < 0) return 'text-negative';
    return 'text-muted-foreground';
}

export type PortfolioTotals = {
    costBasis: number;
    gainLoss: number;
    gainLossPercent: number | null;
};

// Sums cost basis and unrealized gain/loss across holdings that report a
// cost basis. Positions without one (Plaid doesn't return cost basis for
// every institution/security type) are skipped entirely rather than
// treated as a $0 cost basis, so they can't drag the total toward a
// misleadingly large gain.
export function computePortfolioTotals(
    holdings: HoldingDTO[]
): PortfolioTotals {
    let costBasis = 0;
    let marketValue = 0;
    for (const h of holdings) {
        if (h.costBasis === null) continue;
        costBasis += Number(h.costBasis);
        marketValue += Number(h.marketValue);
    }
    const gainLoss = marketValue - costBasis;
    return {
        costBasis,
        gainLoss,
        gainLossPercent: costBasis === 0 ? null : gainLoss / costBasis,
    };
}

// Up to 6 significant digits, trimming trailing zeros - share counts are often
// fractional but rarely need more precision than that on screen.
export function formatQuantity(value: number): string {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 6,
    }).format(value);
}
