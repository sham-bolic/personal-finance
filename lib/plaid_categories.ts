import { PlaidPrimaryCategory } from '@/generated/prisma/enums';

// Categories a user can set a spending budget against. Excludes inflow
// categories (income, transfers in) — those aren't spending, so "budgeting"
// them doesn't make sense. Sorted alphabetically by label for the category
// picker.
export const BUDGETABLE_CATEGORIES = Object.values(PlaidPrimaryCategory)
    .filter((category) => category !== 'INCOME' && category !== 'TRANSFER_IN')
    .sort((a, b) =>
        formatPlaidCategory(a)!.localeCompare(formatPlaidCategory(b)!)
    );

// Plaid's personal_finance_category values are SCREAMING_SNAKE_CASE.
// Shared by free-form Transaction.pfcPrimary/pfcDetailed strings and the
// PlaidPrimaryCategory enum, so there's one formatting rule, not a
// hand-maintained label per enum value.
export function formatPlaidCategory(
    value: string | null | undefined
): string | null {
    if (!value) return null;
    return value
        .toLowerCase()
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export function formatPlaidPrimaryCategory(
    category: PlaidPrimaryCategory
): string {
    return formatPlaidCategory(category)!;
}
