# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Personal Finance
**Category:** Personal Finance Tracker (dashboard/admin pattern, not marketing/landing)
**Direction:** Dark-first fintech, full light-mode parity via CSS custom properties

---

## Global Rules

### Color Palette

Trust blue + profit green. Tokens are CSS custom properties in `app/globals.css`,
swapped per-mode via `@media (prefers-color-scheme: dark)`, and exposed as Tailwind
utilities through `@theme inline` (e.g. `bg-surface`, `text-muted-foreground`,
`border-border`, `bg-primary`, `text-positive`, `text-negative`, `text-warning`, `text-link`).

| Role | Light | Dark | CSS Variable |
|------|-------|------|--------------|
| Background (page) | `#f8fafc` | `#0b1220` | `--background` |
| Foreground (text) | `#0f172a` | `#f1f5f9` | `--foreground` |
| Surface (cards) | `#ffffff` | `#131c30` | `--surface` |
| Surface hover | `#f1f5f9` | `#1b2540` | `--surface-hover` |
| Muted (tracks/skeletons) | `#f1f5f9` | `#1b2540` | `--muted` |
| Muted foreground | `#64748b` | `#94a3b8` | `--muted-foreground` |
| Border | `#e2e8f0` | `rgba(255,255,255,0.08)` | `--border` |
| Primary (buttons/active) | `#2563eb` | `#2563eb` | `--primary` |
| Primary hover | `#1d4ed8` | `#3b82f6` | `--primary-hover` |
| Link/accent text | `#1d4ed8` | `#60a5fa` | `--link` |
| Positive (inflow/success) | `#047857` | `#34d399` | `--positive` |
| Negative (destructive/over-budget) | `#dc2626` | `#f87171` | `--negative` |
| Warning (budget near limit) | `#b45309` | `#fbbf24` | `--warning` |

All text-color pairings were picked to clear WCAG AA (4.5:1) against their
background in both modes (e.g. `emerald-700` not `emerald-600` for light-mode
positive text — `emerald-600` on white falls short at ~3.85:1).

### Typography

- **Font:** IBM Plex Sans (`--font-plex-sans`), loaded via `next/font/google` in `app/layout.tsx`.
- **Numeric/tabular data:** IBM Plex Mono (`--font-plex-mono`) — used on large currency
  figures (net worth) and account balances for a "financial precision" feel.
- **Mood:** financial, trustworthy, professional — matches banking/fintech conventions.

### Component Conventions

- Cards: `rounded-xl border border-border bg-surface p-5 shadow-sm`.
- Buttons (primary): `bg-primary text-primary-foreground hover:bg-primary-hover`.
- Buttons (secondary/outline): `border border-border hover:bg-surface-hover`.
- Destructive actions: `text-negative hover:bg-negative/10`.
- Progress bars (`app/components/ProgressBar.tsx`): track `bg-muted`, fill escalates
  `bg-primary` → `bg-warning` (≥80%) → `bg-negative` (≥100%).
- Focus rings: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary` everywhere (no more one-off `outline-blue-700`).
- Recharts: line strokes and tooltip `contentStyle` reference the raw CSS vars
  directly (`stroke="var(--primary)"`, `background: 'var(--surface)'`) since SVG/inline
  styles don't go through Tailwind's utility scanner — this makes charts theme-reactive
  without any JS-based dark-mode detection.
- Transaction category column uses a small deterministic color dot (hashed from
  category name, decorative only, redundant with the text label — not the sole
  carrier of meaning).

## Anti-Patterns (Do NOT Use)

- No emojis as icons — this app uses `lucide-react` exclusively.
- No hardcoded `black/NN` or `white/NN` opacity utilities for chrome/text/borders —
  use the semantic tokens above so light/dark stay in sync automatically.
- No per-component one-off hex colors for anything that appears more than once.

## Known Gotcha

The Next.js/Turbopack dev server's CSS cache can go stale after large `@theme`
token changes in `globals.css` — new utility classes silently fail to compile
(page still renders, just unstyled/colorless) until the dev server is restarted.
Production builds (`npm run build`) are unaffected. If new semantic-token utilities
don't seem to apply during dev, restart `npm run dev` before assuming it's a code bug.
