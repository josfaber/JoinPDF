import Sortable from "sortablejs";
import { FileList, type FileEntry } from "../../src/fileList";
import { countPages, mergePdfs, PdfInputError } from "../../src/merge";
import { initI18n, onLangChange, t } from "./i18n";
import "./styles.css";

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

const listEl = $<HTMLUListElement>("#files");
const dropZone = $<HTMLElement>("#drop-zone");
const emptyHint = $<HTMLElement>("#empty-hint");
const fileInput = $<HTMLInputElement>("#file-input");
const addBtn = $<HTMLButtonElement>("#add");
const clearBtn = $<HTMLButtonElement>("#clear");
const exportBtn = $<HTMLButtonElement>("#export");
const statusEl = $<HTMLElement>("#status");

// Files stay in memory in this tab only; keys identify them in the list.
const blobs = new Map<string, File>();
const files = new FileList();
let busy = false;
let lastStatus: (() => void) | null = null;

const fileKey = (f: File) => `${f.name}\u0000${f.size}\u0000${f.lastModified}`;
const isPdf = (f: File) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");

// ---------- rendering ----------

function metaText(entry: FileEntry): string {
  switch (entry.status.state) {
    case "loading":
      return "…";
    case "ok":
      return t("pages", { n: entry.status.pages });
    case "error":
      return t(entry.status.message as "encrypted" | "invalid" | "unreadable");
  }
}

function renderRow(entry: FileEntry, index: number): HTMLLIElement {
  const li = document.createElement("li");
  li.className = "row";
  li.dataset.id = String(entry.id);
  if (entry.status.state === "error") li.classList.add("row-error");
  li.innerHTML = `
    <span class="handle" aria-hidden="true">⋮⋮</span>
    <span class="index"></span>
    <span class="name"></span>
    <span class="meta"></span>
    <button class="remove" type="button">✕</button>`;
  li.querySelector(".index")!.textContent = `${index + 1}.`;
  const name = li.querySelector<HTMLElement>(".name")!;
  name.textContent = entry.name;
  name.title = entry.name;
  li.querySelector(".meta")!.textContent = metaText(entry);
  const remove = li.querySelector<HTMLButtonElement>(".remove")!;
  remove.title = t("remove");
  remove.setAttribute("aria-label", `${t("remove")}: ${entry.name}`);
  remove.addEventListener("click", () => {
    blobs.delete(entry.path);
    files.remove(entry.id);
  });
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
  exportBtn.disabled = busy || ready < 2 || blocked;
}

files.onChange(render);
onLangChange(() => {
  render();
  lastStatus?.();
});

Sortable.create(listEl, {
  animation: 150,
  forceFallback: true,
  fallbackOnBody: true,
  ghostClass: "row-ghost",
  fallbackClass: "row-drag",
  filter: ".remove",
  preventOnFilter: false,
  // Let touch users scroll the list; a short press starts a drag.
  delay: 150,
  delayOnTouchOnly: true,
  onChange: () => {
    listEl.querySelectorAll<HTMLElement>(".row .index").forEach((el, i) => (el.textContent = `${i + 1}.`));
  },
  onEnd: () => {
    const ids = [...listEl.querySelectorAll<HTMLElement>(".row")].map((li) => Number(li.dataset.id));
    files.setOrder(ids);
  },
});

// ---------- status ----------

function setStatus(fn: () => string, kind: "info" | "error" | "ok" = "info"): void {
  lastStatus = () => {
    statusEl.className = `status status-${kind}`;
    statusEl.textContent = fn();
  };
  lastStatus();
}

function clearStatus(): void {
  lastStatus = null;
  statusEl.textContent = "";
}

// ---------- adding files ----------

async function addFiles(list: Iterable<File>): Promise<void> {
  const all = [...list];
  const pdfs = all.filter(isPdf);
  const skipped = all.length - pdfs.length;
  if (skipped) setStatus(() => t("skipped", { n: skipped }));
  else clearStatus();

  for (const f of pdfs) if (!blobs.has(fileKey(f))) blobs.set(fileKey(f), f);
  const added = files.add(pdfs.map(fileKey), (key) => blobs.get(key)!.name);

  await Promise.all(
    added.map(async (entry) => {
      try {
        const bytes = new Uint8Array(await blobs.get(entry.path)!.arrayBuffer());
        files.setStatus(entry.id, { state: "ok", pages: await countPages({ name: entry.name, bytes }) });
      } catch (err) {
        const message = err instanceof PdfInputError ? err.kind : "unreadable";
        files.setStatus(entry.id, { state: "error", message });
      }
    }),
  );
}

addBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files) void addFiles(fileInput.files);
  fileInput.value = "";
});

clearBtn.addEventListener("click", () => {
  files.clear();
  blobs.clear();
  clearStatus();
});

// Accept file drops anywhere on the page; never let the browser open the file.
let dragDepth = 0;
const hasFiles = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files");
window.addEventListener("dragenter", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth++;
  dropZone.classList.add("drag-over");
});
window.addEventListener("dragover", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  e.dataTransfer!.dropEffect = busy ? "none" : "copy";
});
window.addEventListener("dragleave", (e) => {
  if (!hasFiles(e)) return;
  if (--dragDepth <= 0) {
    dragDepth = 0;
    dropZone.classList.remove("drag-over");
  }
});
window.addEventListener("drop", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  dropZone.classList.remove("drag-over");
  if (!busy && e.dataTransfer?.files.length) void addFiles(e.dataTransfer.files);
});

// ---------- export ----------

function timestamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function download(bytes: Uint8Array, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  // Give the browser time to start the download before releasing the memory.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

exportBtn.addEventListener("click", async () => {
  busy = true;
  render();
  setStatus(() => t("merging"));
  try {
    const inputs = [];
    for (const entry of files.items) {
      inputs.push({ name: entry.name, bytes: new Uint8Array(await blobs.get(entry.path)!.arrayBuffer()) });
    }
    const name = `merged-${timestamp()}.pdf`;
    download(await mergePdfs(inputs), name);
    setStatus(() => t("done", { name }), "ok");
  } catch (err) {
    if (err instanceof PdfInputError) {
      const { kind, fileName } = err;
      setStatus(() => t(kind === "encrypted" ? "errEncrypted" : "errInvalid", { name: fileName }), "error");
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus(() => t("errGeneric", { msg }), "error");
    }
  } finally {
    busy = false;
    render();
  }
});

initI18n();
render();
