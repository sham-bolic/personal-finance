'use client';

import FormField from '@/app/components/FormField';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignupPage() {
    const router = useRouter();
    const supabase = createClient();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);
    const [checkEmail, setCheckEmail] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setPending(true);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name } },
        });

        setPending(false);
        if (error) {
            setError(error.message);
            return;
        }

        if (!data.session) {
            // Email confirmation is required before the user can sign in.
            setCheckEmail(true);
            return;
        }

        router.push('/dashboard');
        router.refresh();
    }

    if (checkEmail) {
        return (
            <div className="flex min-h-full flex-1 items-center justify-center px-4">
                <p className="max-w-sm text-center text-sm">
                    Check your email for a confirmation link before signing in.
                </p>
            </div>
        );
    }

    return (
        <div className="flex min-h-full flex-1 items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <h1 className="mb-6 text-xl font-semibold">Sign up</h1>

                <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                    <FormField
                        id="name"
                        label="Name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
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
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    {error && <p className="text-sm text-red-600">{error}</p>}

                    <button
                        type="submit"
                        disabled={pending}
                        className="mt-2 rounded-lg bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
                    >
                        {pending ? 'Signing up…' : 'Sign up'}
                    </button>
                </form>

                <p className="mt-6 text-sm text-black/60 dark:text-white/60">
                    Already have an account?{' '}
                    <Link href="/login" className="font-medium text-black underline dark:text-white">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
