import { Goal, GoalContribution, Prisma } from '@/generated/prisma/client';
import { prisma } from '../prisma_client';
import type {
    GoalInput,
    GoalUpdateInput,
    GoalContributionInput,
    GoalWithProgress,
} from './types';

function toDateOnly(value?: string): Date {
    return value
        ? new Date(value)
        : new Date(new Date().toISOString().slice(0, 10));
}

export async function createGoal(
    input: GoalInput,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Goal> {
    return db.goal.create({
        data: {
            userId: input.userId,
            name: input.name,
            targetAmount: input.targetAmount,
            targetDate: input.targetDate
                ? toDateOnly(input.targetDate)
                : undefined,
        },
    });
}

export async function getGoalsByUser(
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Goal[]> {
    return db.goal.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
    });
}

// Scoped by both id and userId, for route-level ownership checks.
export async function getGoalById(
    id: string,
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Goal | null> {
    return db.goal.findFirst({ where: { id, userId } });
}

export async function updateGoal(
    id: string,
    userId: string,
    data: GoalUpdateInput,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Goal> {
    const { count } = await db.goal.updateMany({
        where: { id, userId },
        data: {
            name: data.name,
            targetAmount: data.targetAmount,
            targetDate:
                data.targetDate === undefined
                    ? undefined
                    : data.targetDate === null
                      ? null
                      : toDateOnly(data.targetDate),
            status: data.status,
        },
    });
    if (count === 0) throw new Error('Goal not found');

    return db.goal.findUniqueOrThrow({ where: { id } });
}

// Returns the number of rows deleted (0 or 1) so callers can distinguish
// "not found / not yours" from a successful delete. Cascades to contributions.
export async function deleteGoal(
    id: string,
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
    const { count } = await db.goal.deleteMany({ where: { id, userId } });
    return count;
}

// Append-only — unlike AccountBalanceSnapshot, a goal can receive multiple
// contributions on the same day, so this is a plain create, not an upsert.
export async function addGoalContribution(
    input: GoalContributionInput,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<GoalContribution> {
    return db.goalContribution.create({
        data: {
            goalId: input.goalId,
            amount: input.amount,
            date: toDateOnly(input.date),
            note: input.note,
        },
    });
}

export async function listGoalContributions(
    goalId: string,
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<GoalContribution[]> {
    return db.goalContribution.findMany({
        where: { goalId, goal: { userId } },
        orderBy: { date: 'desc' },
    });
}

// Returns the number of rows deleted (0 or 1) so callers can distinguish
// "not found / not yours" from a successful delete. Scoped through the
// goal.userId relation, same ownership pattern as listGoalContributions.
export async function deleteGoalContribution(
    id: string,
    goalId: string,
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<number> {
    const { count } = await db.goalContribution.deleteMany({
        where: { id, goalId, goal: { userId } },
    });
    return count;
}

function toGoalWithProgress(goal: Goal, contributed: number): GoalWithProgress {
    const targetAmount = Number(goal.targetAmount);
    return {
        id: goal.id,
        name: goal.name,
        targetAmount,
        targetDate: goal.targetDate
            ? goal.targetDate.toISOString().slice(0, 10)
            : null,
        status: goal.status,
        contributed,
        remaining: targetAmount - contributed,
    };
}

export async function getGoalWithProgress(
    id: string,
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<GoalWithProgress | null> {
    const goal = await getGoalById(id, userId, db);
    if (!goal) return null;

    const agg = await db.goalContribution.aggregate({
        where: { goalId: id },
        _sum: { amount: true },
    });

    return toGoalWithProgress(goal, Number(agg._sum.amount ?? 0));
}

export async function getGoalsWithProgress(
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<GoalWithProgress[]> {
    const [goals, sums] = await Promise.all([
        getGoalsByUser(userId, db),
        db.goalContribution.groupBy({
            by: ['goalId'],
            where: { goal: { userId } },
            _sum: { amount: true },
        }),
    ]);

    const contributedByGoal = new Map(
        sums.map((s) => [s.goalId, Number(s._sum.amount ?? 0)])
    );

    return goals.map((goal) =>
        toGoalWithProgress(goal, contributedByGoal.get(goal.id) ?? 0)
    );
}
