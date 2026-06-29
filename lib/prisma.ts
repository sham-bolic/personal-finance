import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const connectionString = `${process.env.DATABASE_URL}`;

if (!connectionString) {
    console.error('Error creating prisma client due to missing DATABASE_URL/');
}

const globalForPrisma = globalThis as {
    prisma?: PrismaClient;
};

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        adapter: new PrismaPg({ connectionString }),
        log:
            process.env.NODE_ENV === 'development'
                ? ['warn', 'error']
                : ['error'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
