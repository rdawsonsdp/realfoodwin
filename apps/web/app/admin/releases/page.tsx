import fs from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

interface ReleaseEntry {
  version: string;
  date: string | null;
  title: string;
  bullets: string[];
}

async function loadChangelog(): Promise<{ entries: ReleaseEntry[]; error: string | null }> {
  try {
    const file = path.join(process.cwd(), "CHANGELOG.md");
    const raw = await fs.readFile(file, "utf8");
    return { entries: parseChangelog(raw), error: null };
  } catch (err) {
    return { entries: [], error: err instanceof Error ? err.message : String(err) };
  }
}

function parseChangelog(raw: string): ReleaseEntry[] {
  const lines = raw.split(/\r?\n/);
  const entries: ReleaseEntry[] = [];
  let current: ReleaseEntry | null = null;

  for (const line of lines) {
    const header = line.match(/^##\s+(\S+)\s*(?:—|--|-)\s*(\d{4}-\d{2}-\d{2})?\s*(?:—|--|-)?\s*(.*)$/);
    if (header) {
      if (current) entries.push(current);
      current = {
        version: header[1] ?? "",
        date: header[2] ?? null,
        title: header[3]?.trim() ?? "",
        bullets: [],
      };
      continue;
    }
    if (current) {
      const bullet = line.match(/^\s*[-*]\s+(.+)$/);
      if (bullet) current.bullets.push(bullet[1]!.trim());
    }
  }
  if (current) entries.push(current);
  return entries;
}

export default async function AdminReleasesPage() {
  const { entries, error } = await loadChangelog();
  const [current, ...history] = entries;

  return (
    <div className="space-y-6">
      <p className="text-sm text-paper/80">
        Release notes for the current version, plus full revision history. Edit
        <code className="mx-1 px-1.5 py-0.5 rounded bg-paper/20 text-paper">apps/web/CHANGELOG.md</code>
        and redeploy to update.
      </p>

      {error && (
        <div className="card p-5 text-coral">
          <strong>Couldn't read CHANGELOG.md:</strong> {error}
        </div>
      )}

      {!error && entries.length === 0 && (
        <div className="card p-5 text-ink-soft">No releases yet.</div>
      )}

      {current && (
        <section className="card p-5 md:p-6 space-y-3 ring-2 ring-coral/30">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-coral font-bold mb-1">
                Current release
              </p>
              <h2 className="text-xl font-bold text-ink">
                {current.version}
                {current.title && (
                  <span className="text-ink-soft font-normal"> · {current.title}</span>
                )}
              </h2>
            </div>
            {current.date && (
              <span className="text-xs text-ink-muted whitespace-nowrap">
                {current.date}
              </span>
            )}
          </div>
          <ul className="space-y-2 list-disc pl-5 text-sm text-ink-soft">
            {current.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </section>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-widest text-paper/70 px-1">
            Revision history
          </h3>
          {history.map((e) => (
            <details key={e.version} className="card overflow-hidden">
              <summary className="cursor-pointer p-4 flex items-center justify-between gap-3 hover:bg-honey/30 transition-colors">
                <div className="min-w-0">
                  <span className="font-bold text-ink">{e.version}</span>
                  {e.title && (
                    <span className="text-ink-soft"> · {e.title}</span>
                  )}
                </div>
                <span className="text-xs text-ink-muted whitespace-nowrap">
                  {e.date ?? ""}
                </span>
              </summary>
              <ul className="px-5 pb-5 pt-2 space-y-2 list-disc pl-9 text-sm text-ink-soft">
                {e.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      )}
    </div>
  );
}
