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
    if (h.costBasis === null) return null;
    const costBasis = Number(h.costBasis);
    if (costBasis === 0) return null;
    return (Number(h.marketValue) - costBasis) / costBasis;
}

// Up to 6 significant digits, trimming trailing zeros - share counts are often
// fractional but rarely need more precision than that on screen.
export function formatQuantity(value: number): string {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 6,
    }).format(value);
}
