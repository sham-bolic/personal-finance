'use client';

import axios from 'axios';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlaidLink, PlaidLinkOptions } from 'react-plaid-link';
import { Landmark } from 'lucide-react';

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
                title="Connect Bank"
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:justify-center md:group-hover:justify-start"
            >
                <Landmark className="size-5 shrink-0" />
                <span className="md:hidden md:group-hover:inline">
                    {status === 'linking' ? 'Connecting...' : 'Connect Bank'}
                </span>
            </button>
            {status === 'error' && (
                <p
                    role="alert"
                    className="px-1 text-xs text-muted-foreground md:hidden md:group-hover:block"
                >
                    Something went wrong. Try again.
                </p>
            )}
        </div>
    );
}
