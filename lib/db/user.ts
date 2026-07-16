import { prisma } from '@/lib/prisma_client';
import { createClient } from '@/lib/supabase/server';
import type { User } from '@/generated/prisma/client';

/**
 * Every user in the system. For cron/batch jobs (see GET /api/sync) that run
 * without a session and must process all users, not just the caller.
 */
export async function getAllUsers(): Promise<User[]> {
    return prisma.user.findMany();
}

export async function getCurrentUser(): Promise<User> {
    const supabase = await createClient();
    const {
        data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
        const err = new Error('Not authenticated');
        Object.assign(err, { status: 401 });
        throw err;
    }

    const existing = await prisma.user.findUnique({
        where: { id: authUser.id },
    });
    if (existing) return existing;

    // Fallback in case the auth.users sync trigger hasn't fired yet (e.g.
    // raced with signup) - mirrors the row ourselves. Only hit once per user.
    return prisma.user.upsert({
        where: { id: authUser.id },
        update: {},
        create: {
            id: authUser.id,
            email: authUser.email!,
            name: authUser.user_metadata?.name ?? null,
        },
    });
}
