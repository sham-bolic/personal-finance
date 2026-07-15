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
    getGoalWithProgress,
    getBudgetsByUser,
    getBudgetById,
} from '@/lib/db';
import {
    BUDGETABLE_CATEGORIES,
    formatPlaidPrimaryCategory,
} from '@/lib/plaid_categories';

export const PFC_PRIMARY_CATEGORIES = Object.values(PlaidPrimaryCategory);

const dateParam = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe("Inclusive date bound, 'YYYY-MM-DD'. Omit for no bound.");

const requiredDateParam = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .describe("'YYYY-MM-DD'");

function formatUSD(amount: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        currencyDisplay: 'narrowSymbol',
    }).format(amount);
}

// The shape every proposing (mutating) tool returns. It is never the result
// of a write — execute() for these tools only ever reads — so the model and
// the confirmation card both see the exact same, ground-truth-derived
// description of what would happen. `confirm` is a fully-formed request the
// client can replay byte-for-byte against an existing REST route when the
// user clicks Confirm; no separate client-side logic re-derives it from the
// tool's input, which would risk drifting from what was actually shown.
type ProposalResult =
    | { status: 'not_found'; message: string }
    | {
          status: 'proposed';
          summary: string;
          details: { label: string; value: string }[];
          destructive: boolean;
          confirm: {
              method: 'POST' | 'PATCH' | 'DELETE';
              url: string;
              body?: Record<string, unknown>;
          };
      };

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

        createGoal: tool({
            description:
                'Propose creating a new savings goal for this user. Does NOT ' +
                'create anything — it stages a proposal that the user must ' +
                'explicitly confirm in the UI before the goal is created. Only ' +
                'call this when the user has explicitly asked to create a goal ' +
                'with these details.',
            inputSchema: z.object({
                name: z.string().min(1).max(200),
                targetAmount: z.number().positive(),
                targetDate: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/)
                    .optional()
                    .describe("'YYYY-MM-DD'. Omit if the user gave no date."),
            }),
            execute: async ({
                name,
                targetAmount,
                targetDate,
            }): Promise<ProposalResult> => ({
                status: 'proposed',
                summary: `Create goal "${name}": ${formatUSD(targetAmount)}${targetDate ? ` by ${targetDate}` : ''}`,
                details: [
                    { label: 'Name', value: name },
                    { label: 'Target amount', value: formatUSD(targetAmount) },
                    { label: 'Target date', value: targetDate ?? 'None' },
                ],
                destructive: false,
                confirm: {
                    method: 'POST',
                    url: '/api/goals',
                    body: { name, targetAmount, targetDate, source: 'agent' },
                },
            }),
        }),

        updateGoal: tool({
            description:
                "Propose changing an existing goal's name, target amount, " +
                'target date, or status. Does NOT update anything — it stages ' +
                'a proposal the user must confirm. Requires the goal id (call ' +
                'getGoals first to find it). Only include the fields the user ' +
                'actually wants changed.',
            inputSchema: z
                .object({
                    id: z.string().uuid(),
                    name: z.string().min(1).max(200).optional(),
                    targetAmount: z.number().positive().optional(),
                    targetDate: z
                        .string()
                        .regex(/^\d{4}-\d{2}-\d{2}$/)
                        .nullable()
                        .optional()
                        .describe(
                            "'YYYY-MM-DD', or null to clear an existing target date."
                        ),
                    status: z
                        .enum(['active', 'completed', 'archived'])
                        .optional(),
                })
                .refine(
                    (v) =>
                        v.name !== undefined ||
                        v.targetAmount !== undefined ||
                        v.targetDate !== undefined ||
                        v.status !== undefined,
                    {
                        message:
                            'At least one field to change must be provided.',
                    }
                ),
            execute: async ({
                id,
                name,
                targetAmount,
                targetDate,
                status,
            }): Promise<ProposalResult> => {
                const current = await getGoalWithProgress(id, userId);
                if (!current) {
                    return {
                        status: 'not_found',
                        message: `No goal found with id ${id}.`,
                    };
                }

                const details: { label: string; value: string }[] = [];
                if (name !== undefined && name !== current.name) {
                    details.push({
                        label: 'Name',
                        value: `${current.name} → ${name}`,
                    });
                }
                if (
                    targetAmount !== undefined &&
                    targetAmount !== current.targetAmount
                ) {
                    details.push({
                        label: 'Target amount',
                        value: `${formatUSD(current.targetAmount)} → ${formatUSD(targetAmount)}`,
                    });
                }
                if (
                    targetDate !== undefined &&
                    targetDate !== current.targetDate
                ) {
                    details.push({
                        label: 'Target date',
                        value: `${current.targetDate ?? 'None'} → ${targetDate ?? 'None'}`,
                    });
                }
                if (status !== undefined && status !== current.status) {
                    details.push({
                        label: 'Status',
                        value: `${current.status} → ${status}`,
                    });
                }

                return {
                    status: 'proposed',
                    summary: `Update goal "${current.name}"`,
                    details:
                        details.length > 0
                            ? details
                            : [
                                  {
                                      label: 'Change',
                                      value: 'No fields differ from current values.',
                                  },
                              ],
                    destructive: false,
                    confirm: {
                        method: 'PATCH',
                        url: `/api/goals/${id}`,
                        body: { name, targetAmount, targetDate, status },
                    },
                };
            },
        }),

        deleteGoal: tool({
            description:
                'Propose deleting a goal (and all of its logged ' +
                'contributions). Does NOT delete anything — it stages a ' +
                'proposal the user must confirm. Requires the goal id (call ' +
                'getGoals first to find it).',
            inputSchema: z.object({ id: z.string().uuid() }),
            execute: async ({ id }): Promise<ProposalResult> => {
                const goal = await getGoalWithProgress(id, userId);
                if (!goal) {
                    return {
                        status: 'not_found',
                        message: `No goal found with id ${id}.`,
                    };
                }

                return {
                    status: 'proposed',
                    summary: `Delete goal "${goal.name}"`,
                    details: [
                        {
                            label: 'Target amount',
                            value: formatUSD(goal.targetAmount),
                        },
                        {
                            label: 'Contributed so far',
                            value: formatUSD(goal.contributed),
                        },
                        {
                            label: 'Warning',
                            value: 'This also permanently deletes every contribution logged toward this goal.',
                        },
                    ],
                    destructive: true,
                    confirm: { method: 'DELETE', url: `/api/goals/${id}` },
                };
            },
        }),

        setBudget: tool({
            description:
                'Propose setting (creating or changing) the monthly spending ' +
                'budget for one category. Does NOT set anything — it stages a ' +
                'proposal the user must confirm. category must be one of: ' +
                `${BUDGETABLE_CATEGORIES.join(', ')}.`,
            inputSchema: z.object({
                category: z.enum(BUDGETABLE_CATEGORIES),
                monthlyAmount: z.number().positive(),
                effectiveFrom: z
                    .string()
                    .regex(/^\d{4}-\d{2}-\d{2}$/)
                    .optional()
                    .describe(
                        "'YYYY-MM-DD' this amount takes effect from. Omit to use today."
                    ),
            }),
            execute: async ({
                category,
                monthlyAmount,
                effectiveFrom,
            }): Promise<ProposalResult> => {
                const current = await getBudgetsByUser(userId, effectiveFrom);
                const existing = current.find((b) => b.category === category);
                const categoryLabel = formatPlaidPrimaryCategory(category);

                return {
                    status: 'proposed',
                    summary: existing
                        ? `Change ${categoryLabel} budget: ${formatUSD(Number(existing.monthlyAmount))} → ${formatUSD(monthlyAmount)}`
                        : `Set ${categoryLabel} budget to ${formatUSD(monthlyAmount)}`,
                    details: [
                        { label: 'Category', value: categoryLabel },
                        {
                            label: 'Current amount',
                            value: existing
                                ? formatUSD(Number(existing.monthlyAmount))
                                : 'None',
                        },
                        {
                            label: 'New amount',
                            value: formatUSD(monthlyAmount),
                        },
                        {
                            label: 'Effective from',
                            value: effectiveFrom ?? 'Today',
                        },
                    ],
                    destructive: false,
                    confirm: {
                        method: 'POST',
                        url: '/api/budgets',
                        body: {
                            category,
                            monthlyAmount,
                            effectiveFrom,
                            source: 'agent',
                        },
                    },
                };
            },
        }),

        deleteBudget: tool({
            description:
                "Propose deleting a category's budget entirely. Does NOT " +
                'delete anything — it stages a proposal the user must ' +
                'confirm. Requires the budget id (call getBudgetProgress ' +
                'first to find it).',
            inputSchema: z.object({ id: z.string().uuid() }),
            execute: async ({ id }): Promise<ProposalResult> => {
                const budget = await getBudgetById(id, userId);
                if (!budget) {
                    return {
                        status: 'not_found',
                        message: `No budget found with id ${id}.`,
                    };
                }
                const categoryLabel = formatPlaidPrimaryCategory(
                    budget.category
                );

                return {
                    status: 'proposed',
                    summary: `Delete ${categoryLabel} budget (${formatUSD(Number(budget.monthlyAmount))}/mo)`,
                    details: [
                        { label: 'Category', value: categoryLabel },
                        {
                            label: 'Monthly amount',
                            value: formatUSD(Number(budget.monthlyAmount)),
                        },
                    ],
                    destructive: true,
                    confirm: { method: 'DELETE', url: `/api/budgets/${id}` },
                };
            },
        }),

        logGoalContribution: tool({
            description:
                'Propose logging a contribution (money put toward a goal). ' +
                'Does NOT log anything — it stages a proposal the user must ' +
                'confirm. Requires the goal id (call getGoals first to find ' +
                'it).',
            inputSchema: z.object({
                goalId: z.string().uuid(),
                amount: z.number().positive(),
                date: requiredDateParam
                    .optional()
                    .describe("'YYYY-MM-DD'. Omit to use today."),
                note: z.string().max(500).optional(),
            }),
            execute: async ({
                goalId,
                amount,
                date,
                note,
            }): Promise<ProposalResult> => {
                const goal = await getGoalWithProgress(goalId, userId);
                if (!goal) {
                    return {
                        status: 'not_found',
                        message: `No goal found with id ${goalId}.`,
                    };
                }
                const newContributed = goal.contributed + amount;

                return {
                    status: 'proposed',
                    summary: `Log ${formatUSD(amount)} toward "${goal.name}"`,
                    details: [
                        { label: 'Amount', value: formatUSD(amount) },
                        { label: 'Date', value: date ?? 'Today' },
                        {
                            label: 'New progress',
                            value: `${formatUSD(newContributed)} / ${formatUSD(goal.targetAmount)}`,
                        },
                        ...(note ? [{ label: 'Note', value: note }] : []),
                    ],
                    destructive: false,
                    confirm: {
                        method: 'POST',
                        url: `/api/goals/${goalId}/contributions`,
                        body: { amount, date, note, source: 'agent' },
                    },
                };
            },
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
