// Shared progress bar for goals (contributed/target) and budgets
// (spent/limit). Color escalates as `value` approaches or exceeds `max`,
// since "close to the limit" and "over the limit" mean different things
// for a budget than a plain completion percentage would suggest.
export function ProgressBar({
    value,
    max,
    className = '',
}: {
    value: number;
    max: number;
    className?: string;
}) {
    const ratio = max > 0 ? value / max : 0;
    const pct = Math.min(100, Math.max(0, ratio * 100));

    const fillColor =
        ratio >= 1 ? 'bg-negative' : ratio >= 0.8 ? 'bg-warning' : 'bg-primary';

    return (
        <div
            role="progressbar"
            aria-valuenow={Math.round(pct)}
            aria-valuemin={0}
            aria-valuemax={100}
            className={`h-2 w-full overflow-hidden rounded-full bg-muted ${className}`}
        >
            <div
                className={`h-full rounded-full transition-[width] duration-300 ${fillColor}`}
                style={{ width: `${pct}%` }}
            />
        </div>
    );
}
