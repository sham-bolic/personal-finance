'use client';
import axios from 'axios';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { BudgetProgress, GoalWithProgress } from '@/lib/db/types';
import { formatPlaidPrimaryCategory } from '@/lib/plaid_categories';
import { formatCurrency } from './format';
import { ProgressBar } from '@/app/components/ProgressBar';

const TOP_N = 3;

// No "pinned" concept yet, so rank goals/budgets by how soon they need
// attention: goals by nearest target date (undated goals sort last), budgets
// by how close to (or over) their limit they are.
function topGoals(goals: GoalWithProgress[]): GoalWithProgress[] {
    return goals
        .filter((g) => g.status === 'active')
        .sort((a, b) => {
            if (a.targetDate && b.targetDate) {
                return a.targetDate.localeCompare(b.targetDate);
            }
            if (a.targetDate) return -1;
            if (b.targetDate) return 1;
            const aPct =
                a.targetAmount > 0 ? a.contributed / a.targetAmount : 0;
            const bPct =
                b.targetAmount > 0 ? b.contributed / b.targetAmount : 0;
            return bPct - aPct;
        })
        .slice(0, TOP_N);
}

function topBudgets(budgets: BudgetProgress[]): BudgetProgress[] {
    return [...budgets]
        .sort((a, b) => a.remaining - b.remaining)
        .slice(0, TOP_N);
}

export function GoalsBudgetsWidget() {
    const [goals, setGoals] = useState<GoalWithProgress[]>([]);
    const [budgets, setBudgets] = useState<BudgetProgress[]>([]);
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading'
    );

    const fetchData = useCallback(async () => {
        setStatus('loading');
        try {
            const [goalsRes, budgetsRes] = await Promise.all([
                axios.get('/api/goals'),
                axios.get('/api/budgets'),
            ]);
            setGoals(goalsRes.data.goals ?? []);
            setBudgets(budgetsRes.data.budgets ?? []);
            setStatus('ready');
        } catch {
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        queueMicrotask(fetchData);
    }, [fetchData]);

    return (
        <div>
            <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium text-muted-foreground">
                    Goals &amp; Budget
                </h2>
            </div>

            {status === 'loading' && <WidgetSkeleton />}

            {status === 'error' && (
                <div
                    role="alert"
                    className="mt-4 flex flex-col items-center gap-3 py-10 text-center"
                >
                    <p className="text-sm text-muted-foreground">
                        We couldn&apos;t load your goals and budgets.
                    </p>
                    <button
                        type="button"
                        onClick={fetchData}
                        className="cursor-pointer rounded-lg border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                        Try again
                    </button>
                </div>
            )}

            {status === 'ready' && (
                <div className="mt-4 flex flex-col gap-6">
                    <WidgetSection
                        title="Goals"
                        href="/goals"
                        emptyLabel="No goals yet"
                    >
                        {topGoals(goals).map((goal) => (
                            <li key={goal.id} className="flex flex-col gap-1">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-foreground/90">
                                        {goal.name}
                                    </span>
                                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                        {formatCurrency(goal.contributed)} /{' '}
                                        {formatCurrency(goal.targetAmount)}
                                    </span>
                                </div>
                                <ProgressBar
                                    value={goal.contributed}
                                    max={goal.targetAmount}
                                />
                            </li>
                        ))}
                    </WidgetSection>

                    <div className="border-t border-border pt-6">
                        <WidgetSection
                            title="Budget"
                            href="/budgets"
                            emptyLabel="No budgets set"
                        >
                            {topBudgets(budgets).map((budget) => (
                                <li
                                    key={budget.id}
                                    className="flex flex-col gap-1"
                                >
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-foreground/90">
                                            {formatPlaidPrimaryCategory(
                                                budget.category
                                            )}
                                        </span>
                                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                            {formatCurrency(budget.spent)} /{' '}
                                            {formatCurrency(
                                                budget.monthlyAmount
                                            )}
                                        </span>
                                    </div>
                                    <ProgressBar
                                        value={budget.spent}
                                        max={budget.monthlyAmount}
                                    />
                                </li>
                            ))}
                        </WidgetSection>
                    </div>
                </div>
            )}
        </div>
    );
}

function WidgetSection({
    title,
    href,
    emptyLabel,
    children,
}: {
    title: string;
    href: string;
    emptyLabel: string;
    children: React.ReactNode;
}) {
    const isEmpty = !Array.isArray(children) || children.length === 0;

    return (
        <div>
            <div className="flex items-center justify-between">
                <h3 className="text-xs font-medium text-muted-foreground">
                    {title}
                </h3>
                <Link
                    href={href}
                    className="text-xs font-medium text-link hover:underline"
                >
                    View all →
                </Link>
            </div>
            {isEmpty ? (
                <p className="mt-3 text-sm text-muted-foreground">
                    {emptyLabel}
                </p>
            ) : (
                <ul className="mt-3 flex flex-col gap-3">{children}</ul>
            )}
        </div>
    );
}

function WidgetSkeleton() {
    return (
        <div className="mt-4 flex flex-col gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-3">
                    {Array.from({ length: 3 }).map((_, j) => (
                        <div key={j} className="flex flex-col gap-1">
                            <div className="h-3 w-24 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                            <div className="h-2 w-full animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}
