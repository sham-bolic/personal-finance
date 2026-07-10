import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const plexSans = IBM_Plex_Sans({
    variable: '--font-plex-sans',
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
});

const plexMono = IBM_Plex_Mono({
    variable: '--font-plex-mono',
    subsets: ['latin'],
    weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
    title: 'Personal Finance',
    description: 'Track net worth, cash flow, budgets, and goals in one place.',
};

// Sets data-theme on <html> before first paint, so an explicit stored choice
// (e.g. dark) isn't briefly overridden by the OS-preference CSS fallback
// (e.g. light) while waiting for React to hydrate. Must stay a plain inline
// script — it runs before any bundle loads. Errors are swallowed because a
// blocked localStorage (private browsing, etc.) should fall back to the CSS
// media-query default in globals.css, not break the page.
const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            suppressHydrationWarning
            className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
        >
            <body className="min-h-full flex">
                <script
                    dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
                />
                {children}
            </body>
        </html>
    );
}
