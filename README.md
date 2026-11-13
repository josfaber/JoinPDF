# JoinPDF

A tiny desktop app for macOS and Windows that joins multiple PDFs into one.

- Drop PDFs into the window, or click **＋ Add files**
- Drag rows to set the order
- Click **Generate**, pick an output folder: you get `merged-YYYYMMDD-HHMMSS.pdf`

No Ghostscript, no admin rights, no network access. Pages are copied as-is (no re-rendering), so quality is unchanged.

## Download

Get the latest build from the [Releases](https://github.com/josfaber/JoinPDF/releases) page:

| Platform | File | Install |
|---|---|---|
| macOS (Intel + Apple Silicon) | `JoinPDF_x.y.z_universal.dmg` | Open the dmg, drag JoinPDF to Applications |
| Windows | `JoinPDF_x.y.z_x64-setup.exe` | Installs for the current user only, no admin needed |
| Windows (portable) | `JoinPDF_x.y.z_x64_portable.zip` | Unzip and run `joinpdf.exe` |

### First launch (unsigned app)

JoinPDF is not code-signed, so the OS warns you the first time.

**macOS:** open JoinPDF once, dismiss the warning, then go to **System Settings → Privacy & Security** and click **Open Anyway**. Or in Terminal:

```sh
xattr -dr com.apple.quarantine /Applications/JoinPDF.app
```

**Windows:** on the SmartScreen dialog click **More info → Run anyway**.

## Limitations

- Password-protected PDFs are rejected (the file is marked in the list).
- Bookmarks/outlines from the source files are not carried over.

## Development

Requirements: Node.js 20+, Rust (stable), and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

```sh
npm install
npm run tauri dev     # run the app with hot reload
npm test              # unit tests for the merge logic
npm run tauri build   # build installers into src-tauri/target/release/bundle
```

Releases: push a tag like `v0.1.0`. GitHub Actions builds the macOS universal dmg, the Windows installer and the portable zip, and attaches them to a draft release.

### Layout

```
src/merge.ts       PDF merge (pdf-lib), pure and unit-tested
src/fileList.ts    ordered file list state
src/main.ts        UI wiring: drop, add, reorder, generate
src-tauri/         Tauri shell, bundle config, permissions
```

## License

MIT
