import type { HoldingDTO } from '@/lib/db/types';
import {
    computePortfolioTotals,
    formatCurrency,
    formatSignedCurrency,
    formatSignedPercent,
    gainLossColor,
} from './format';

// Portfolio-wide cost basis and unrealized return, aggregated only over
// holdings that report a cost basis - see computePortfolioTotals for why
// the rest are excluded rather than zeroed.
export function PortfolioTotals({ holdings }: { holdings: HoldingDTO[] }) {
    const { costBasis, gainLoss, gainLossPercent } =
        computePortfolioTotals(holdings);
    const color = gainLossColor(gainLoss);

    return (
        <section className="rounded-2xl border border-border/60 bg-surface p-6">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">
                Unrealized return
            </h2>
            <div className="flex flex-wrap gap-x-10 gap-y-4">
                <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                        Total cost basis
                    </span>
                    <span className="font-mono text-lg font-medium tabular-nums">
                        {formatCurrency(costBasis)}
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                        Unrealized gain/loss
                    </span>
                    <span
                        className={`font-mono text-lg font-medium tabular-nums ${color}`}
                    >
                        {formatSignedCurrency(gainLoss)}
                    </span>
                </div>
                <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">
                        Return
                    </span>
                    <span
                        className={`font-mono text-lg font-medium tabular-nums ${color}`}
                    >
                        {gainLossPercent === null
                            ? '—'
                            : formatSignedPercent(gainLossPercent)}
                    </span>
                </div>
            </div>
        </section>
    );
}
