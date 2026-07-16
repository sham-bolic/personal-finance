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

    const existing = await db.plaidItem.findUnique({
        where: { plaidItemId: input.plaidItemId },
    });

    if (existing && existing.userId !== input.userId) {
        throw new Error(
            `plaidItemId ${input.plaidItemId} is already linked to a different user`
        );
    }

    return db.plaidItem.upsert({
        where: { plaidItemId: input.plaidItemId },
        update: {
            accessToken: encrypted_token,
            institutionId: input.institutionId,
            institutionName: input.institutionName,
            status: 'active', // re-link clears any prior error state
            // Only ever promote consent to true - a re-link should never
            // silently revoke a previously-granted investments consent.
            ...(input.investmentsConsented
                ? { investmentsConsented: true }
                : {}),
        },
        create: {
            userId: input.userId,
            plaidItemId: input.plaidItemId,
            accessToken: encrypted_token,
            institutionId: input.institutionId,
            institutionName: input.institutionName,
            investmentsConsented: input.investmentsConsented ?? false,
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

/**
 * Fetch a single item scoped to its owner. Returns null if the item does not
 * exist or belongs to a different user - callers must treat null as not-found
 * without leaking whether the id exists.
 */
export async function getItemById(
    userId: string,
    id: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<PlaidItem | null> {
    return await db.plaidItem.findFirst({ where: { id, userId } });
}

/**
 * Record that Investments consent has been granted for an item (after an
 * update-mode reconnect). Scoped to the owner; returns the number of rows
 * updated so the caller can distinguish not-found (0) from success (1).
 */
export async function setInvestmentsConsented(
    userId: string,
    id: string
): Promise<number> {
    const { count } = await prisma.plaidItem.updateMany({
        where: { id, userId },
        data: { investmentsConsented: true },
    });
    return count;
}

export async function updateSyncCursor(id: string, syncCursor: string) {
    await prisma.plaidItem.update({
        where: { id },
        data: { syncCursor, lastSyncedAt: new Date() },
    });
}
