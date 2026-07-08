export function formatCurrency(value: number, currency: string | null = 'USD') {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency ?? 'USD',
        currencyDisplay: 'narrowSymbol',
    }).format(value);
}
