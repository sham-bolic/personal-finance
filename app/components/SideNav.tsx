'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Dashboard' },
    { href: '/budgets', label: 'Budget' },
    { href: '/goals', label: 'Goals' },
    { href: '/piggyai', label: 'Ask Piggy' },
];

export default function SideNav() {
    const pathname = usePathname();

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
        </nav>
    );
}
