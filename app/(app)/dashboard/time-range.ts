export type TimeScale = 'week' | 'month' | 'year' | '5year';

export const TIME_SCALES: { value: TimeScale; label: string }[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: '5year', label: '5Y' },
];

export function rangeForScale(scale: TimeScale): { from: string; to: string } {
    const to = new Date();
    const from = new Date(to);

    if (scale === 'week') {
        const daysSinceMonday = (from.getDay() + 6) % 7; // getDay(): 0=Sun..6=Sat
        from.setDate(from.getDate() - daysSinceMonday);
    }
    if (scale === 'month') from.setDate(1); // calendar month-to-date, not a rolling 30 days
    if (scale === 'year') from.setFullYear(from.getFullYear() - 1);
    if (scale === '5year') from.setFullYear(from.getFullYear() - 5);

    return {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
    };
}
