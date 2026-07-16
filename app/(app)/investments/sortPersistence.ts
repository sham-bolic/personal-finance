// Persists each account's chosen holdings-table sort across reloads and
// navigation, keyed per accountId so tables sort independently. Kept apart
// from sortHoldings.ts so the ordering rules stay pure and this side-effecting
// I/O (and its validation of untrusted stored JSON) lives on its own.

import {
    DEFAULT_SORT,
    type SortDirection,
    type SortKey,
    type SortState,
} from './sortHoldings';

const SORT_KEYS: SortKey[] = [
    'security',
    'quantity',
    'price',
    'marketValue',
    'percent',
];
const SORT_DIRECTIONS: SortDirection[] = ['asc', 'desc'];

function storageKey(accountId: string): string {
    return `investments:sort:${accountId}`;
}

function isSortState(value: unknown): value is SortState {
    if (typeof value !== 'object' || value === null) return false;
    const { key, direction } = value as Record<string, unknown>;
    return (
        SORT_KEYS.includes(key as SortKey) &&
        SORT_DIRECTIONS.includes(direction as SortDirection)
    );
}

export function loadSort(accountId: string): SortState {
    if (typeof window === 'undefined') return DEFAULT_SORT;
    const raw = localStorage.getItem(storageKey(accountId));
    if (!raw) return DEFAULT_SORT;
    try {
        const parsed: unknown = JSON.parse(raw);
        return isSortState(parsed) ? parsed : DEFAULT_SORT;
    } catch {
        return DEFAULT_SORT;
    }
}

export function saveSort(accountId: string, sort: SortState): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(storageKey(accountId), JSON.stringify(sort));
}
