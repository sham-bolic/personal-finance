import { Prisma, Transaction } from '@/generated/prisma/client';
import { prisma } from '../prisma_client';
import type { TransactionInput } from './types';

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
