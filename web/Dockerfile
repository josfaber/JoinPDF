# Build context: repository root (the site reuses ../src/merge.ts and fileList.ts).
FROM node:lts-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY web ./web
RUN npx vite build --config web/vite.config.ts

FROM nginxinc/nginx-unprivileged:stable-alpine
COPY web/deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY web/deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/web/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
