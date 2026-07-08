import { Account } from '@/generated/prisma/client';

export type AccountDTO = Omit<Account, 'currentBalance' | 'availableBalance'> & {
    currentBalance: string | null; // Decimal → string over JSON
    availableBalance: string | null; // Decimal → string over JSON
};
