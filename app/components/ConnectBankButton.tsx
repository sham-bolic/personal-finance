'use client';

import axios from 'axios';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlaidLink, PlaidLinkOptions } from 'react-plaid-link';

export default function ConnectBankButton() {
    const router = useRouter();
    const [linkToken, setLinkToken] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'linking' | 'error'>('idle');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const response = await axios.post('/api/create_link_token');
                if (!cancelled) setLinkToken(response.data.link_token);
            } catch {
                if (!cancelled) setStatus('error');
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const config: PlaidLinkOptions = {
        token: linkToken,
        onSuccess: async (public_token) => {
            setStatus('linking');
            try {
                await axios.post('/api/exchange_access_token', {
                    public_token,
                });
                router.refresh();
                setStatus('idle');
            } catch {
                setStatus('error');
            }
        },
        onExit: () => {},
    };

    const { open, ready } = usePlaidLink(config);

    return (
        <div className="flex flex-col gap-1">
            <button
                type="button"
                onClick={() => open()}
                disabled={!ready || status === 'linking'}
                className="cursor-pointer rounded-lg border border-black/15 px-3 py-2 text-sm font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/15 dark:hover:bg-white/5"
            >
                {status === 'linking' ? 'Connecting...' : 'Connect Bank'}
            </button>
            {status === 'error' && (
                <p
                    role="alert"
                    className="px-1 text-xs text-black/60 dark:text-white/60"
                >
                    Something went wrong. Try again.
                </p>
            )}
        </div>
    );
}
