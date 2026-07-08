'use client';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import type { GoalWithProgress } from '@/lib/db/types';
import { formatCurrency } from '../dashboard/format';
import { ProgressBar } from '../components/ProgressBar';

function formatDate(date: string) {
    const [year, month, day] = date.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    if (Number.isNaN(d.getTime())) return date;
    return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

export default function GoalsPage() {
    const [goals, setGoals] = useState<GoalWithProgress[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading'
    );

    const fetchGoals = useCallback(async () => {
        setStatus('loading');
        try {
            const response = await axios.get('/api/goals');
            setGoals(response.data.goals ?? []);
            setStatus('ready');
        } catch {
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        fetchGoals();
    }, [fetchGoals]);

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
            <header className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Goals
                </h1>
                <p className="mt-1 text-sm text-black/60 dark:text-white/60">
                    Track progress toward what you&apos;re saving for.
                </p>
            </header>

            <section className="mb-8 rounded-xl border border-black/10 p-5 dark:border-white/10">
                <h2 className="mb-3 text-sm font-medium text-black/60 dark:text-white/60">
                    New goal
                </h2>
                <NewGoalForm onCreated={fetchGoals} />
            </section>

            {status === 'loading' && <GoalsSkeleton />}

            {status === 'error' && (
                <div
                    role="alert"
                    className="flex flex-col items-center gap-3 rounded-xl border border-black/10 px-6 py-16 text-center dark:border-white/10"
                >
                    <p className="text-sm text-black/70 dark:text-white/70">
                        We couldn&apos;t load your goals.
                    </p>
                    <button
                        type="button"
                        onClick={fetchGoals}
                        className="cursor-pointer rounded-lg border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/15 dark:hover:bg-white/5"
                    >
                        Try again
                    </button>
                </div>
            )}

            {status === 'ready' && goals.length === 0 && (
                <div className="flex flex-col items-center gap-1 rounded-xl border border-black/10 px-6 py-16 text-center dark:border-white/10">
                    <p className="text-sm font-medium">No goals yet</p>
                    <p className="text-sm text-black/60 dark:text-white/60">
                        Create one above to start tracking.
                    </p>
                </div>
            )}

            {status === 'ready' && goals.length > 0 && (
                <div className="flex flex-col gap-4">
                    {goals.map((goal) => (
                        <GoalCard
                            key={goal.id}
                            goal={goal}
                            onChanged={fetchGoals}
                        />
                    ))}
                </div>
            )}
        </main>
    );
}

function NewGoalForm({ onCreated }: { onCreated: () => void }) {
    const [name, setName] = useState('');
    const [targetAmount, setTargetAmount] = useState('');
    const [targetDate, setTargetDate] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const amount = Number(targetAmount);
        if (!name.trim() || !Number.isFinite(amount) || amount <= 0) {
            setError('Enter a name and a positive target amount.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await axios.post('/api/goals', {
                name: name.trim(),
                targetAmount: amount,
                targetDate: targetDate || undefined,
            });
            setName('');
            setTargetAmount('');
            setTargetDate('');
            onCreated();
        } catch {
            setError('Failed to create goal.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-wrap items-end gap-3"
        >
            <div className="flex flex-1 min-w-40 flex-col gap-1">
                <label
                    htmlFor="goal-name"
                    className="text-xs font-medium text-black/60 dark:text-white/60"
                >
                    Name
                </label>
                <input
                    id="goal-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Emergency fund"
                    className="rounded-lg border border-black/15 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/15 dark:bg-transparent"
                />
            </div>
            <div className="flex w-36 flex-col gap-1">
                <label
                    htmlFor="goal-amount"
                    className="text-xs font-medium text-black/60 dark:text-white/60"
                >
                    Target amount
                </label>
                <input
                    id="goal-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={targetAmount}
                    onChange={(e) => setTargetAmount(e.target.value)}
                    placeholder="5000"
                    className="rounded-lg border border-black/15 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/15 dark:bg-transparent"
                />
            </div>
            <div className="flex w-40 flex-col gap-1">
                <label
                    htmlFor="goal-date"
                    className="text-xs font-medium text-black/60 dark:text-white/60"
                >
                    Target date (optional)
                </label>
                <input
                    id="goal-date"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="rounded-lg border border-black/15 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/15 dark:bg-transparent"
                />
            </div>
            <button
                type="submit"
                disabled={submitting}
                className="cursor-pointer rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors duration-200 hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {submitting ? 'Creating…' : 'Create goal'}
            </button>
            {error && (
                <p className="w-full text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
        </form>
    );
}

function GoalCard({
    goal,
    onChanged,
}: {
    goal: GoalWithProgress;
    onChanged: () => void;
}) {
    const [contributionAmount, setContributionAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [busy, setBusy] = useState(false);

    const isCompleted = goal.status === 'completed';

    const handleContribute = async (e: React.FormEvent) => {
        e.preventDefault();
        const amount = Number(contributionAmount);
        if (!Number.isFinite(amount) || amount <= 0) return;
        setSubmitting(true);
        try {
            await axios.post(`/api/goals/${goal.id}/contributions`, {
                amount,
            });
            setContributionAmount('');
            onChanged();
        } finally {
            setSubmitting(false);
        }
    };

    const toggleStatus = async () => {
        setBusy(true);
        try {
            await axios.patch(`/api/goals/${goal.id}`, {
                status: isCompleted ? 'active' : 'completed',
            });
            onChanged();
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Delete goal "${goal.name}"?`)) return;
        setBusy(true);
        try {
            await axios.delete(`/api/goals/${goal.id}`);
            onChanged();
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="rounded-xl border border-black/10 p-5 dark:border-white/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="font-medium">{goal.name}</h3>
                        <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                isCompleted
                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                    : 'bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60'
                            }`}
                        >
                            {goal.status}
                        </span>
                    </div>
                    {goal.targetDate && (
                        <p className="mt-1 text-xs text-black/50 dark:text-white/50">
                            Target date {formatDate(goal.targetDate)}
                        </p>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={toggleStatus}
                        disabled={busy}
                        className="cursor-pointer rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/5"
                    >
                        {isCompleted ? 'Reactivate' : 'Mark complete'}
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={busy}
                        className="cursor-pointer rounded-lg border border-black/15 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                        Delete
                    </button>
                </div>
            </div>

            <div className="mt-4">
                <ProgressBar value={goal.contributed} max={goal.targetAmount} />
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-black/60 dark:text-white/60">
                    <span>
                        Contributed{' '}
                        <span className="font-medium text-black/80 dark:text-white/80">
                            {formatCurrency(goal.contributed)}
                        </span>
                    </span>
                    <span>
                        Target{' '}
                        <span className="font-medium text-black/80 dark:text-white/80">
                            {formatCurrency(goal.targetAmount)}
                        </span>
                    </span>
                    <span>
                        Remaining{' '}
                        <span className="font-medium text-black/80 dark:text-white/80">
                            {formatCurrency(Math.max(0, goal.remaining))}
                        </span>
                    </span>
                </div>
            </div>

            <form
                onSubmit={handleContribute}
                className="mt-4 flex items-center gap-2 border-t border-black/5 pt-4 dark:border-white/5"
            >
                <label htmlFor={`contribute-${goal.id}`} className="sr-only">
                    Contribution amount
                </label>
                <input
                    id={`contribute-${goal.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount(e.target.value)}
                    placeholder="Add contribution"
                    className="w-40 rounded-lg border border-black/15 px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 dark:border-white/15 dark:bg-transparent"
                />
                <button
                    type="submit"
                    disabled={submitting}
                    className="cursor-pointer rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:hover:bg-white/5"
                >
                    {submitting ? 'Adding…' : 'Add'}
                </button>
            </form>
        </section>
    );
}

function GoalsSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-xl border border-black/10 p-5 dark:border-white/10"
                >
                    <div className="h-4 w-32 animate-pulse rounded bg-black/10 motion-reduce:animate-none dark:bg-white/10" />
                    <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-black/10 motion-reduce:animate-none dark:bg-white/10" />
                </div>
            ))}
        </div>
    );
}
