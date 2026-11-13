# JoinPDF

Join multiple PDF files into one. JoinPDF comes in two forms that work the same way:

- **Web app:** a static website that runs entirely in the browser. You host it yourself, for example with the included Docker setup.
- **Desktop apps** for macOS and Windows: small, standalone, and they need no admin rights to install.

In both, you add PDFs by dropping them or with **＋ Add files**, drag them into the order you want, and combine them into a single PDF.

There's no Ghostscript and no server-side processing. Pages are copied as they are, without re-rendering, so quality doesn't change. Merging is done with [pdf-lib](https://pdf-lib.js.org/).

## Web app

The web app lives in `web/`.

1. Drop PDFs onto the page or click **＋ Add files**.
2. Drag rows to set the order.
3. Click **Combine & download**. The browser saves `merged-YYYYMMDD-HHMMSS.pdf`.

**Files are never uploaded.** Everything happens in the visitor's browser, and nothing is stored on the server or in the browser. The site's Content-Security-Policy contains `connect-src 'none'` and `form-action 'none'`, so the browser itself blocks the page from sending data anywhere.

The site is in English and Dutch: it picks the browser's language, and visitors can switch with EN/NL. The `/about` page explains exactly what the app does and contains the disclaimer.

The site asks search engines not to index it, through three mechanisms:
- a `robots.txt` that disallows all crawling
- a `noindex` meta tag in the pages
- an `X-Robots-Tag` header

### Running it with Docker

The image builds the site and serves it with unprivileged nginx. From the repository root:

```sh
docker compose -f web/docker-compose.yml up -d --build
```

To update later:

```sh
git pull
docker compose -f web/docker-compose.yml up -d --build
```

The container listens on port 8084 on all interfaces. Set `JOINPDF_PORT` to use another port, or `JOINPDF_BIND=127.0.0.1` to keep it off the LAN.

Put a reverse proxy in front for TLS, and have it pass the visitor's IP in `X-Forwarded-For` so rate limiting works per visitor. Private networks and Cloudflare's address ranges are trusted as proxy hops.

Examples, with `pdf.example.com` standing in for your domain:

- **Pangolin**, with Newt using host networking: add a resource for your domain with target `http://127.0.0.1:8084`.
- **Caddy:**
  ```
  pdf.example.com {
      reverse_proxy 127.0.0.1:8084
  }
  ```
- **nginx:**
  ```nginx
  location / {
      proxy_pass http://127.0.0.1:8084;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
  }
  ```

If the reverse proxy itself runs in Docker (Traefik, Nginx Proxy Manager), put both containers on a shared Docker network and target `joinpdf-web:8080` instead of the published port.

### Security measures

- **Strict Content-Security-Policy:** no outgoing connections, no form posts and no third-party scripts, plus the usual security headers (HSTS, `nosniff`, no framing, no referrer).
- **Rate limiting per IP:** 10 requests per second with a burst of 40, and at most 20 connections at a time. Requests over the limit get 429.
- **No uploads possible:** only GET and HEAD are allowed, and request bodies are refused.
- **Nothing extra exposed:** no source maps or dotfiles are served.
- **Hardened container:** read-only filesystem, non-root user, no Linux capabilities, `no-new-privileges`, a 64 MB memory limit and rotated logs.

## Desktop apps

1. Drop PDFs into the window or click **＋ Add files**.
2. Drag rows to set the order.
3. Click **Generate** and pick an output folder. You get `merged-YYYYMMDD-HHMMSS.pdf`.

### Download

Get the latest build from the [Releases](https://github.com/josfaber/JoinPDF/releases) page:

| Platform | File | Install |
|---|---|---|
| macOS (Intel + Apple Silicon) | `JoinPDF_x.y.z_universal.dmg` | Open the dmg and drag JoinPDF to Applications |
| Windows | `JoinPDF_x.y.z_x64-setup.exe` | Installs for the current user only; no admin needed |
| Windows (portable) | `JoinPDF_x.y.z_x64_portable.zip` | Unzip and run `joinpdf.exe` |

### First launch (unsigned app)

The apps are not code-signed, so the OS warns you the first time.

- **macOS:** open JoinPDF once and dismiss the warning. Then go to **System Settings → Privacy & Security** and click **Open Anyway**. Or run this in Terminal:
  ```sh
  xattr -dr com.apple.quarantine /Applications/JoinPDF.app
  ```
- **Windows:** in the SmartScreen dialog, click **More info → Run anyway**. Managed work computers may block unsigned apps entirely; use the web app there.

## Limitations

These apply to both the web app and the desktop apps:

- Password-protected PDFs can't be combined; they are marked in the list.
- Bookmarks (the document outline) and fillable form fields from the source files are not carried over.
- Very large files are limited by available memory.

## Development

Requirements:
- Node.js 20 or later.
- For the desktop apps: Rust (stable) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS.

```sh
npm install
npm test              # unit tests (merge logic, file list)

npm run web:dev       # web app: local dev server
npm run web:build     # web app: static build into web/dist

npm run tauri dev     # desktop app with hot reload
npm run tauri build   # desktop installers into src-tauri/target/release/bundle
```

**Releasing the desktop apps:** push a tag like `v0.1.3`. GitHub Actions then builds:
- the macOS universal dmg
- the Windows installer
- the Windows portable zip

It attaches them to a draft release.

### Layout

```
src/merge.ts          PDF merge (pdf-lib), shared by web and desktop
src/fileList.ts       ordered file list state, shared by web and desktop
src/main.ts           desktop UI wiring (Tauri)
src-tauri/            Tauri shell, bundle config, permissions
web/                  web app: pages, UI wiring, translations
web/deploy/           nginx config and security headers
web/Dockerfile        build + serve image
web/docker-compose.yml
tests/                unit tests
```

## License

MIT
