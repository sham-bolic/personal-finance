import { prisma } from '@/lib/prisma_client';
import type { Account, Prisma } from '@/generated/prisma/client';
import type { AccountInput } from './types';

/**
 * Upsert the accounts belonging to a linked item. Keyed on plaidAccountId so
 * repeated calls (re-link / balance refresh) update in place instead of
 * duplicating. Pass `db` to enroll in an open transaction; defaults to the
 * global client for standalone use.
 */
export async function upsertAccounts(
    itemId: string,
    accounts: AccountInput[],
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Account[]> {
    return Promise.all(
        accounts.map((account) =>
            db.account.upsert({
                where: { plaidAccountId: account.plaidAccountId },
                update: {
                    name: account.name,
                    officialName: account.officialName,
                    mask: account.mask,
                    type: account.type,
                    subtype: account.subtype,
                    currentBalance: account.currentBalance,
                    availableBalance: account.availableBalance,
                    isoCurrencyCode: account.isoCurrencyCode,
                },
                create: {
                    itemId,
                    plaidAccountId: account.plaidAccountId,
                    name: account.name,
                    officialName: account.officialName,
                    mask: account.mask,
                    type: account.type,
                    subtype: account.subtype,
                    currentBalance: account.currentBalance,
                    availableBalance: account.availableBalance,
                    isoCurrencyCode: account.isoCurrencyCode,
                },
            })
        )
    );
}

export async function getAccountsByItem(
    itemId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Account[]> {
    return db.account.findMany({ where: { itemId } });
}

export async function getAccountsByUser(
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Account[]> {
    return db.account.findMany({ where: { item: { userId } } });
}

/**
 * Record today's currentBalance/availableBalance for every account belonging
 * to a user. Account.currentBalance is overwritten in place on every Plaid
 * sync, so this is the only place that balance history is preserved.
 * Upserts on (accountId, date), so re-running for the same day is safe.
 */
export async function snapshotAccountBalances(
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
    const accounts = await getAccountsByUser(userId, db);
    const date = new Date(new Date().toISOString().slice(0, 10));

    await Promise.all(
        accounts.map((account) =>
            db.accountBalanceSnapshot.upsert({
                where: { accountId_date: { accountId: account.id, date } },
                update: {
                    currentBalance: account.currentBalance ?? 0,
                    availableBalance: account.availableBalance,
                },
                create: {
                    accountId: account.id,
                    date,
                    currentBalance: account.currentBalance ?? 0,
                    availableBalance: account.availableBalance,
                },
            })
        )
    );
}

/**
 * Derive historical daily balances for a newly-linked account from its
 * transaction history, since Plaid has no historical-balance API on the
 * base plan. Walks backward from currentBalance: each transaction's signed
 * amount (Plaid: positive = money out) is exactly the delta that moved the
 * balance, so undoing transactions day-by-day, newest first, recovers the
 * end-of-day balance for every day that had activity.
 *
 * This is an approximation, not a verified historical fact — it only
 * accounts for changes reflected as transactions (misses e.g. unposted
 * interest/fee adjustments), and only reaches as far back as the oldest
 * transaction Plaid returned.
 */
export async function backfillAccountBalanceHistory(
    accountId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
    const account = await db.account.findUniqueOrThrow({
        where: { id: accountId },
    });
    if (account.currentBalance == null) return;

    const dailyNet = await db.transaction.groupBy({
        by: ['date'],
        where: { accountId },
        _sum: { amount: true },
        orderBy: { date: 'desc' },
    });
    if (dailyNet.length === 0) return;

    // Newest first: `runningBalance` starts as the end-of-day balance for the
    // most recent date with activity (equal to currentBalance, since nothing
    // has moved the balance since then) and steps backward one day at a time,
    // undoing each day's net movement to recover the balance before it.
    let runningBalance = Number(account.currentBalance);

    await Promise.all(
        dailyNet.map(({ date, _sum }) => {
            const balance = runningBalance;
            runningBalance += Number(_sum.amount ?? 0);

            return db.accountBalanceSnapshot.upsert({
                where: { accountId_date: { accountId, date } },
                update: { currentBalance: balance },
                create: { accountId, date, currentBalance: balance },
            });
        })
    );
}
