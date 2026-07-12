'use client';
import { useChat, type UIMessage } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import {
    useEffect,
    useRef,
    useState,
    type FormEvent,
    type KeyboardEvent,
} from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    ArrowClockwise,
    CheckCircle,
    CircleNotch,
    PaperPlaneRight,
    PiggyBank,
    XCircle,
} from '@phosphor-icons/react';
import { loadChatHistory, saveChatHistory } from '@/lib/piggyai/local-storage';

const SUGGESTED_PROMPTS = [
    'How much did I spend on coffee this month?',
    'How close am I to my goals?',
    "What's my net worth right now?",
    'Am I on track with my budget this month?',
];

const MAX_TEXTAREA_HEIGHT_PX = 160;

function formatToolLabel(toolName: string) {
    return toolName
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .toLowerCase()
        .replace(/^get /, '');
}

// The assistant message shell appears (role: 'assistant') as soon as the
// model starts a turn, but reasoning renders as nothing in the transcript
// below — so checking role alone hides the typing indicator during that
// gap, before a tool chip or text is actually on screen. Tool parts count
// as visible in any state (not just 'output-available') since a running
// tool now renders its own "checking..." chip, which replaces the generic
// typing indicator as the progress cue.
function hasVisibleContent(message: UIMessage) {
    return message.parts.some((part) => {
        if (part.type === 'text') return part.text.trim().length > 0;
        if (part.type.startsWith('tool-') && 'state' in part) return true;
        return false;
    });
}

// Assistant replies often include markdown (bold amounts, lists); user input
// is raw typed text, so only assistant text parts go through the renderer.
const markdownComponents: Components = {
    p: ({ children }) => (
        <p className="mb-2 whitespace-pre-wrap last:mb-0">{children}</p>
    ),
    strong: ({ children }) => (
        <strong className="font-semibold">{children}</strong>
    ),
    ul: ({ children }) => (
        <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
    ),
    ol: ({ children }) => (
        <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
    ),
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    a: ({ children, href }) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:no-underline"
        >
            {children}
        </a>
    ),
    code: ({ children }) => (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
            {children}
        </code>
    ),
};

// Narrows a message part to the shape tool-call parts share (type prefixed
// 'tool-', plus a 'state'/'errorText' pair) without importing the SDK's
// generic ToolUIPart type, which is parameterized per-tool.
type ToolPart = Extract<UIMessage['parts'][number], { type: `tool-${string}` }>;

function isToolPart(part: UIMessage['parts'][number]): part is ToolPart {
    return part.type.startsWith('tool-') && 'state' in part;
}

// Tool calls get their own pill so the "what Piggy checked" trail reads as
// a distinct activity log, not another line of prose crammed into the reply.
function ToolCallChip({ part }: { part: ToolPart }) {
    const label = formatToolLabel(part.type.replace('tool-', ''));

    if (part.state === 'output-error') {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-negative/30 bg-negative/10 px-2.5 py-1 text-xs text-negative">
                <XCircle size={13} weight="fill" />
                Couldn&apos;t check {label}
            </span>
        );
    }

    if (part.state === 'output-available') {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
                <CheckCircle
                    size={13}
                    weight="fill"
                    className="text-positive"
                />
                Checked {label}
            </span>
        );
    }

    // 'input-streaming' | 'input-available' — the call is still running.
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground animate-piggyai-chip-pulse">
            <CircleNotch
                size={13}
                weight="bold"
                className="animate-spin motion-reduce:animate-none"
            />
            Checking {label}…
        </span>
    );
}

// While the trailing assistant message is actively streaming, render raw
// text word-by-word instead of through ReactMarkdown: each new word mounts
// as its own span (stable array index as key means already-rendered words
// are never re-mounted, so they don't replay the fade), giving a per-word
// reveal timed to the backend's smoothStream word pacing. Markdown syntax
// (e.g. an in-progress "**") can render literally for the brief streaming
// window; once the message settles, the caller swaps to ReactMarkdown for
// the fully formatted final render.
function StreamingWords({ text }: { text: string }) {
    const tokens = text.split(/(\s+)/);
    return (
        <p className="whitespace-pre-wrap">
            {tokens.map((token, i) =>
                /^\s+$/.test(token) ? (
                    token
                ) : (
                    <span
                        key={i}
                        className="inline-block animate-piggyai-word-in"
                    >
                        {token}
                    </span>
                )
            )}
            <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-3.5 w-[2px] -translate-y-[1px] animate-piggyai-cursor bg-current align-middle"
            />
        </p>
    );
}

function TypingIndicator() {
    return (
        <div className="flex items-center gap-1 px-1 py-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
                <span
                    key={i}
                    className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground motion-reduce:animate-none"
                    style={{ animationDelay: `${i * 120}ms` }}
                />
            ))}
        </div>
    );
}

function AssistantAvatar() {
    return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <PiggyBank size={16} weight="fill" />
        </div>
    );
}

export default function PiggyAIPage() {
    const [input, setInput] = useState('');
    const [hydrated, setHydrated] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const { messages, setMessages, sendMessage, status, error, regenerate } =
        useChat({
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

    useEffect(() => {
        const reduceMotion = window.matchMedia(
            '(prefers-reduced-motion: reduce)'
        ).matches;
        bottomRef.current?.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block: 'end',
        });
    }, [messages, status]);

    function resizeTextarea() {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
    }

    function submitText(text: string) {
        if (!text.trim() || isBusy) return;
        sendMessage({ text });
        setInput('');
        requestAnimationFrame(resizeTextarea);
    }

    function handleSubmit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        submitText(input);
    }

    function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submitText(input);
        }
    }

    return (
        <main className="mx-auto flex h-dvh w-full max-w-3xl flex-col overflow-hidden px-4 py-8 sm:px-6 sm:py-10">
            <header className="mb-6 shrink-0">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Ask Piggy
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Ask about your spending, cash flow, budgets, or goals.
                </p>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto rounded-xl border border-border p-4">
                {messages.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center gap-4 px-2 py-8 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <PiggyBank size={26} weight="fill" />
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Try asking Piggy one of these:
                        </p>
                        <div className="flex flex-wrap justify-center gap-2">
                            {SUGGESTED_PROMPTS.map((prompt) => (
                                <button
                                    key={prompt}
                                    type="button"
                                    onClick={() => submitText(prompt)}
                                    className="cursor-pointer rounded-full border border-border px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((message, index) => {
                    // The trailing assistant message shell exists as soon as
                    // the model starts a turn but has nothing to show yet
                    // (reasoning/in-flight tool calls render as nothing) —
                    // render the typing indicator below instead of an empty
                    // bubble for it.
                    if (
                        index === messages.length - 1 &&
                        message.role === 'assistant' &&
                        !hasVisibleContent(message)
                    ) {
                        return null;
                    }
                    const isTrailingStreaming =
                        index === messages.length - 1 &&
                        message.role === 'assistant' &&
                        isBusy;
                    const toolParts = message.parts.filter(isToolPart);

                    return (
                        <div
                            key={message.id}
                            className={`flex items-end gap-2 animate-piggyai-message-in ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {message.role === 'assistant' && (
                                <AssistantAvatar />
                            )}
                            <div
                                className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                                    message.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'border border-border'
                                }`}
                            >
                                {toolParts.length > 0 && (
                                    <div className="mb-2 flex flex-wrap gap-1.5">
                                        {toolParts.map((part, i) => (
                                            <ToolCallChip key={i} part={part} />
                                        ))}
                                    </div>
                                )}
                                {message.parts.map((part, i) => {
                                    if (part.type !== 'text') return null;
                                    if (message.role === 'assistant') {
                                        if (isTrailingStreaming) {
                                            return (
                                                <StreamingWords
                                                    key={i}
                                                    text={part.text}
                                                />
                                            );
                                        }
                                        return (
                                            <ReactMarkdown
                                                key={i}
                                                remarkPlugins={[remarkGfm]}
                                                components={markdownComponents}
                                            >
                                                {part.text}
                                            </ReactMarkdown>
                                        );
                                    }
                                    return (
                                        <p
                                            key={i}
                                            className="whitespace-pre-wrap"
                                        >
                                            {part.text}
                                        </p>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}

                {isBusy &&
                    !(
                        messages[messages.length - 1]?.role === 'assistant' &&
                        hasVisibleContent(messages[messages.length - 1])
                    ) && (
                        <div className="flex items-end justify-start gap-2">
                            <AssistantAvatar />
                            <div className="rounded-xl border border-border">
                                <TypingIndicator />
                            </div>
                        </div>
                    )}

                {error && (
                    <div
                        role="alert"
                        className="flex items-center justify-between gap-3 rounded-xl border border-negative/30 bg-negative/10 px-4 py-2.5 text-sm text-negative"
                    >
                        <span>Something went wrong.</span>
                        <button
                            type="button"
                            onClick={() => regenerate()}
                            className="inline-flex shrink-0 cursor-pointer items-center gap-1 font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-negative"
                        >
                            <ArrowClockwise size={14} weight="bold" />
                            Try again
                        </button>
                    </div>
                )}

                {messages.length > 0 && <div ref={bottomRef} />}
            </div>

            <div aria-live="polite" className="sr-only">
                {isBusy ? 'Piggy is typing…' : ''}
            </div>

            <form
                onSubmit={handleSubmit}
                className="mt-4 flex shrink-0 items-end gap-2"
            >
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value);
                        resizeTextarea();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your finances…"
                    aria-label="Ask about your finances"
                    className="max-h-40 flex-1 resize-none rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm leading-relaxed focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || isBusy}
                    aria-label="Send message"
                    className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-foreground"
                >
                    <PaperPlaneRight size={18} weight="fill" />
                </button>
            </form>
        </main>
    );
}
