'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Wallet,
    Target,
    PiggyBank,
    LogOut,
    LogIn,
    X,
    type LucideIcon,
} from 'lucide-react';
import ConnectBankButton from './ConnectBankButton';
import { clearChatHistory } from '@/lib/piggyai/local-storage';

export type CurrentUser = { email: string | null; name: string | null } | null;

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/budgets', label: 'Budget', icon: Wallet },
    { href: '/goals', label: 'Goals', icon: Target },
    { href: '/piggyai', label: 'Ask Piggy', icon: PiggyBank },
];

export default function SideNav({
    user,
    mobileOpen,
    onCloseMobile,
}: {
    user: CurrentUser;
    mobileOpen: boolean;
    onCloseMobile: () => void;
}) {
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
        <nav
            className={`group fixed inset-y-0 left-0 z-30 flex shrink-0 flex-col gap-1 overflow-hidden border-r border-black/10 bg-white px-3 py-6 transition-all duration-200 md:w-16 md:hover:w-56 md:hover:shadow-xl dark:border-white/10 dark:bg-black ${
                mobileOpen
                    ? 'w-56 translate-x-0'
                    : 'w-56 -translate-x-full md:translate-x-0'
            }`}
        >
            <div className="mb-2 flex items-center justify-end md:hidden">
                <button
                    onClick={onCloseMobile}
                    title="Close menu"
                    className="inline-flex rounded-lg p-2 text-black/60 transition-colors hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                >
                    <X className="size-5" />
                </button>
            </div>

            {NAV_ITEMS.map((item) => {
                const isActive =
                    item.href === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors md:justify-center md:group-hover:justify-start ${
                            isActive
                                ? 'bg-black/10 text-black dark:bg-white/10 dark:text-white'
                                : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white'
                        }`}
                    >
                        <Icon className="size-5 shrink-0" />
                        <span className="md:hidden md:group-hover:inline">
                            {item.label}
                        </span>
                    </Link>
                );
            })}

            <div className="mt-auto border-t border-black/10 pt-3 dark:border-white/10">
                {user ? (
                    <div className="flex flex-col gap-3">
                        <ConnectBankButton />
                        <div className="flex flex-col gap-2">
                            <span className="truncate px-3 text-sm text-black/60 md:hidden md:group-hover:block dark:text-white/60">
                                {user.name || user.email}
                            </span>
                            <button
                                onClick={handleSignOut}
                                title="Sign out"
                                className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap text-black/60 transition-colors hover:bg-black/5 hover:text-black md:justify-center md:group-hover:justify-start dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                            >
                                <LogOut className="size-5 shrink-0" />
                                <span className="md:hidden md:group-hover:inline">
                                    Sign out
                                </span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <Link
                        href="/login"
                        title="Sign in"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-black/60 transition-colors hover:bg-black/5 hover:text-black md:justify-center md:group-hover:justify-start dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
                    >
                        <LogIn className="size-5 shrink-0" />
                        <span className="md:hidden md:group-hover:inline">
                            Sign in
                        </span>
                    </Link>
                )}
            </div>
        </nav>
    );
}
