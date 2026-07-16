'use client';

import axios from 'axios';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePlaidLink, PlaidLinkOptions } from 'react-plaid-link';
import { LineChart } from 'lucide-react';
import type { ItemDTO } from '@/lib/db/types';

/**
 * Opt-in prompt for items linked before Investments consent was requested at
 * link time. Lists each such institution with a button that runs the Plaid
 * update-mode flow to grant Investments consent, then drops the item from the
 * list. Renders nothing when every item already has consent.
 */
export default function EnableInvestments() {
    const [items, setItems] = useState<ItemDTO[] | null>(null);

    const fetchItems = useCallback(async () => {
        try {
            const res = await axios.get('/api/items');
            setItems(res.data.items ?? []);
        } catch {
            // Non-critical surface - stay silent rather than showing an error.
            setItems([]);
        }
    }, []);

    useEffect(() => {
        // Deferred to a microtask so the fetch's setState doesn't run
        // synchronously inside the effect (react-hooks/set-state-in-effect),
        // matching the dashboard page's mount-fetch pattern.
        queueMicrotask(fetchItems);
    }, [fetchItems]);

    const pending = (items ?? []).filter((i) => !i.investmentsConsented);

    const handleConsented = useCallback((id: string) => {
        setItems((prev) =>
            (prev ?? []).map((i) =>
                i.id === id ? { ...i, investmentsConsented: true } : i
            )
        );
    }, []);

    if (pending.length === 0) return null;

    return (
        <section className="mb-8 rounded-2xl border border-border/60 bg-surface p-6">
            <div className="flex items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <LineChart className="size-5" />
                </span>
                <div className="flex-1">
                    <h2 className="text-sm font-semibold">
                        Enable investment tracking
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Grant access to holdings for accounts you linked before
                        investment tracking was available. No re-link required.
                    </p>
                    <ul className="mt-4 flex flex-col divide-y divide-border">
                        {pending.map((item) => (
                            <EnableInvestmentsRow
                                key={item.id}
                                item={item}
                                onConsented={handleConsented}
                            />
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}

type RowStatus = 'idle' | 'preparing' | 'linking' | 'error';

function EnableInvestmentsRow({
    item,
    onConsented,
}: {
    item: ItemDTO;
    onConsented: (id: string) => void;
}) {
    const [linkToken, setLinkToken] = useState<string | null>(null);
    const [status, setStatus] = useState<RowStatus>('idle');
    // usePlaidLink can't open until the freshly-fetched token has initialized
    // the hook; this defers open() to the effect below once `ready` flips.
    const shouldOpen = useRef(false);

    const config: PlaidLinkOptions = {
        token: linkToken,
        onSuccess: async () => {
            try {
                await axios.post(`/api/items/${item.id}/enable-investments`);
                onConsented(item.id);
            } catch {
                setStatus('error');
            }
        },
        onExit: () => {
            shouldOpen.current = false;
            setStatus('idle');
            setLinkToken(null);
        },
    };

    const { open, ready } = usePlaidLink(config);

    useEffect(() => {
        if (ready && shouldOpen.current && linkToken) {
            shouldOpen.current = false;
            setStatus('linking');
            open();
        }
    }, [ready, linkToken, open]);

    async function handleClick() {
        setStatus('preparing');
        try {
            const res = await axios.post('/api/create_update_link_token', {
                itemId: item.id,
            });
            shouldOpen.current = true;
            setLinkToken(res.data.link_token);
        } catch {
            setStatus('error');
        }
    }

    const busy = status === 'preparing' || status === 'linking';

    return (
        <li className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <span className="truncate text-sm font-medium">
                {item.institutionName ?? 'Linked institution'}
            </span>
            <div className="flex items-center gap-3">
                {status === 'error' && (
                    <span role="alert" className="text-xs text-negative">
                        Failed - try again
                    </span>
                )}
                <button
                    type="button"
                    onClick={handleClick}
                    disabled={busy}
                    className="shrink-0 cursor-pointer rounded-lg border border-border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    {status === 'preparing'
                        ? 'Preparing...'
                        : status === 'linking'
                          ? 'Connecting...'
                          : 'Enable'}
                </button>
            </div>
        </li>
    );
}
