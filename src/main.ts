import Sortable from "sortablejs";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { join } from "@tauri-apps/api/path";
import { open } from "@tauri-apps/plugin-dialog";
import { exists, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { FileList, isPdfPath, type FileEntry } from "./fileList";
import { countPages, mergePdfs, PdfInputError } from "./merge";
import "./styles.css";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const listEl = $<HTMLUListElement>("#files");
const dropZone = $<HTMLElement>("#drop-zone");
const emptyHint = $<HTMLElement>("#empty-hint");
const addBtn = $<HTMLButtonElement>("#add");
const clearBtn = $<HTMLButtonElement>("#clear");
const generateBtn = $<HTMLButtonElement>("#generate");
const statusEl = $<HTMLElement>("#status");

const files = new FileList();
let busy = false;

// ---------- rendering ----------

function renderRow(entry: FileEntry, index: number): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "row";
  li.dataset.id = String(entry.id);
  li.title = entry.path;

  let meta = "…";
  if (entry.status.state === "ok") meta = `${entry.status.pages} p`;
  if (entry.status.state === "error") {
    li.classList.add("row-error");
    meta = entry.status.message;
  }

  li.innerHTML = `
    <span class="handle" aria-hidden="true">⋮⋮</span>
    <span class="index"></span>
    <span class="name"></span>
    <span class="meta"></span>
    <button class="remove" title="Remove" aria-label="Remove">✕</button>`;
  li.querySelector(".index")!.textContent = `${index + 1}.`;
  li.querySelector(".name")!.textContent = entry.name;
  li.querySelector(".meta")!.textContent = meta;
  li.querySelector(".remove")!.addEventListener("click", () => files.remove(entry.id));
  return li;
}

function render(): void {
  listEl.replaceChildren(...files.items.map(renderRow));
  const count = files.items.length;
  emptyHint.hidden = count > 0;
  clearBtn.disabled = busy || count === 0;
  addBtn.disabled = busy;
  const ready = files.items.filter((f) => f.status.state === "ok").length;
  const blocked = files.items.some((f) => f.status.state !== "ok");
  generateBtn.disabled = busy || ready < 2 || blocked;
}

files.onChange(render);

Sortable.create(listEl, {
  animation: 150,
  // While dragging, the row's slot in the list is shown as a drop line
  // (.row-ghost) and a floating copy (.row-drag) follows the pointer.
  // forceFallback avoids HTML5 drag-and-drop, which conflicts with Tauri's
  // native file drop on Windows.
  forceFallback: true,
  ghostClass: "row-ghost",
  fallbackClass: "row-drag",
  onEnd: (evt) => {
    if (evt.oldIndex == null || evt.newIndex == null) return;
    files.move(evt.oldIndex, evt.newIndex);
  },
});

// ---------- status ----------

function setStatus(message: string, kind: "info" | "error" | "ok" = "info", reveal?: string): void {
  statusEl.className = `status status-${kind}`;
  statusEl.textContent = message;
  if (reveal) {
    const link = document.createElement("button");
    link.className = "link";
    link.textContent = navigator.userAgent.includes("Mac") ? "Show in Finder" : "Show in Explorer";
    link.addEventListener("click", () => revealItemInDir(reveal));
    statusEl.append(" ", link);
  }
}

// ---------- adding files ----------

async function addPaths(paths: string[]): Promise<void> {
  const pdfs = paths.filter(isPdfPath);
  const skipped = paths.length - pdfs.length;
  if (skipped) setStatus(`Skipped ${skipped} file${skipped > 1 ? "s" : ""} that ${skipped > 1 ? "aren't" : "isn't"} a PDF.`);
  else statusEl.textContent = "";

  const added = files.add(pdfs);
  await Promise.all(
    added.map(async (entry) => {
      try {
        const pages = await countPages({ name: entry.name, bytes: await readFile(entry.path) });
        files.setStatus(entry.id, { state: "ok", pages });
      } catch (err) {
        const message =
          err instanceof PdfInputError
            ? err.kind === "encrypted" ? "password-protected" : "not a valid PDF"
            : "can't read file";
        files.setStatus(entry.id, { state: "error", message });
      }
    }),
  );
}

addBtn.addEventListener("click", async () => {
  const picked = await open({ multiple: true, filters: [{ name: "PDF", extensions: ["pdf", "PDF"] }] });
  if (picked) await addPaths(picked);
});

clearBtn.addEventListener("click", () => {
  files.clear();
  statusEl.textContent = "";
});

getCurrentWebview().onDragDropEvent((event) => {
  const { type } = event.payload;
  if (type === "enter" || type === "over") dropZone.classList.add("drag-over");
  else dropZone.classList.remove("drag-over");
  if (type === "drop" && !busy) void addPaths(event.payload.paths);
});

// ---------- generating ----------

function timestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function uniqueOutputPath(dir: string): Promise<string> {
  const base = `merged-${timestamp()}`;
  let candidate = await join(dir, `${base}.pdf`);
  for (let i = 2; await exists(candidate); i++) {
    candidate = await join(dir, `${base}-${i}.pdf`);
  }
  return candidate;
}

generateBtn.addEventListener("click", async () => {
  const dir = await open({ directory: true, title: "Choose output folder" });
  if (!dir) return;

  busy = true;
  render();
  setStatus("Merging…");
  try {
    const inputs = [];
    for (const entry of files.items) {
      inputs.push({ name: entry.name, bytes: await readFile(entry.path) });
    }
    const merged = await mergePdfs(inputs);
    const outPath = await uniqueOutputPath(dir);
    await writeFile(outPath, merged);
    setStatus(`Saved ${outPath.split(/[\\/]/).pop()}`, "ok", outPath);
  } catch (err) {
    setStatus(err instanceof Error ? err.message : String(err), "error");
  } finally {
    busy = false;
    render();
  }
});

render();
