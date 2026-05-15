// Read-only display for listing cards. Compact: stars + (avg) (count).

interface Props {
  avg?: number;
  count?: number;
  size?: "sm" | "md";
}

export function AverageStars({ avg, count, size = "sm" }: Props) {
  if (!avg || !count) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-muted">
        <span className="text-ink/20">★★★★★</span>
        <span className="italic">Unrated</span>
      </span>
    );
  }
  const filled = Math.round(avg);
  const cls = size === "md" ? "text-base" : "text-sm";
  return (
    <span className={`inline-flex items-center gap-1 ${cls}`}>
      <span aria-hidden>
        <span className="text-sunrise">{"★".repeat(filled)}</span>
        <span className="text-ink/20">{"★".repeat(5 - filled)}</span>
      </span>
      <span className="text-ink font-semibold">{avg.toFixed(1)}</span>
      <span className="text-ink-muted">({count})</span>
    </span>
  );
}
