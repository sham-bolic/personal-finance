// Creates (or reuses) a real Supabase user and populates it with Plaid
// sandbox data, budgets, and a goal, so it can be logged into normally at
// /login for local testing. Run with `npm run seed:dev`.
//
// Uses the Supabase service_role key to skip email confirmation on create —
// that key is only ever read here, never by the app itself.
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { Products } from 'plaid';
import { prisma } from '../lib/prisma_client';
import { client as plaidClient } from '../lib/plaid_client';
import { backfillNewItem } from '../lib/plaid_sync';
import {
    getItemsByUser,
    linkPlaidItem,
    getGoalsByUser,
    createGoal,
    addGoalContribution,
    upsertBudget,
    type AccountInput,
} from '../lib/db';
import { PlaidPrimaryCategory } from '../generated/prisma/client';

if (process.env.PLAID_ENV === 'production') {
    throw new Error(
        'Refusing to run: PLAID_ENV=production. This script seeds Plaid sandbox ' +
            'data and must only run against a sandbox/dev project.'
    );
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
}
if (!SERVICE_ROLE_KEY) {
    throw new Error(
        'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Get it from ' +
            'Supabase dashboard -> Project Settings -> API -> service_role secret. ' +
            'Only this script reads it, never the app itself.'
    );
}

const EMAIL = process.env.SEED_DEV_EMAIL ?? 'dev@personal-finance.com';
const PASSWORD = process.env.SEED_DEV_PASSWORD ?? 'DevAccount123!';
const NAME = 'Dev User';

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

async function getOrCreateAuthUser(): Promise<{ id: string; email: string }> {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { name: NAME },
    });
    if (!error) return { id: data.user.id, email: data.user.email! };

    if (!error.message.toLowerCase().includes('already')) throw error;

    // Already exists from a previous run — look it up instead of failing.
    for (let page = 1; ; page++) {
        const { data: list, error: listError } =
            await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
        if (listError) throw listError;

        const existing = list.users.find((u) => u.email === EMAIL);
        if (existing) return { id: existing.id, email: existing.email! };

        if (list.users.length < 200) {
            throw new Error(
                `Signup said "${EMAIL}" already exists but it wasn't found via listUsers`
            );
        }
    }
}

async function seedPlaidItem(userId: string): Promise<number> {
    const existing = await getItemsByUser(userId);
    if (existing.length > 0) {
        console.log('Plaid sandbox item already linked, skipping.');
        return 0;
    }

    const { data: sandboxTokenData } =
        await plaidClient.sandboxPublicTokenCreate({
            institution_id: 'ins_109508', // Plaid's default sandbox institution
            initial_products: [Products.Transactions],
        });

    const { data: exchangeData } = await plaidClient.itemPublicTokenExchange({
        public_token: sandboxTokenData.public_token,
    });

    const { data: accountsData } = await plaidClient.accountsGet({
        access_token: exchangeData.access_token,
    });

    const accounts: AccountInput[] = accountsData.accounts.map((account) => ({
        plaidAccountId: account.account_id,
        name: account.name,
        officialName: account.official_name ?? undefined,
        mask: account.mask ?? undefined,
        type: String(account.type),
        subtype: account.subtype ?? undefined,
        currentBalance: account.balances.current ?? undefined,
        availableBalance: account.balances.available ?? undefined,
        isoCurrencyCode: account.balances.iso_currency_code ?? undefined,
    }));

    const item = await linkPlaidItem({
        userId,
        plaidItemId: exchangeData.item_id,
        accessToken: exchangeData.access_token,
        accounts,
    });

    // Pulls Plaid's pre-seeded sandbox transaction history and derives
    // balance snapshots, same as a real link (see backfillNewItem callers).
    await backfillNewItem(item);

    return accounts.length;
}

async function seedBudgets(userId: string): Promise<number> {
    const budgets = [
        { category: PlaidPrimaryCategory.FOOD_AND_DRINK, monthlyAmount: 500 },
        { category: PlaidPrimaryCategory.ENTERTAINMENT, monthlyAmount: 150 },
        { category: PlaidPrimaryCategory.TRANSPORTATION, monthlyAmount: 200 },
    ];

    await Promise.all(
        budgets.map(({ category, monthlyAmount }) =>
            upsertBudget({ userId, category, monthlyAmount })
        )
    );

    return budgets.length;
}

function monthsAgo(n: number): string {
    const date = new Date();
    date.setMonth(date.getMonth() - n);
    return date.toISOString().slice(0, 10);
}

async function seedGoal(userId: string): Promise<number> {
    const existing = await getGoalsByUser(userId);
    if (existing.length > 0) {
        console.log('Goal already seeded, skipping.');
        return 0;
    }

    const goal = await createGoal({
        userId,
        name: 'Emergency Fund',
        targetAmount: 10000,
        targetDate: '2027-01-01',
    });

    await addGoalContribution({
        goalId: goal.id,
        amount: 1000,
        date: monthsAgo(2),
        note: 'Initial deposit',
    });
    await addGoalContribution({
        goalId: goal.id,
        amount: 500,
        date: monthsAgo(1),
        note: 'Monthly top-up',
    });

    return 1;
}

async function main() {
    console.log(`Seeding dev user ${EMAIL}...`);

    const authUser = await getOrCreateAuthUser();

    const user = await prisma.user.upsert({
        where: { id: authUser.id },
        update: {},
        create: { id: authUser.id, email: authUser.email, name: NAME },
    });

    const accounts = await seedPlaidItem(user.id);
    const budgets = await seedBudgets(user.id);
    const goals = await seedGoal(user.id);

    console.log('\nDone. Log in at /login with:');
    console.log(`  email:    ${EMAIL}`);
    console.log(`  password: ${PASSWORD}`);
    console.log(
        `\nSeeded: ${accounts} account(s), ${budgets} budget(s), ${goals} goal(s).`
    );
}

main()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
