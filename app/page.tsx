import Link from 'next/link';

export default function LandingPage() {
    return (
        <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-8 px-4 text-center">
            <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Get your money up and your funny up
            </h1>
            <Link
                href="/login"
                className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-black/80 dark:bg-white dark:text-black dark:hover:bg-white/80"
            >
                Get started
            </Link>
        </div>
    );
}
