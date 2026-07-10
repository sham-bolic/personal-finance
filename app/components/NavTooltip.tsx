// Wraps a nav icon so hovering it (desktop only) reveals a floating label
// bubble instead of expanding the rail's width. `group` is scoped to this
// wrapper, so sibling items don't affect each other's tooltip.
export function NavTooltip({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="group relative w-full">
            {children}
            <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-x-1 -translate-y-1/2 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-background opacity-0 shadow-lg transition-all duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-100 md:block">
                {label}
            </span>
        </div>
    );
}
