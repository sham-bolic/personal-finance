import { useCallback, useSyncExternalStore } from 'react';
import { TIME_SCALES, TimeScale } from './time-range';

// Dates arrive as plain 'YYYY-MM-DD' with no time component. `new Date(date)`
// parses that as UTC midnight, so formatting it in the browser's local
// timezone (anything west of UTC) rolls it back a day. Build the Date from
// local year/month/day parts instead, so the calendar date matches what's
// actually in the data regardless of timezone.
export function parseLocalDate(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
}

// The x-axis plots real elapsed time (see NetWorthChart/CashFlowHistoryChart),
// which needs a numeric domain — this is the single place a 'YYYY-MM-DD'
// string becomes the timestamp that domain is built from.
export function dateToTimestamp(date: string): number {
    return parseLocalDate(date).getTime();
}

export function formatAxisDate(ts: number, scale: TimeScale) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    if (scale === 'week' || scale === 'month') {
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
        });
    }
    // Full 4-digit year, not '2-digit' — "Apr 26" reads as day-26 rather than
    // year-2026 at a glance, which is exactly the ambiguity this avoids.
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Axis ticks abbreviate to month+year at Year/5Y scale to avoid clutter, but
// the hover readout should always show the exact date regardless of scale —
// otherwise every point in the same month reads as "Apr 26" (April 2026), no
// day at all.
export function formatTooltipDate(ts: number) {
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

// The x-axis is a true time scale (see NetWorthChart/CashFlowHistoryChart),
// so ticks can land on any calendar boundary — they no longer have to match
// a date that actually exists in the (possibly sparse) dataset. At
// 'year'/'5year' scale, where formatAxisDate only shows month+year, picking
// one tick per calendar month/year keeps every rendered label distinct
// instead of letting the axis's auto-spacing repeat the same label.
export function computeTicks(
    scale: TimeScale,
    from: string,
    to: string
): number[] | undefined {
    if (scale === 'week' || scale === 'month') return undefined; // day-level labels are already unique

    const start = parseLocalDate(from);
    const end = parseLocalDate(to);
    const ticks: number[] = [];

    if (scale === 'year') {
        const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
        while (cursor <= end) {
            ticks.push(cursor.getTime());
            cursor.setMonth(cursor.getMonth() + 1);
        }
    } else {
        const cursor = new Date(start.getFullYear(), 0, 1);
        while (cursor <= end) {
            ticks.push(cursor.getTime());
            cursor.setFullYear(cursor.getFullYear() + 1);
        }
    }
    return ticks;
}

// localStorage is read via useSyncExternalStore rather than mirrored into
// useState, matching the ThemeToggle pattern: getServerSnapshot always
// returns defaultScale (avoiding a hydration mismatch), and the hook
// re-syncs to the persisted value right after hydration. A same-tab custom
// event stands in for the 'storage' event, which only fires in other tabs.
function persistedScaleChangedEvent(storageKey: string) {
    return `persisted-scale-changed:${storageKey}`;
}

export function usePersistedScale(
    storageKey: string,
    defaultScale: TimeScale = 'month'
): [TimeScale, (scale: TimeScale) => void] {
    const subscribe = useCallback(
        (callback: () => void) => {
            const eventName = persistedScaleChangedEvent(storageKey);
            window.addEventListener('storage', callback);
            window.addEventListener(eventName, callback);
            return () => {
                window.removeEventListener('storage', callback);
                window.removeEventListener(eventName, callback);
            };
        },
        [storageKey]
    );

    const getSnapshot = useCallback((): TimeScale => {
        const stored = localStorage.getItem(storageKey);
        return TIME_SCALES.some((s) => s.value === stored)
            ? (stored as TimeScale)
            : defaultScale;
    }, [storageKey, defaultScale]);

    const getServerSnapshot = useCallback(() => defaultScale, [defaultScale]);

    const scale = useSyncExternalStore(
        subscribe,
        getSnapshot,
        getServerSnapshot
    );

    const setScale = useCallback(
        (next: TimeScale) => {
            localStorage.setItem(storageKey, next);
            window.dispatchEvent(
                new Event(persistedScaleChangedEvent(storageKey))
            );
        },
        [storageKey]
    );

    return [scale, setScale];
}

export function ScaleSelector({
    scale,
    onChange,
}: {
    scale: TimeScale;
    onChange: (scale: TimeScale) => void;
}) {
    return (
        <div className="inline-flex rounded-lg border border-border p-0.5 text-xs">
            {TIME_SCALES.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={`cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors ${
                        scale === option.value
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-surface-hover'
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

export function ChartSkeleton() {
    return (
        <div className="mt-4 h-72 w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
    );
}
