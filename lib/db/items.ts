import { prisma } from '@/lib/prisma_client';
import type { PlaidItem, Prisma } from '@/generated/prisma/client';
import { upsertAccounts } from './accounts';
import { encrypt } from '../crypto';
import type { PlaidItemInput, AccountInput } from './types';

/**
 * Upsert a single Plaid item. Keyed on plaidItemId. Pass `db` to enroll in an
 * open transaction; defaults to the global client for standalone use.
 */
export async function upsertPlaidItem(
    input: PlaidItemInput,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<PlaidItem> {
    const encrypted_token = encrypt(input.accessToken);

    return db.plaidItem.upsert({
        where: { plaidItemId: input.plaidItemId },
        update: {
            accessToken: encrypted_token,
            institutionId: input.institutionId,
            institutionName: input.institutionName,
            status: 'active', // re-link clears any prior error state
        },
        create: {
            userId: input.userId,
            plaidItemId: input.plaidItemId,
            accessToken: encrypted_token,
            institutionId: input.institutionId,
            institutionName: input.institutionName,
        },
    });
}

/**
 * Persist a freshly-linked item and its accounts atomically. This is the
 * single entry point the exchange route calls — the transaction lives here,
 * not in the route.
 */
export async function linkPlaidItem(
    input: PlaidItemInput & { accounts: AccountInput[] }
): Promise<PlaidItem> {
    return prisma.$transaction(async (tx) => {
        const item = await upsertPlaidItem(input, tx);
        await upsertAccounts(item.id, input.accounts, tx);
        return item;
    });
}

export async function getItemsByUser(
    userId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<PlaidItem[]> {
    return await db.plaidItem.findMany({ where: { userId } });
}

export async function updateSyncCursor(id: string, syncCursor: string) {
    await prisma.plaidItem.update({
        where: { id },
        data: { syncCursor, lastSyncedAt: new Date() },
    });
}
