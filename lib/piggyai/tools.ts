import { tool } from 'ai';
import { z } from 'zod';
import { PlaidPrimaryCategory } from '@/generated/prisma/client';
import {
    getTotalsByCategory,
    getCashFlowSummary,
    getTopMerchants,
    getNetWorth,
    getGoalsWithProgress,
    getBudgetProgress,
} from '@/lib/db';

export const PFC_PRIMARY_CATEGORIES = Object.values(PlaidPrimaryCategory);

const dateParam = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Inclusive date bound, 'YYYY-MM-DD'. Omit for no bound.");

// Factory rather than a plain object: userId is captured once in this
// closure, immediately after getCurrentUser() resolves server-side, and
// never appears in any tool's input schema below. That's the enforcement
// mechanism for "the model can never supply or override userId" — there's
// no parameter through which it could.
export function buildPiggyaiTools(userId: string) {
    return {
        getSpendingByCategory: tool({
            description:
                'Get total spending or income grouped by Plaid category for this user, ' +
                "optionally scoped to a date range. Use groupBy 'pfcPrimary' for broad " +
                "categories (e.g. FOOD_AND_DRINK) or 'pfcDetailed' for finer-grained ones " +
                "(e.g. FOOD_AND_DRINK_COFFEE) — prefer 'pfcDetailed' when the user names a " +
                "specific thing like 'coffee', 'groceries', or 'rideshare'.",
            inputSchema: z.object({
                direction: z.enum(['spending', 'income']),
                groupBy: z.enum(['pfcPrimary', 'pfcDetailed']).optional(),
                from: dateParam,
                to: dateParam,
            }),
            execute: async ({ direction, groupBy, from, to }) =>
                getTotalsByCategory(userId, { direction, groupBy, from, to }),
        }),

        getCashFlowSummary: tool({
            description:
                'Get total money in, total money out, and net cash flow for this user ' +
                'over an optional date range.',
            inputSchema: z.object({ from: dateParam, to: dateParam }),
            execute: async ({ from, to }) =>
                getCashFlowSummary(userId, { from, to }),
        }),

        getTopMerchants: tool({
            description:
                'Get the merchants this user spent the most at, optionally scoped to a ' +
                'date range, ranked descending by total spend.',
            inputSchema: z.object({
                from: dateParam,
                to: dateParam,
                limit: z.number().int().positive().max(50).optional(),
            }),
            execute: async ({ from, to, limit }) =>
                getTopMerchants(userId, { from, to, limit }),
        }),

        getNetWorth: tool({
            description:
                "Get this user's current total assets, liabilities, and net worth.",
            inputSchema: z.object({}),
            execute: async () => getNetWorth(userId),
        }),

        getGoals: tool({
            description:
                "Get this user's savings/financial goals with progress: target amount, " +
                'amount contributed so far, amount remaining, and target date.',
            inputSchema: z.object({}),
            execute: async () => getGoalsWithProgress(userId),
        }),

        getBudgetProgress: tool({
            description:
                "Get this user's budget vs. actual spending for a given month, per " +
                'category (monthly budget amount, amount spent, amount remaining).',
            inputSchema: z.object({
                month: z
                    .string()
                    .regex(/^\d{4}-\d{2}$/)
                    .describe("'YYYY-MM'"),
            }),
            execute: async ({ month }) => getBudgetProgress(userId, month),
        }),

        // Deliberately not included in v1:
        // - listTransactions: raw rows aren't how category questions should be
        //   answered (see getSpendingByCategory); a capped
        //   listRecentTransactions tool is a candidate future addition for
        //   "show me the actual transactions" follow-ups.
        // - getNetWorthHistory / getCashFlowHistory: time series is lower
        //   value in a chat answer than a snapshot number.
    };
}
