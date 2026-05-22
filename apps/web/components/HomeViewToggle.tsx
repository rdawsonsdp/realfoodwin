// Segmented toggle between the swap-first home (/home-v3) and the coach
// view (/home-v2). The classic layout has been retired.

import Link from "next/link";

interface Props {
  active: "coach" | "swap";
}

export function HomeViewToggle({ active }: Props) {
  const pill = (isActive: boolean) =>
    `px-4 py-1.5 rounded-pill text-sm font-semibold transition ${
      isActive ? "bg-paper text-ink shadow-card" : "text-paper/80 hover:text-paper"
    }`;
  return (
    <div className="mb-6 flex justify-center">
      <div className="inline-flex items-center gap-1 rounded-pill bg-paper/15 ring-1 ring-paper/20 p-1 backdrop-blur-sm">
        <Link href="/home-v3" className={pill(active === "swap")}>
          Swap
        </Link>
        <Link href="/home-v2" className={pill(active === "coach")}>
          Coach
        </Link>
      </div>
    </div>
  );
}
