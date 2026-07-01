import { prisma } from '@/lib/prisma_client';
import type { User } from '@/generated/prisma/client';

// TODO: Make real user auth, until then seed the dev user for dev
export async function getCurrentUser(): Promise<User> {
    return getOrCreateDevUser();
}

async function getOrCreateDevUser(): Promise<User> {
    const id = process.env.DEV_USER_ID;
    if (!id) throw new Error('Missing DEV_USER_ID environment variable');

    return prisma.user.upsert({
        where: { id },
        update: {},
        create: { id, email: 'dev@example.com', name: 'Dev User' },
    });
}
