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

// Up to 6 significant digits, trimming trailing zeros - share counts are often
// fractional but rarely need more precision than that on screen.
export function formatQuantity(value: number): string {
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 6,
    }).format(value);
}
