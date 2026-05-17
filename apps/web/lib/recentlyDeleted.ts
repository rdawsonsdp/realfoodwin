// Per-browser cache of recently deleted kitchen entries, so the user can
// restore something they removed within the last day even after the inline
// "Undo" snackbar has faded.
//
// Entries are stored locally — no server schema change needed. The actual DB
// row is already gone; restore re-runs the save with the same target.

const KEY = "rfw.recentlyDeleted";
const TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX = 20;

export interface DeletedEntry {
  target_type: "swap" | "recipe" | "variant";
  target_id: string;
  title: string;
  deleted_at: number; // ms epoch
}

function read(): DeletedEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DeletedEntry[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - TTL_MS;
    return parsed.filter((e) => e?.deleted_at > cutoff).slice(0, MAX);
  } catch {
    return [];
  }
}

function write(list: DeletedEntry[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    // Notify same-tab listeners; the storage event only fires across tabs.
    window.dispatchEvent(new CustomEvent("rfw:recently-deleted-changed"));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getRecentlyDeleted(): DeletedEntry[] {
  return read();
}

export function pushRecentlyDeleted(entry: Omit<DeletedEntry, "deleted_at">): void {
  const list = read();
  // Dedupe by target — newest deletion wins.
  const filtered = list.filter(
    (e) => !(e.target_type === entry.target_type && e.target_id === entry.target_id),
  );
  filtered.unshift({ ...entry, deleted_at: Date.now() });
  write(filtered);
}

export function removeRecentlyDeleted(target_type: string, target_id: string): void {
  const list = read().filter(
    (e) => !(e.target_type === target_type && e.target_id === target_id),
  );
  write(list);
}

export function clearRecentlyDeleted(): void {
  write([]);
}
