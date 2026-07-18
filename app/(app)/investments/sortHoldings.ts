// Sorting for a single account's holdings table. Kept pure and separate from
// AccountHoldingsCard so the ordering rules (which column, which direction,
// what "next" means on a repeat click) can be reasoned about on their own.

import type { HoldingDTO } from '@/lib/db/types';
import { holdingGainLoss, holdingLabel } from './format';

export type SortKey =
    | 'security'
    | 'quantity'
    | 'price'
    | 'marketValue'
    | 'percent'
    | 'costBasis'
    | 'gainLoss';

export type SortDirection = 'asc' | 'desc';

export type SortState = {
    key: SortKey;
    direction: SortDirection;
};

export const DEFAULT_SORT: SortState = {
    key: 'marketValue',
    direction: 'desc',
};

// Security sorts A->Z on first click; every numeric column sorts
// largest-first, since that's the more useful default for money and share
// counts.
function defaultDirectionFor(key: SortKey): SortDirection {
    return key === 'security' ? 'asc' : 'desc';
}

// Clicking the currently-active column flips its direction; clicking a new
// column switches to it at that column's default direction.
export function nextSortState(current: SortState, key: SortKey): SortState {
    if (current.key === key) {
        return {
            key,
            direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
    }
    return { key, direction: defaultDirectionFor(key) };
}

function compareNumericField(
    a: HoldingDTO,
    b: HoldingDTO,
    field: 'quantity' | 'price' | 'marketValue'
): number {
    return Number(a[field]) - Number(b[field]);
}

// Ascending comparator per column. "percent" is marketValue divided by a
// constant (the portfolio total), so it produces the same order as
// marketValue - comparing marketValue directly avoids recomputing the
// fraction and sidesteps a portfolioTotal of 0. "costBasis" and "gainLoss"
// are handled separately by sortHoldings since both are nullable and need
// null-specific placement.
function compareAscending(
    a: HoldingDTO,
    b: HoldingDTO,
    key: Exclude<SortKey, 'costBasis' | 'gainLoss'>
): number {
    switch (key) {
        case 'security':
            return holdingLabel(a).localeCompare(holdingLabel(b), 'en-US', {
                sensitivity: 'base',
            });
        case 'quantity':
        case 'price':
            return compareNumericField(a, b, key);
        case 'marketValue':
        case 'percent':
            return compareNumericField(a, b, 'marketValue');
    }
}

function nullableFieldFor(
    h: HoldingDTO,
    key: 'costBasis' | 'gainLoss'
): number | null {
    if (key === 'gainLoss') return holdingGainLoss(h);
    return h.costBasis === null ? null : Number(h.costBasis);
}

// Holdings with no value for the sorted column (Plaid doesn't report cost
// basis for every security type) always sink to the bottom, regardless of
// sort direction, instead of flip-flopping to the top on descending.
function compareNullableNumeric(
    valueA: number | null,
    valueB: number | null,
    sign: number
): number {
    if (valueA === null && valueB === null) return 0;
    if (valueA === null) return 1;
    if (valueB === null) return -1;
    return sign * (valueA - valueB);
}

export function sortHoldings(
    holdings: HoldingDTO[],
    sort: SortState
): HoldingDTO[] {
    const sign = sort.direction === 'asc' ? 1 : -1;
    return [...holdings].sort((a, b) => {
        if (sort.key === 'costBasis' || sort.key === 'gainLoss') {
            return compareNullableNumeric(
                nullableFieldFor(a, sort.key),
                nullableFieldFor(b, sort.key),
                sign
            );
        }
        return sign * compareAscending(a, b, sort.key);
    });
}
