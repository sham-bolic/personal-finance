import { Prisma, Transaction } from '@/generated/prisma/client';
import { prisma } from '../prisma_client';
import type { TransactionInput, ListTransactionsOpts } from './types';

export async function upsertTransactions(
    transactions: TransactionInput[],
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Transaction[]> {
    return Promise.all(
        transactions.map((transaction) => {
            const data = {
                amount: transaction.amount,
                date: new Date(transaction.date),
                authorizedDate: transaction.authorizedDate
                    ? new Date(transaction.authorizedDate)
                    : undefined,
                name: transaction.name,
                merchantName: transaction.merchantName,
                isoCurrencyCode: transaction.isoCurrencyCode,
                pfcPrimary: transaction.pfcPrimary,
                pfcDetailed: transaction.pfcDetailed,
                pending: transaction.pending,
                pendingTransactionId: transaction.pendingTransactionId,
                paymentChannel: transaction.paymentChannel,
            };

            return db.transaction.upsert({
                where: { plaidTransactionId: transaction.plaidTransactionId },
                update: data,
                create: {
                    accountId: transaction.accountId,
                    plaidTransactionId: transaction.plaidTransactionId,
                    ...data,
                },
            });
        })
    );
}

export async function deleteTransactions(
    transactionsIds: string[],
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<void> {
    if (transactionsIds.length === 0) return;
    await db.transaction.deleteMany({
        where: { plaidTransactionId: { in: transactionsIds } },
    });
}

// Read path — from YOUR db, newest first, with optional filters + pagination.
export async function listTransactions(
    userId: string,
    opts: ListTransactionsOpts = {},
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<Transaction[]> {
    const { from, to, accountId, take = 50, cursor } = opts;

    return db.transaction.findMany({
        where: {
            account: { item: { userId } }, // scope to this user via Account -> PlaidItem
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
        orderBy: { date: 'desc' },
        take,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
}
