'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import SideNav, { type CurrentUser } from './SideNav';

export default function SideNavShell({
    user,
    children,
}: {
    user: CurrentUser;
    children: React.ReactNode;
}) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const pathname = usePathname();

    // Close the mobile drawer on navigation by adjusting state during render
    // (React's recommended alternative to an effect for this case).
    const [prevPathname, setPrevPathname] = useState(pathname);
    if (pathname !== prevPathname) {
        setPrevPathname(pathname);
        setMobileOpen(false);
    }

    return (
        <>
            <button
                onClick={() => setMobileOpen(true)}
                title="Open menu"
                className="fixed top-4 left-4 z-20 inline-flex rounded-lg border border-black/10 bg-white p-2 text-black/60 shadow-sm transition-colors hover:bg-black/5 hover:text-black md:hidden dark:border-white/10 dark:bg-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white"
            >
                <Menu className="size-5" />
            </button>

            {mobileOpen && (
                <div
                    onClick={() => setMobileOpen(false)}
                    className="fixed inset-0 z-20 bg-black/30 md:hidden"
                />
            )}

            <SideNav
                user={user}
                mobileOpen={mobileOpen}
                onCloseMobile={() => setMobileOpen(false)}
            />

            <div className="flex min-h-full flex-1 flex-col pt-14 pl-0 md:pt-0 md:pl-16">
                {children}
            </div>
        </>
