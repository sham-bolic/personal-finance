// Barrel file for the data-access layer.
// Import db functions from a single place: `import { ... } from '@/lib/db'`.
// NOTE: modules inside lib/db should import each other by direct path
// (e.g. './items'), not from this barrel, to avoid circular imports.
export * from './types';
export * from './user';
export * from './items';
export * from './accounts';
export * from './holdings';
export * from './transactions';
export * from './analytics';
export * from './budgets';
export * from './goals';
