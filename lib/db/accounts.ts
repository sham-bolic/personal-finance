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
