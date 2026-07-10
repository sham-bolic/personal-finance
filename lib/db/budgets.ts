import {
    Budget,
    Prisma,
    PlaidPrimaryCategory,
} from '@/generated/prisma/client';
import { prisma } from '../prisma_client';
import type { BudgetInput, BudgetProgress } from './types';
import { getTotalsByCategory } from './analytics';

function toDateOnly(value?: string): Date {
    return value
        ? new Date(value)
        : new Date(new Date().toISOString().slice(0, 10));
}

/**
 * Set (or update) a user's monthly budget for a category as of effectiveFrom
 * (defaults to today). Upserts on the (userId, category, effectiveFrom)
 * unique key, so repeated edits on the same day update in place; a new day's
 * edit inserts a new row, preserving history for past-month progress lookups.
 */
export async function upsertBudget(
    input: BudgetInput,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Budget> {
    const effectiveFrom = toDateOnly(input.effectiveFrom);

    return db.budget.upsert({
        where: {
            userId_category_effectiveFrom: {
                userId: input.userId,
                category: input.category,
                effectiveFrom,
            },
        },
        update: { monthlyAmount: input.monthlyAmount },
        create: {
            userId: input.userId,
            category: input.category,
            monthlyAmount: input.monthlyAmount,
            effectiveFrom,
        },
    });
}

/**
 * Returns the currently-effective budget per category as of `asOf` (default
 * today) — for each category, the latest row with effectiveFrom <= asOf.
 * Fetched as one query ordered newest-first and reduced to first-per-category
 * in JS, since there are only 16 possible categories.
 */
export async function getBudgetsByUser(
    userId: string,
    asOf?: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Budget[]> {
    const cutoff = toDateOnly(asOf);

    const rows = await db.budget.findMany({
        where: { userId, effectiveFrom: { lte: cutoff } },
        orderBy: { effectiveFrom: 'desc' },
    });

    const byCategory = new Map<PlaidPrimaryCategory, Budget>();
    for (const row of rows) {
        if (!byCategory.has(row.category)) byCategory.set(row.category, row);
    }

    return Array.from(byCategory.values());
}

// Returns the number of rows deleted (0 or 1) so callers can distinguish
// "not found / not yours" from a successful delete.
export async function deleteBudget(
    id: string,
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
    const { count } = await db.budget.deleteMany({ where: { id, userId } });
    return count;
}

/**
 * Spending progress against each currently-effective budget for the given
 * month. Joins getBudgetsByUser (as of the last day of the month, so a
 * mid-month budget change still counts for that month) against
 * getTotalsByCategory grouped by pfcPrimary — no duplicate groupBy logic.
 */
export async function getBudgetProgress(
    userId: string,
    month: string, // 'YYYY-MM'
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<BudgetProgress[]> {
    const [year, monthNum] = month.split('-').map(Number);
    const from = new Date(Date.UTC(year, monthNum - 1, 1))
        .toISOString()
        .slice(0, 10);
    const to = new Date(Date.UTC(year, monthNum, 0)).toISOString().slice(0, 10);

    const [budgets, totals] = await Promise.all([
        getBudgetsByUser(userId, to, db),
        getTotalsByCategory(
            userId,
            { from, to, direction: 'spending', groupBy: 'pfcPrimary' },
            db
        ),
    ]);

    const spentByCategory = new Map(totals.map((t) => [t.category, t.total]));

    return budgets.map((budget) => {
        const spent = spentByCategory.get(budget.category) ?? 0;
        const monthlyAmount = Number(budget.monthlyAmount);
        return {
            id: budget.id,
            category: budget.category,
            monthlyAmount,
            spent,
            remaining: monthlyAmount - spent,
        };
    });
}
