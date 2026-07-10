'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import ConnectBankButton from './ConnectBankButton';
import { clearChatHistory } from '@/lib/piggyai/local-storage';

export type CurrentUser = { email: string | null; name: string | null } | null;

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/budgets', label: 'Budget' },
    { href: '/goals', label: 'Goals' },
    { href: '/piggyai', label: 'Ask Piggy' },
];

export default function SideNav({ user }: { user: CurrentUser }) {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = createClient();

    async function handleSignOut() {
        await supabase.auth.signOut();
        clearChatHistory();
        router.push('/login');
        router.refresh();
    }

    return (
        <nav className="fixed inset-y-0 left-0 flex w-56 shrink-0 flex-col gap-1 border-r border-black/10 px-3 py-6 dark:border-white/10">
            {NAV_ITEMS.map((item) => {
                const isActive =
                    item.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.href);
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            isActive
                                ? 'bg-black/10 text-black dark:bg-white/10 dark:text-white'
                                : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white'
                        }`}
                    >
                        {item.label}
                    </Link>
                );
            })}

            <div className="mt-auto border-t border-black/10 pt-3 dark:border-white/10">
                {user ? (
                    <div className="flex flex-col gap-3">
                        <ConnectBankButton />
                        <div className="flex flex-col gap-2">
                            <span className="truncate px-3 text-sm text-black/60 dark:text-white/60">
                                {user.name || user.email}
                            </span>
                            <button
                                onClick={handleSignOut}
                                className="rounded-lg px-3 py-2 text-left text-sm font-medium text-black/60 transition-colors hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                            >
                                Sign out
                            </button>
                        </div>
                    </div>
                ) : (
                    <Link
                        href="/login"
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-black/60 transition-colors hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                    >
                        Sign in
                    </Link>
                )}
            </div>
        </nav>
    );
}
