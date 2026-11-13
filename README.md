# JoinPDF

Join multiple PDFs into one: as a website that works entirely in your browser, or as a tiny desktop app for macOS and Windows.

**Website:** [joinpdf.josfaber.nl](https://joinpdf.josfaber.nl). Files are never uploaded; see [Website](#website) below.

The desktop app:

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

## Website

`web/` is a static site with the same features: drop or add PDFs, drag to reorder, and **Combine & download**. Everything happens in the visitor's browser with pdf-lib. No file is ever uploaded, and nothing is stored. English and Dutch, with an explanation page and disclaimer at `/about`.

The "never uploaded" promise is enforced by the browser: the site's Content-Security-Policy contains `connect-src 'none'` and `form-action 'none'`, so the page cannot send data anywhere.

```sh
npm run web:dev       # local development server
npm run web:build     # static build into web/dist
```

### Deploying with Docker

The image builds the site and serves it with unprivileged nginx on port 8080. It includes:
- security headers, including the strict CSP
- per-IP rate limiting (10 requests/s, burst 40, returning 429)
- only GET and HEAD allowed, with no request bodies
- no source maps or dotfiles served

The container runs read-only, without capabilities and with a 64 MB memory limit.

On the server, from the repository root:

```sh
git pull
docker compose -f web/docker-compose.yml up -d --build
```

It listens on `127.0.0.1:8084`; set `JOINPDF_PORT` to change that. Point your reverse proxy (which handles TLS) at it and pass the client IP in `X-Forwarded-For`, so rate limiting is per visitor.

Pangolin (Newt running with host networking): add a resource for `joinpdf.josfaber.nl` with target `http://127.0.0.1:8084`.

Caddy:

```
joinpdf.josfaber.nl {
    reverse_proxy 127.0.0.1:8084
}
```

nginx:

```nginx
location / {
    proxy_pass http://127.0.0.1:8084;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

If the reverse proxy itself runs in Docker (Traefik, Nginx Proxy Manager), put both containers on a shared Docker network and target `joinpdf-web:8080` instead of the published port.

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
