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
} from './types';

export async function getTotalsByCategory(
    userId: string,
    opts: CategoryTotalsOpts,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<CategoryTotal[]> {
    const { from, to, accountId, direction } = opts;

    const rows = await db.transaction.groupBy({
        by: ['pfcDetailed'],
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
        orderBy: { _sum: { amount: direction === 'spending' ? 'desc' : 'asc' } },
    });

    return rows.map((r) => ({
        category: r.pfcDetailed ?? 'Uncategorized',
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
