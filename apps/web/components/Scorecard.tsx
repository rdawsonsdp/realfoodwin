// Server component — renders a gamified scorecard.

interface Props {
  swaps: number;
  saved: number;
  madeIt: number;
  rated: number;
  level: number;
  points: number;
  pointsToNextLevel: number;
}

const LEVEL_TITLES = [
  "Curious",
  "Tinkerer",
  "Home Cook",
  "Real-Food Chef",
  "Kitchen Captain",
  "Whole-Food Master",
];

function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)] ?? "Cook";
}

function nextMilestone(swaps: number, saved: number, madeIt: number): string | null {
  const milestones: { n: number; copy: string }[] = [
    { n: 1, copy: "1st swap" },
    { n: 5, copy: "5 swaps" },
    { n: 10, copy: "10 swaps" },
    { n: 25, copy: "25 swaps" },
    { n: 50, copy: "50 swaps" },
    { n: 100, copy: "100 swaps" },
  ];
  const next = milestones.find((m) => m.n > swaps);
  if (next) return `${next.n - swaps} more to unlock ${next.copy}`;
  if (saved === 0) return "Save your first swap to My Kitchen";
  if (madeIt === 0) return "Mark one 'Made it & loved it' to earn your first Victory Token";
  return null;
}

export function Scorecard({
  swaps,
  saved,
  madeIt,
  rated,
  level,
  points,
  pointsToNextLevel,
}: Props) {
  const pct = pointsToNextLevel > 0 ? Math.min(100, Math.round((points / pointsToNextLevel) * 100)) : 100;
  const next = nextMilestone(swaps, saved, madeIt);

  return (
    <section className="card overflow-hidden mb-10">
      <div className="bg-gradient-to-br from-sunrise via-sunrise-600 to-coral text-white p-5 md:p-8">
        <div className="flex items-start justify-between gap-4 md:gap-6 flex-wrap">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] opacity-80">Chef level {level}</p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mt-1">{levelTitle(level)}</h2>
            {next && <p className="opacity-90 mt-2 text-sm">{next}</p>}
          </div>
          <div className="text-right">
            <div className="text-4xl md:text-5xl font-extrabold leading-none tracking-tight">{swaps}</div>
            <div className="text-xs uppercase tracking-[0.2em] opacity-80 mt-1">
              {swaps === 1 ? "swap" : "swaps"} total
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex justify-between text-xs opacity-90 mb-1.5">
            <span>{points} pts</span>
            <span>{pointsToNextLevel} pts to Lv {level + 1}</span>
          </div>
          <div className="h-2 bg-white/25 rounded-pill overflow-hidden">
            <div
              className="h-full bg-honey rounded-pill transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* 2×2 on phones, 4-col strip on md+. Borders drawn via gap+bg so we
          don't get an awkward divide-y on the first row. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-ink/5">
        <Tile icon="🍳" label="Swaps" value={swaps} sub="generated" />
        <Tile icon="📖" label="Kitchen" value={saved} sub="saved" />
        <Tile icon="🏆" label="Made It" value={madeIt} sub="loved it" />
        <Tile icon="⭐" label="Rated" value={rated} sub="reviews" />
      </div>
    </section>
  );
}

function Tile({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: number;
  sub: string;
}) {
  return (
    <div className="p-4 md:p-5 text-center bg-paper">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-2xl font-bold text-ink leading-none">{value}</div>
      <div className="text-xs text-ink-muted uppercase tracking-wider mt-1.5">{label}</div>
      <div className="text-xs text-ink-soft">{sub}</div>
    </div>
  );
}
