import { PlaidPrimaryCategory } from '@/generated/prisma/client';

// Plaid's personal_finance_category values are SCREAMING_SNAKE_CASE.
// Shared by free-form Transaction.pfcPrimary/pfcDetailed strings and the
// PlaidPrimaryCategory enum, so there's one formatting rule, not a
// hand-maintained label per enum value.
export function formatPlaidCategory(value: string | null | undefined): string | null {
    if (!value) return null;
    return value
        .toLowerCase()
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export function formatPlaidPrimaryCategory(category: PlaidPrimaryCategory): string {
    return formatPlaidCategory(category)!;
}
