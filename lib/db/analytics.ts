import { Prisma } from '@/generated/prisma/client';
import { prisma } from '../prisma_client';
import {
    CategoryTotal,
    CategoryTotalsOpts,
    CashFlowOpts,
    CashFlowSummary,
    TopMerchantsOpts,
    MerchantTotal,
    AccountTypeTotal,
    NetWorth,
    NetWorthHistoryOpts,
    NetWorthHistoryPoint,
    CashFlowHistoryOpts,
    CashFlowHistoryPoint,
    PortfolioValueHistoryOpts,
    PortfolioValueHistoryPoint,
} from './types';

export async function getTotalsByCategory(
    userId: string,
    opts: CategoryTotalsOpts,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<CategoryTotal[]> {
    const { from, to, accountId, direction, groupBy = 'pfcDetailed' } = opts;

    const rows = await db.transaction.groupBy({
        by: [groupBy],
        where: {
            account: { item: { userId } },
            amount: direction === 'spending' ? { gt: 0 } : { lt: 0 },
            ...(accountId ? { accountId } : {}),
            ...(from || to
                ? {
                      date: {
                          gte: from ? new Date(from) : undefined,
                          lte: to ? new Date(to) : undefined,
                      },
                  }
                : {}),
        },
        _sum: { amount: true },
        _count: true,
        orderBy: {
            _sum: { amount: direction === 'spending' ? 'desc' : 'asc' },
        },
    });

    return rows.map((r) => ({
        category: r[groupBy] ?? 'Uncategorized',
        total: Math.abs(Number(r._sum.amount ?? 0)),
        count: r._count,
    }));
}

export async function getCashFlowSummary(
    userId: string,
    opts: CashFlowOpts = {},
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<CashFlowSummary> {
    const { from, to, accountId } = opts;

    const baseWhere = {
        account: { item: { userId } },
        ...(accountId ? { accountId } : {}),
        ...(from || to
            ? {
                  date: {
                      gte: from ? new Date(from) : undefined,
                      lte: to ? new Date(to) : undefined,
                  },
              }
            : {}),
    };

    const [outAgg, inAgg] = await Promise.all([
        db.transaction.aggregate({
            where: { ...baseWhere, amount: { gt: 0 } },
            _sum: { amount: true },
        }),
        db.transaction.aggregate({
            where: { ...baseWhere, amount: { lt: 0 } },
            _sum: { amount: true },
        }),
    ]);

    const totalOut = Number(outAgg._sum.amount ?? 0);
    const totalIn = Math.abs(Number(inAgg._sum.amount ?? 0));

    return { totalIn, totalOut, net: totalIn - totalOut };
}

export async function getTopMerchants(
    userId: string,
    opts: TopMerchantsOpts = {},
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<MerchantTotal[]> {
    const { from, to, accountId, limit = 10 } = opts;

    const rows = await db.transaction.groupBy({
        by: ['merchantName'],
        where: {
            account: { item: { userId } },
            merchantName: { not: null },
            amount: { gt: 0 }, // spend only — merchants don't pay you
            ...(accountId ? { accountId } : {}),
            ...(from || to
                ? {
                      date: {
                          gte: from ? new Date(from) : undefined,
                          lte: to ? new Date(to) : undefined,
                      },
                  }
                : {}),
        },
        _sum: { amount: true },
        _count: true,
        orderBy: { _sum: { amount: 'desc' } },
        take: limit,
    });

    return rows.map((r) => ({
        merchantName: r.merchantName ?? 'Unknown',
        total: Number(r._sum.amount ?? 0),
        count: r._count,
    }));
}

// Sums Account.currentBalance grouped by type — the raw material for
// getNetWorth. Kept separate since "balances by type" is also useful on its
// own (e.g. showing checking vs. savings vs. credit card totals in the UI).
export async function getBalancesByAccountType(
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<AccountTypeTotal[]> {
    const rows = await db.account.groupBy({
        by: ['type'],
        where: { item: { userId } },
        _sum: { currentBalance: true },
    });

    return rows.map((r) => ({
        type: r.type,
        total: Number(r._sum.currentBalance ?? 0),
    }));
}

const LIABILITY_ACCOUNT_TYPES = new Set(['credit', 'loan']);

export async function getNetWorth(
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<NetWorth> {
    const balances = await getBalancesByAccountType(userId, db);

    const { assets, liabilities } = balances.reduce(
        (acc, { type, total }) => {
            if (LIABILITY_ACCOUNT_TYPES.has(type)) {
                acc.liabilities += total;
            } else {
                acc.assets += total;
            }
            return acc;
        },
        { assets: 0, liabilities: 0 }
    );

    return { assets, liabilities, net: assets - liabilities };
}

// Net worth over time, built from AccountBalanceSnapshot rather than live
// Account.currentBalance (which only reflects today). Account.type is read
// live rather than denormalized onto the snapshot, so a Plaid reclassification
// (e.g. a mislabeled account type getting corrected) applies retroactively.
export async function getNetWorthHistory(
    userId: string,
    opts: NetWorthHistoryOpts = {},
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<NetWorthHistoryPoint[]> {
    const { from, to } = opts;

    const snapshots = await db.accountBalanceSnapshot.findMany({
        where: {
            account: { item: { userId } },
            ...(from || to
                ? {
                      date: {
                          gte: from ? new Date(from) : undefined,
                          lte: to ? new Date(to) : undefined,
                      },
                  }
                : {}),
        },
        select: {
            date: true,
            currentBalance: true,
            account: { select: { type: true } },
        },
        orderBy: { date: 'asc' },
    });

    const byDate = new Map<string, { assets: number; liabilities: number }>();

    for (const snapshot of snapshots) {
        const dateKey = snapshot.date.toISOString().slice(0, 10);
        const totals = byDate.get(dateKey) ?? { assets: 0, liabilities: 0 };
        const balance = Number(snapshot.currentBalance);

        if (LIABILITY_ACCOUNT_TYPES.has(snapshot.account.type)) {
            totals.liabilities += balance;
        } else {
            totals.assets += balance;
        }

        byDate.set(dateKey, totals);
    }

    return Array.from(byDate.entries()).map(
        ([date, { assets, liabilities }]) => ({
            date,
            assets,
            liabilities,
            net: assets - liabilities,
        })
    );
}

// Total invested value over time, summed across a user's investment accounts.
// Built from AccountBalanceSnapshot (not live Holding rows, which have no
// history): for an investment account, currentBalance is the account's total
// market value on that day, so summing it per date reconstructs portfolio
// value. Account.type is read live rather than denormalized, matching
// getNetWorthHistory, so a Plaid reclassification applies retroactively.
export async function getPortfolioValueHistory(
    userId: string,
    opts: PortfolioValueHistoryOpts = {},
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<PortfolioValueHistoryPoint[]> {
    const { from, to } = opts;

    const snapshots = await db.accountBalanceSnapshot.findMany({
        where: {
            account: { item: { userId }, type: 'investment' },
            ...(from || to
                ? {
                      date: {
                          gte: from ? new Date(from) : undefined,
                          lte: to ? new Date(to) : undefined,
                      },
                  }
                : {}),
        },
        select: {
            date: true,
            currentBalance: true,
        },
        orderBy: { date: 'asc' },
    });

    const byDate = new Map<string, number>();

    for (const snapshot of snapshots) {
        const dateKey = snapshot.date.toISOString().slice(0, 10);
        const value = byDate.get(dateKey) ?? 0;
        byDate.set(dateKey, value + Number(snapshot.currentBalance));
    }

    return Array.from(byDate.entries()).map(([date, value]) => ({
        date,
        value,
    }));
}

// Daily spend/income plus running cumulative totals, built from Transaction
// rows (not AccountBalanceSnapshot — balances don't distinguish spend/income,
// and deltas would conflate transfers between the user's own accounts with
// real cash flow). Two groupBys (one per sign) mirror the two-aggregate split
// already used in getCashFlowSummary, since a single groupBy's _sum can't
// separate positive and negative amounts within the same date bucket — the
// DB aggregates each sign's rows down to one row per date, rather than
// pulling every individual transaction row back to sum in JS.
export async function getCashFlowHistory(
    userId: string,
    opts: CashFlowHistoryOpts = {},
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<CashFlowHistoryPoint[]> {
    const { from, to, accountId } = opts;

    const baseWhere = {
        account: { item: { userId } },
        ...(accountId ? { accountId } : {}),
        ...(from || to
            ? {
                  date: {
                      gte: from ? new Date(from) : undefined,
                      lte: to ? new Date(to) : undefined,
                  },
              }
            : {}),
    };

    const [spendRows, incomeRows] = await Promise.all([
        db.transaction.groupBy({
            by: ['date'],
            where: { ...baseWhere, amount: { gt: 0 } },
            _sum: { amount: true },
        }),
        db.transaction.groupBy({
            by: ['date'],
            where: { ...baseWhere, amount: { lt: 0 } },
            _sum: { amount: true },
        }),
    ]);

    const byDate = new Map<string, { income: number; spend: number }>();

    for (const row of spendRows) {
        const dateKey = row.date.toISOString().slice(0, 10);
        const totals = byDate.get(dateKey) ?? { income: 0, spend: 0 };
        totals.spend += Number(row._sum.amount ?? 0);
        byDate.set(dateKey, totals);
    }

    for (const row of incomeRows) {
        const dateKey = row.date.toISOString().slice(0, 10);
        const totals = byDate.get(dateKey) ?? { income: 0, spend: 0 };
        totals.income += Math.abs(Number(row._sum.amount ?? 0));
        byDate.set(dateKey, totals);
    }

    const sortedDates = Array.from(byDate.keys()).sort();

    let cumulativeIncome = 0;
    let cumulativeSpend = 0;

    return sortedDates.map((date) => {
        const { income, spend } = byDate.get(date)!;
        cumulativeIncome += income;
        cumulativeSpend += spend;
        return { date, income, spend, cumulativeIncome, cumulativeSpend };
    });
}
