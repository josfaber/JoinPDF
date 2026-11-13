export type FileStatus =
  | { state: "loading" }
  | { state: "ok"; pages: number }
  | { state: "error"; message: string };

export interface FileEntry {
  id: number;
  path: string;
  name: string;
  status: FileStatus;
}

let nextId = 1;

export function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

export function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith(".pdf");
}

/** Ordered list of files with change notifications. */
export class FileList {
  private entries: FileEntry[] = [];
  private listeners = new Set<() => void>();

  get items(): readonly FileEntry[] {
    return this.entries;
  }

  onChange(fn: () => void): void {
    this.listeners.add(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  /** Adds paths not already present. Returns the newly added entries. */
  add(paths: string[]): FileEntry[] {
    const known = new Set(this.entries.map((e) => e.path));
    const added: FileEntry[] = [];
    for (const path of paths) {
      if (known.has(path)) continue;
      known.add(path);
      const entry: FileEntry = { id: nextId++, path, name: baseName(path), status: { state: "loading" } };
      this.entries.push(entry);
      added.push(entry);
    }
    if (added.length) this.emit();
    return added;
  }

  setStatus(id: number, status: FileStatus): void {
    const entry = this.entries.find((e) => e.id === id);
    if (!entry) return;
    entry.status = status;
    this.emit();
  }

  remove(id: number): void {
    this.entries = this.entries.filter((e) => e.id !== id);
    this.emit();
  }

  clear(): void {
    this.entries = [];
    this.emit();
  }

  /**
   * Reorders to match `ids` (e.g. read from the DOM after a drag). Unknown ids
   * are ignored; entries missing from `ids` keep their relative order at the end.
   */
  setOrder(ids: number[]): void {
    const byId = new Map(this.entries.map((e) => [e.id, e]));
    const ordered: FileEntry[] = [];
    for (const id of ids) {
      const entry = byId.get(id);
      if (entry) {
        ordered.push(entry);
        byId.delete(id);
      }
    }
    ordered.push(...this.entries.filter((e) => byId.has(e.id)));
    this.entries = ordered;
    this.emit();
  }
}
