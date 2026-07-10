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
                className="cursor-pointer fixed top-4 left-4 z-20 inline-flex rounded-lg border border-border bg-surface p-2 text-muted-foreground shadow-sm transition-colors hover:bg-surface-hover hover:text-foreground md:hidden"
            >
                <Menu className="size-5" />
            </button>

            {mobileOpen && (
                <div
                    onClick={() => setMobileOpen(false)}
                    className="fixed inset-0 z-20 bg-black/50 md:hidden"
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
    );
}
