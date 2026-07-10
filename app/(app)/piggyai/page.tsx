'use client';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useState, type FormEvent } from 'react';
import { loadChatHistory, saveChatHistory } from '@/lib/piggyai/local-storage';

function formatToolLabel(toolName: string) {
    return toolName.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

export default function PiggyAIPage() {
    const [input, setInput] = useState('');
    const [hydrated, setHydrated] = useState(false);
    const { messages, setMessages, sendMessage, status, error } = useChat({
        transport: new DefaultChatTransport({ api: '/api/piggyai/chat' }),
    });

    const isBusy = status === 'submitted' || status === 'streaming';

    // Read localStorage only after mount (client-only) rather than during
    // render, to avoid an SSR/hydration mismatch — the initial render must
    // match the server's empty-chat output.
    useEffect(() => {
        queueMicrotask(() => {
            const stored = loadChatHistory();
            if (stored.length > 0) setMessages(stored);
            setHydrated(true);
        });
    }, [setMessages]);

    useEffect(() => {
        if (!hydrated) return; // don't overwrite storage before the load above runs
        saveChatHistory(messages);
    }, [hydrated, messages]);

    function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!input.trim() || isBusy) return;
        sendMessage({ text: input });
        setInput('');
    }

    return (
        <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col px-4 py-8 sm:px-6 sm:py-10">
            <header className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Ask Piggy
                </h1>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                    Ask about your spending, cash flow, budgets, or goals.
                </p>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-black/10 p-4 dark:border-white/10">
                {messages.length === 0 && (
                    <p className="px-2 py-8 text-center text-sm text-black/50 dark:text-white/50">
                        Try &quot;How much did I spend on coffee this
                        month?&quot; or &quot;How close am I to my goals?&quot;
                    </p>
                )}

                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div
                            className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                                message.role === 'user'
                                    ? 'bg-blue-700 text-white'
                                    : 'border border-black/10 dark:border-white/10'
                            }`}
                        >
                            {message.parts.map((part, i) => {
                                if (part.type === 'text') {
                                    return (
                                        <p
                                            key={i}
                                            className="whitespace-pre-wrap"
                                        >
                                            {part.text}
                                        </p>
                                    );
                                }
                                if (
                                    part.type.startsWith('tool-') &&
                                    'state' in part &&
                                    part.state === 'output-available'
                                ) {
                                    return (
                                        <p
                                            key={i}
                                            className="mt-1 text-xs italic text-black/40 dark:text-white/40"
                                        >
                                            checked{' '}
                                            {formatToolLabel(
                                                part.type.replace('tool-', '')
                                            )}
                                        </p>
                                    );
                                }
                                return null;
                            })}
                        </div>
                    </div>
                ))}

                {isBusy &&
                    messages[messages.length - 1]?.role !== 'assistant' && (
                        <div className="flex justify-start">
                            <div className="rounded-xl border border-black/10 px-4 py-2.5 text-sm text-black/50 dark:border-white/10 dark:text-white/50">
                                Thinking…
                            </div>
                        </div>
                    )}

                {error && (
                    <div
                        role="alert"
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400"
                    >
                        Something went wrong. Try again.
                    </div>
                )}
            </div>

            <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about your finances…"
                    className="flex-1 rounded-lg border border-black/15 px-4 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/15 dark:bg-transparent"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || isBusy}
                    className="cursor-pointer rounded-lg border border-black/15 px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/15 dark:hover:bg-white/5"
                >
                    Send
                </button>
            </form>
        </main>
    );
}
