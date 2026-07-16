import { prisma } from '@/lib/prisma_client';
import type { Prisma } from '@/generated/prisma/client';
import { getAccountsByItem } from './accounts';
import type { HoldingInput, SecurityInput } from './types';

/**
 * Does this item have at least one investment-type account? Used to gate the
 * investments sync so checking-only items never trigger an investmentsHoldingsGet
 * call (which would error for them anyway).
 */
export async function itemHasInvestmentAccount(
    itemId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma
): Promise<boolean> {
    const count = await db.account.count({
        where: { itemId, type: 'investment' },
    });
    return count > 0;
}

/**
 * Upsert one security and return its internal id. Tickered securities are
 * global/shared and dedupe on (tickerSymbol, type) - two users holding AAPL
 * resolve to the same row. Tickerless securities (e.g. cash) have no shared
 * identity, so they fall back to Plaid's per-item security_id via
 * plaidSecurityId. plaidSecurityId is deliberately left null on tickered rows
 * so its unique index never collides across items sharing a ticker.
 */
async function upsertSecurity(
    db: Prisma.TransactionClient | typeof prisma,
    sec: SecurityInput
): Promise<string> {
    const type = sec.type ?? 'unknown';
    const closePriceAsOf = sec.closePriceAsOf
        ? new Date(sec.closePriceAsOf)
        : undefined;

    const shared = {
        name: sec.name,
        closePrice: sec.closePrice,
        closePriceAsOf,
        isoCurrencyCode: sec.isoCurrencyCode,
    };

    if (sec.tickerSymbol) {
        const row = await db.security.upsert({
            where: {
                tickerSymbol_type: { tickerSymbol: sec.tickerSymbol, type },
            },
            update: shared,
            create: { tickerSymbol: sec.tickerSymbol, type, ...shared },
        });
        return row.id;
    }

    const row = await db.security.upsert({
        where: { plaidSecurityId: sec.plaidSecurityId },
        update: { type, ...shared },
        create: { plaidSecurityId: sec.plaidSecurityId, type, ...shared },
    });
    return row.id;
}

/**
 * Reconcile an item's current holdings against what Plaid last returned, in one
 * transaction: upsert the referenced securities, upsert every holding, and
 * delete any holding row for this item's accounts that Plaid no longer reports
 * (a fully-sold position). Holdings are current-only - there is no history.
 *
 * `securities` and `holdings` come straight from a single investmentsHoldingsGet
 * response (mapped to input shapes); a holding references its security by
 * Plaid's per-item security_id, which is resolved here.
 */
export async function reconcileHoldings(
    itemId: string,
    securities: SecurityInput[],
    holdings: HoldingInput[]
): Promise<void> {
    // Securities are global, idempotent reference data with no atomicity tie to
    // this item's holdings, so upsert them first, outside the transaction. That
    // keeps the transaction scoped to just the holdings reconcile below, so a
    // large portfolio can't blow the interactive-transaction timeout on the
    // (potentially many) security upserts. security_id -> internal Security.id.
    const securityIdByPlaidId = new Map<string, string>();
    for (const sec of securities) {
        securityIdByPlaidId.set(
            sec.plaidSecurityId,
            await upsertSecurity(prisma, sec)
        );
    }

    await prisma.$transaction(async (tx) => {
        const accounts = await getAccountsByItem(itemId, tx);
        const accountIdByPlaidId = new Map(
            accounts.map((a) => [a.plaidAccountId, a.id])
        );

        const keptHoldingIds: string[] = [];
        for (const holding of holdings) {
            const accountId = accountIdByPlaidId.get(holding.plaidAccountId);
            if (!accountId) {
                throw new Error(
                    `Holdings reconcile failed for item ${itemId}: holding references ` +
                        `unknown Plaid account_id ${holding.plaidAccountId} ` +
                        `(accounts may be out of date, re-link or refresh accounts)`
                );
            }
            const securityId = securityIdByPlaidId.get(holding.plaidSecurityId);
            if (!securityId) {
                throw new Error(
                    `Holdings reconcile failed for item ${itemId}: holding references ` +
                        `security_id ${holding.plaidSecurityId} not present in the ` +
                        `response's securities list`
                );
            }

            const data = {
                quantity: holding.quantity,
                costBasis: holding.costBasis,
                marketValue: holding.marketValue,
                price: holding.price,
                isoCurrencyCode: holding.isoCurrencyCode,
            };
            const row = await tx.holding.upsert({
                where: { accountId_securityId: { accountId, securityId } },
                update: data,
                create: { accountId, securityId, ...data },
            });
            keptHoldingIds.push(row.id);
        }

        // Drop positions Plaid no longer returns for this item's accounts. With
        // keptHoldingIds empty (everything sold), notIn: [] excludes nothing and
        // removes every holding on these accounts.
        await tx.holding.deleteMany({
            where: {
                accountId: { in: Array.from(accountIdByPlaidId.values()) },
                id: { notIn: keptHoldingIds },
            },
        });
    });
}
