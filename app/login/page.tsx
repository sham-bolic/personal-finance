'use client';

import FormField from '@/app/components/FormField';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LoginPage() {
    const router = useRouter();
    const supabase = createClient();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setPending(true);

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        setPending(false);
        if (error) {
            setError(error.message);
            return;
        }

        router.push('/dashboard');
        router.refresh();
    }

    async function handleGoogleSignIn() {
        setError(null);
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) setError(error.message);
    }

    return (
        <div className="flex min-h-full flex-1 items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <h1 className="mb-6 text-xl font-semibold">Sign in</h1>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <FormField
                        id="email"
                        label="Email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <FormField
                        id="password"
                        label="Password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <button
                        type="submit"
                        disabled={pending}
                        className="mt-2 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                    >
                        {pending ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>

                <button
                    onClick={handleGoogleSignIn}
                    className="mt-3 w-full rounded-lg border border-black/10 px-3 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/10 dark:hover:bg-white/5"
                >
                    Sign in with Google
                </button>

                <p className="mt-6 text-sm text-black/60 dark:text-white/60">
                    Don&apos;t have an account?{' '}
                    <Link href="/signup" className="font-medium text-black underline dark:text-white">
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    );
}
