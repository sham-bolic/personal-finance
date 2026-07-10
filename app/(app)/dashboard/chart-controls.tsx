import { TIME_SCALES, TimeScale } from './time-range';

// Dates arrive as plain 'YYYY-MM-DD' with no time component. `new Date(date)`
// parses that as UTC midnight, so formatting it in the browser's local
// timezone (anything west of UTC) rolls it back a day. Build the Date from
// local year/month/day parts instead, so the calendar date matches what's
// actually in the data regardless of timezone.
function parseLocalDate(date: string): Date {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(year, month - 1, day);
}

export function formatAxisDate(date: string, scale: TimeScale) {
    const d = parseLocalDate(date);
    if (Number.isNaN(d.getTime())) return date;
    if (scale === 'week' || scale === 'month') {
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    // Full 4-digit year, not '2-digit' — "Apr 26" reads as day-26 rather than
    // year-2026 at a glance, which is exactly the ambiguity this avoids.
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Axis ticks abbreviate to month+year at Year/5Y scale to avoid clutter, but
// the tooltip should always show the exact date being hovered regardless of
// scale — otherwise every point in the same month reads as "Apr 26" (April
// 2026), no day at all.
export function formatTooltipDate(date: string) {
    const d = parseLocalDate(date);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

// Recharts' category axis auto-picks tick positions by evenly spacing array
// indices, not calendar boundaries. At 'year'/'5year' scale — where
// formatAxisDate only shows month+year, no day — index-based spacing can
// place several ticks inside the same month, rendering the identical label
// multiple times in a row. Pick one representative date per calendar bucket
// instead, so every rendered tick is visually distinct.
export function computeTicks(
    dates: string[],
    scale: TimeScale
): string[] | undefined {
    if (scale === 'week' || scale === 'month') return undefined; // day-level labels are already unique

    const bucketOf = (date: string) =>
        scale === 'year' ? date.slice(0, 7) : date.slice(0, 4); // YYYY-MM or YYYY

    const seen = new Set<string>();
    const ticks: string[] = [];
    for (const date of dates) {
        const bucket = bucketOf(date);
        if (!seen.has(bucket)) {
            seen.add(bucket);
            ticks.push(date);
        }
    }
    return ticks;
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
        <div className="mt-4 h-64 w-full animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
    );
}
