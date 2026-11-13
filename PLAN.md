# JoinPDF — Plan

A small open-source desktop app for macOS and Windows that combines multiple PDFs into one.

## 1. Key decision: no Ghostscript

Ghostscript isn't needed to merge PDFs. Merging means copying page objects from several documents into one, and pure libraries do that without re-rendering anything. Leaving Ghostscript out:

- **Removes the installer problem.** The app ships as a single self-contained bundle, with no runtime dependency to install or locate.
- **Avoids AGPL.** Ghostscript is AGPL-licensed. Bundling it forces AGPL on the app or requires a commercial license from Artifex.
- **Keeps output faithful.** Ghostscript re-renders through `pdfwrite`, which can change fonts, images and file size. A structural merge keeps pages byte-faithful.
- **Is faster and smaller.** The download is a few MB instead of 50+ MB.

Merge library: **[pdf-lib](https://pdf-lib.js.org/)** (MIT). `PDFDocument.copyPages()` is the standard merge path, and it is mature and widely used.

Known limitation: pdf-lib can't decrypt password-protected PDFs. For v1, detect them and show a clear error. Fallback if that turns out to matter later: bundle `qpdf` (Apache-2.0, a small static binary) as a Tauri sidecar to decrypt or merge.

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| App shell | **Tauri v2** | Native webview, so the app is about 5–10 MB (Electron is about 100 MB). Cross-platform, builds installers with no admin rights. |
| UI | Vanilla TS + Vite (or Svelte if it grows) | The UI is one screen, so no framework is needed. |
| Drag-to-reorder | [SortableJS](https://github.com/SortableJS/Sortable) | Small, works with mouse and touch, handles animation. |
| Merge | pdf-lib (in the webview) | Pure JS, no native dependencies. |
| File I/O | `@tauri-apps/plugin-fs` and `@tauri-apps/plugin-dialog` | Reads input files, opens the folder picker, writes the output. |
| CI/release | GitHub Actions with `tauri-action` | Builds macOS (universal) and Windows artifacts on tag. |
| License | MIT | Compatible with all dependencies. |

Alternatives considered:
- **Electron:** heavier, with no real benefit here.
- **Native per platform** (SwiftUI with PDFKit, plus WinUI): two codebases.
- **Rust `lopdf` merge:** possible, but its merge needs manual object renumbering and is less robust than pdf-lib.

## 3. Distribution (no admin rights)

**macOS**
- `.dmg` containing `JoinPDF.app`. The user drags it to `/Applications` or `~/Applications`, which needs no admin rights.
- Universal binary (Apple Silicon and Intel).
- Not signed (decision). Ad-hoc signed (`signingIdentity: "-"`) so Apple Silicon runs it; users clear Gatekeeper once via Privacy & Security → Open Anyway.

**Windows**
- NSIS installer with `bundle.windows.nsis.installMode: "currentUser"`. It installs to `%LOCALAPPDATA%`, needs no UAC prompt and adds a Start-menu shortcut.
- Also publish a **portable `.exe`** (a zip) for people who want no install at all.
- WebView2 is preinstalled on Windows 10 and 11. Use `webviewInstallMode: downloadBootstrapper`, which only matters on older machines.
- Not signed (decision). Users click More info → Run anyway on SmartScreen.

## 4. UI

```
┌──────────────────────────────────────────┐
│  JoinPDF                                 │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────────┐  │
│  │ ≡  1. invoice-jan.pdf    3 pp   ✕  │  │
│  │ ≡  2. invoice-feb.pdf    2 pp   ✕  │  │
│  │ ≡  3. scan.pdf          12 pp   ✕  │  │
│  │                                    │  │
│  │     Drop PDF files here            │  │
│  └────────────────────────────────────┘  │
│  [ + Add files ]           [ Generate ]  │
└──────────────────────────────────────────┘
```

- **Drop zone:** the whole window accepts drops and the list highlights on drag-over. Non-PDF files are ignored, with a short toast.
- **+ button:** a native file picker with multiple selection and a `.pdf` filter.
- **List rows:** a drag handle, the order number, the file name (full path on hover), the page count and a remove button (✕). Drag any row to reorder.
- **Generate:** disabled until at least 2 files are in the list. It opens a native folder picker, writes `merged-YYYYMMDD-HHMMSS.pdf` into that folder and never overwrites an existing file. On success it shows a "Show in Finder/Explorer" link.
- Extras that cost almost nothing: a Clear-all button, Delete/Backspace to remove the selected row, and a dock or taskbar drop onto the app icon.

## 5. Project structure

```
joinpdf/
├─ src/                    # frontend
│  ├─ main.ts              # wiring: drop, add, sort, generate
│  ├─ merge.ts             # pdf-lib merge (pure, unit-testable)
│  ├─ fileList.ts          # list state + rendering
│  └─ styles.css
├─ src-tauri/
│  ├─ tauri.conf.json      # bundle config (dmg, nsis currentUser)
│  ├─ capabilities/        # fs/dialog permissions (scoped)
│  └─ src/main.rs          # minimal; plugin registration
├─ tests/                  # vitest: merge.ts against fixture PDFs
├─ .github/workflows/release.yml
├─ LICENSE  README.md
```

## 6. Implementation steps

1. **Scaffold.** Create the app with `npm create tauri-app` (vanilla-ts template). Add the fs and dialog plugins and SortableJS. Set the app name, icon and window size (about 480×560, resizable).
2. **Merge core** (`merge.ts`). The function `mergePdfs(inputs: Uint8Array[]): Promise<Uint8Array>` creates a new document, and for each input loads it, runs `copyPages` and adds the pages. It throws typed errors for encrypted or corrupt input. Unit-test it with vitest and fixture PDFs: normal, rotated pages, mixed page sizes, encrypted and corrupt.
3. **File list.** Keep the list state as an array of `{path, name, pages}` and get the page count when a file is added. Render the rows, connect SortableJS so a drop reorders the array, and add remove and clear.
4. **Inputs.** Handle Tauri `onDragDropEvent` (it gives real file paths) and the + button through `dialog.open({multiple: true, filters: [pdf]})`. Remove duplicates by path.
5. **Generate.** Open the folder picker with `dialog.open({directory: true})`, read the files, merge them, choose a unique file name and write it. Show a spinner while it runs and the result afterwards, with a "reveal" link through `plugin-opener`.
6. **Errors.** Name the file that failed, as in "scan.pdf is password-protected". Keep the list intact after a failure.
7. **Packaging.** Configure the dmg (universal target) and NSIS (`currentUser`), and add a portable zip step for Windows.
8. **CI.** A GitHub Actions matrix (`macos-latest` and `windows-latest`) with `tauri-action`. A tag `v*` creates a draft GitHub Release with the artifacts.
9. **Docs.** A README with screenshots, download links and the unsigned-app workaround for macOS and Windows.

## 7. Later (not v1)

- Page thumbnails and per-file page ranges, such as "pages 2–5".
- Fallback for encrypted PDFs through a qpdf sidecar, which prompts for the password.
- A Linux AppImage, which Tauri supports almost for free.
- Remember the last output folder.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Large PDFs (hundreds of MB) in webview memory | Fine for typical use. If it becomes an issue, move the merge to Rust with qpdf or lopdf. |
| Malformed PDFs that pdf-lib rejects | Clear per-file error; qpdf fallback later. |
| Unsigned-app warnings scare users | Clear first-launch instructions in the README and release notes. |
| Form fields or bookmarks lost on merge | pdf-lib's copyPages drops the document outline. Accept this for v1 and note it in the README. |
