'use client';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import type { PlaidPrimaryCategory } from '@/generated/prisma/enums';
import type { BudgetProgress } from '@/lib/db/types';
import { BUDGETABLE_CATEGORIES, formatPlaidPrimaryCategory } from '@/lib/plaid_categories';
import { formatCurrency } from '../dashboard/format';
import { ProgressBar } from '@/app/components/ProgressBar';

export default function BudgetsPage() {
    const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading'
    );

    const fetchBudgets = useCallback(async () => {
        setStatus('loading');
        try {
            const response = await axios.get('/api/budgets');
            setBudgets(response.data.budgets ?? []);
            setStatus('ready');
        } catch {
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        queueMicrotask(fetchBudgets);
    }, [fetchBudgets]);

    return (
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
            <header className="mb-6">
                <h1 className="text-2xl font-semibold tracking-tight">
                    Budget
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Monthly spending limits by category.
                </p>
            </header>

            <section className="mb-8 rounded-xl border border-border bg-surface p-5 shadow-sm">
                <h2 className="mb-3 text-sm font-medium text-muted-foreground">
                    Set budget
                </h2>
                <SetBudgetForm
                    existingCategories={budgets.map((b) => b.category)}
                    onSaved={fetchBudgets}
                />
            </section>

            {status === 'loading' && <BudgetsSkeleton />}

            {status === 'error' && (
                <div
                    role="alert"
                    className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-6 py-16 text-center shadow-sm"
                >
                    <p className="text-sm text-muted-foreground">
                        We couldn&apos;t load your budgets.
                    </p>
                    <button
                        type="button"
                        onClick={fetchBudgets}
                        className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        Try again
                    </button>
                </div>
            )}

            {status === 'ready' && budgets.length === 0 && (
                <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-surface px-6 py-16 text-center shadow-sm">
                    <p className="text-sm font-medium">No budgets set</p>
                    <p className="text-sm text-muted-foreground">
                        Set one above to start tracking this month&apos;s
                        spending.
                    </p>
                </div>
            )}

            {status === 'ready' && budgets.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {budgets.map((budget) => (
                        <BudgetCard
                            key={budget.id}
                            budget={budget}
                            onChanged={fetchBudgets}
                        />
                    ))}
                </div>
            )}
        </main>
    );
}

function SetBudgetForm({
    existingCategories,
    onSaved,
}: {
    existingCategories: PlaidPrimaryCategory[];
    onSaved: () => void;
}) {
    const categories = BUDGETABLE_CATEGORIES;
    const [category, setCategory] = useState<PlaidPrimaryCategory | ''>('');
    const [monthlyAmount, setMonthlyAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!category) {
            setError('Select a category.');
            return;
        }
        const amount = Number(monthlyAmount);
        if (!Number.isFinite(amount) || amount <= 0) {
            setError('Enter a positive monthly amount.');
            return;
        }
        setSubmitting(true);
        setError(null);
        try {
            await axios.post('/api/budgets', {
                category,
                monthlyAmount: amount,
            });
            setCategory('');
            setMonthlyAmount('');
            onSaved();
        } catch {
            setError('Failed to save budget.');
        } finally {
            setSubmitting(false);
        }
    };

    const isUpdate = category !== '' && existingCategories.includes(category);

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-wrap items-end gap-3"
        >
            <div className="flex flex-1 min-w-48 flex-col gap-1">
                <label
                    htmlFor="budget-category"
                    className="text-xs font-medium text-muted-foreground"
                >
                    Category
                </label>
                <select
                    id="budget-category"
                    value={category}
                    onChange={(e) =>
                        setCategory(e.target.value as PlaidPrimaryCategory | '')
                    }
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    <option value="" disabled>
                        Select category
                    </option>
                    {categories.map((c) => (
                        <option key={c} value={c}>
                            {formatPlaidPrimaryCategory(c)}
                        </option>
                    ))}
                </select>
            </div>
            <div className="flex w-36 flex-col gap-1">
                <label
                    htmlFor="budget-amount"
                    className="text-xs font-medium text-muted-foreground"
                >
                    Monthly amount
                </label>
                <input
                    id="budget-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyAmount}
                    onChange={(e) => setMonthlyAmount(e.target.value)}
                    placeholder="500"
                    className="rounded-lg border border-border bg-transparent px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                />
            </div>
            <button
                type="submit"
                disabled={submitting}
                className="cursor-pointer rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
                {submitting
                    ? 'Saving…'
                    : isUpdate
                      ? 'Update budget'
                      : 'Create budget'}
            </button>
            {error && (
                <p role="alert" className="w-full text-sm text-negative">
                    {error}
                </p>
            )}
        </form>
    );
}

function BudgetCard({
    budget,
    onChanged,
}: {
    budget: BudgetProgress;
    onChanged: () => void;
}) {
    const [busy, setBusy] = useState(false);

    const handleDelete = async () => {
        if (
            !confirm(
                `Delete the ${formatPlaidPrimaryCategory(budget.category)} budget?`
            )
        )
            return;
        setBusy(true);
        try {
            await axios.delete(`/api/budgets/${budget.id}`);
            onChanged();
        } finally {
            setBusy(false);
        }
    };

    return (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium">
                    {formatPlaidPrimaryCategory(budget.category)}
                </h3>
                <button
                    type="button"
                    onClick={handleDelete}
                    disabled={busy}
                    className="cursor-pointer rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-negative transition-colors hover:bg-negative/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    Delete
                </button>
            </div>

            <div className="mt-4">
                <ProgressBar value={budget.spent} max={budget.monthlyAmount} />
                <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span>
                        Spent{' '}
                        <span className="font-medium text-foreground/90">
                            {formatCurrency(budget.spent)}
                        </span>
                    </span>
                    <span>
                        Limit{' '}
                        <span className="font-medium text-foreground/90">
                            {formatCurrency(budget.monthlyAmount)}
                        </span>
                    </span>
                    <span>
                        Remaining{' '}
                        <span
                            className={`font-medium ${
                                budget.remaining < 0
                                    ? 'text-negative'
                                    : 'text-foreground/90'
                            }`}
                        >
                            {formatCurrency(budget.remaining)}
                        </span>
                    </span>
                </div>
            </div>
        </section>
    );
}

function BudgetsSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
                <div
                    key={i}
                    className="rounded-xl border border-border bg-surface p-5 shadow-sm"
                >
                    <div className="h-4 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                    <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
                </div>
            ))}
        </div>
    );
}
