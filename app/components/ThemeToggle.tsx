'use client';

import { useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';

type Theme = 'light' | 'dark';

// data-theme is source of truth (set by app/layout.tsx's inline script and
// by toggle() below), so we read it via useSyncExternalStore rather than
// mirroring it into local state — that keeps this component correct even if
// the attribute changes from elsewhere (e.g. another tab writing localStorage)
// and sidesteps a hydration mismatch, since getServerSnapshot always agrees
// with the server-rendered 'light' default.
function subscribe(callback: () => void) {
    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, {
        attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
}

function getSnapshot(): Theme {
    return document.documentElement.getAttribute('data-theme') === 'dark'
        ? 'dark'
        : 'light';
}

function getServerSnapshot(): Theme {
    return 'light';
}

export default function ThemeToggle() {
    const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    function toggle() {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
    }

    const Icon = theme === 'dark' ? Moon : Sun;

    return (
        <button
            type="button"
            onClick={toggle}
            title={
                theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground md:justify-center md:group-hover:justify-start"
        >
            <Icon className="size-5 shrink-0" />
            <span className="md:hidden md:group-hover:inline">
                {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </span>
        </button>
    );
}
