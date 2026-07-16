'use client';

import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    LayoutDashboard,
    Wallet,
    Target,
    ChartPie,
    PiggyBank,
    LogOut,
    LogIn,
    X,
    type LucideIcon,
} from 'lucide-react';
import ConnectBankButton from './ConnectBankButton';
import ThemeToggle from './ThemeToggle';
import { NavTooltip } from './NavTooltip';
import { clearChatHistory } from '@/lib/piggyai/local-storage';

export type CurrentUser = { email: string | null; name: string | null } | null;

const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/budgets', label: 'Budget', icon: Wallet },
    { href: '/goals', label: 'Goals', icon: Target },
    { href: '/investments', label: 'Investments', icon: ChartPie },
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
            className={`fixed inset-y-0 left-0 z-30 flex w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface px-3 py-6 transition-transform duration-200 md:w-16 ${
                mobileOpen
                    ? 'translate-x-0'
                    : '-translate-x-full md:translate-x-0'
            }`}
        >
            <div className="mb-2 flex items-center justify-end md:hidden">
                <button
                    onClick={onCloseMobile}
                    title="Close menu"
                    className="cursor-pointer inline-flex rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
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
                    <NavTooltip key={item.href} label={item.label}>
                        <Link
                            href={item.href}
                            aria-label={item.label}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors md:justify-center ${
                                isActive
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                            }`}
                        >
                            <Icon className="size-5 shrink-0" />
                            <span className="md:hidden">{item.label}</span>
                        </Link>
                    </NavTooltip>
                );
            })}

            <div className="mt-auto flex flex-col gap-3 border-t border-border pt-3">
                <ThemeToggle />
                {user ? (
                    <div className="flex flex-col gap-3">
                        <ConnectBankButton />
                        <NavTooltip
                            label={user.name || user.email || 'Account'}
                        >
                            <div className="flex w-full items-center gap-3 px-3 py-1 md:justify-center">
                                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                                    {(user.name || user.email || '?')
                                        .charAt(0)
                                        .toUpperCase()}
                                </span>
                                <span className="truncate text-sm text-muted-foreground md:hidden">
                                    {user.name || user.email}
                                </span>
                            </div>
                        </NavTooltip>
                        <NavTooltip label="Sign out">
                            <button
                                onClick={handleSignOut}
                                aria-label="Sign out"
                                className="cursor-pointer flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground md:justify-center"
                            >
                                <LogOut className="size-5 shrink-0" />
                                <span className="md:hidden">Sign out</span>
                            </button>
                        </NavTooltip>
                    </div>
                ) : (
                    <NavTooltip label="Sign in">
                        <Link
                            href="/login"
                            aria-label="Sign in"
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground md:justify-center"
                        >
                            <LogIn className="size-5 shrink-0" />
                            <span className="md:hidden">Sign in</span>
                        </Link>
                    </NavTooltip>
                )}
            </div>
        </nav>
    );
}
