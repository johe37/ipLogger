# IP Logger

Two-piece service that captures a visitor’s IP and Cloudflare edge metadata, then stores it on a machine you control.

1. **`worker/client.js`** — Cloudflare Worker. Runs at the edge, reads the connecting IP plus Cloudflare `request.cf` geo/network fields, returns that JSON to the caller, and fire-and-forgets a copy to your home backend.
2. **`src/`** — Express app you run at home (plain Node or Docker). Accepts authenticated `POST /api/log`, writes the visit to SQLite, and serves a password-protected dashboard.

```
Visitor ──GET──▶ Cloudflare Worker (worker/client.js)
                      │
                      ├── returns JSON to the visitor
                      │
                      └── POST /api/log ──▶ Cloudflare Tunnel ──▶ home box
                                                                  ├── SQLite
                                                                  └── GET /dashboard  (LAN / VPN)
```

The visitor still gets the IP JSON even if the home box is offline. After a Worker deploy, `curl -i` shows `X-Log-Status` / `X-Log-Error` so you can see whether the POST landed.

Do **not** port-forward this on OPNsense. Reach the ingest URL with a Cloudflare Tunnel. Open `/dashboard` on the LAN or over a VPN.

## Repo layout

| File | Role |
|---|---|
| `worker/client.js` | Cloudflare Worker (ES module, `export default { fetch }`) |
| `src/index.js` | Express entrypoint |
| `src/app.js` | Route wiring |
| `src/db.js` | SQLite schema and queries |
| `src/routes/` | Health, ingest, dashboard APIs |
| `src/public/dashboard.html` | Password-protected visit list |
| `Dockerfile` | Image for the home server |
| `docker-compose.yml` | Build, run, persist `./data` |
| `package.json` | Node dependencies for the home app |

`package.json` is for the Express app. The Worker has no npm dependencies. Deploy it by pasting `worker/client.js` into the Cloudflare dashboard.

## What gets logged

The Worker builds this object and both returns it and posts it to the backend:

```json
{
  "ip": "203.0.113.10",
  "country": "US",
  "city": "San Francisco",
  "region": "California",
  "regionCode": "CA",
  "postalCode": "94107",
  "continent": "NA",
  "latitude": "37.7697",
  "longitude": "-122.3933",
  "timezone": "America/Los_Angeles",
  "asn": 13335,
  "asOrganization": "CLOUDFLARENET",
  "colo": "SFO",
  "httpProtocol": "HTTP/2",
  "userAgent": "curl/8.7.1",
  "method": "GET",
  "url": "https://your-worker.workers.dev/",
  "timestamp": "2026-08-15T12:00:00.000Z"
}
```

IP resolution order:

1. `CF-Connecting-IP` (set by Cloudflare)
2. First address in `X-Forwarded-For`
3. `"unknown"`

`request.cf` fields are only populated on Cloudflare’s network. Local Worker runs will have those fields as `null`.

## Prerequisites

- Node.js 22.13+ if you run without Docker
- Docker + Compose if you run the container
- A [Cloudflare Workers](https://developers.cloudflare.com/workers/) account for `worker/client.js`
- A [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to the home server
- Optional, for local Worker testing: [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (`npm i -g wrangler`)

## Configure

### Home app (`src/`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | no | `3000` | Listen port |
| `LOG_SECRET` | **yes in production** | `change-me-to-a-strong-secret` | Bearer token the Worker must send |
| `DASHBOARD_USER` | no | `admin` | HTTP basic auth user for `/dashboard` |
| `DASHBOARD_PASSWORD` | **yes to view the dashboard** | empty | HTTP basic auth password. If unset, `/dashboard` returns 503 |
| `DATABASE_PATH` | no | `./data/visits.db` locally, `/data/visits.db` in Docker | SQLite file |

Copy `.env.example` to `.env` and fill in secrets.

### Cloudflare Worker (`worker/client.js`)

| Variable | Where | Purpose |
|---|---|---|
| `BACKEND_URL` | **Worker text var** | Home ingest URL, including `/api/log`. Example: `https://ingest.example.com/api/log` |
| `LOG_SECRET` | **Worker secret** | Must match the home app `LOG_SECRET` |

There is no hardcoded backend URL or secret. If either is missing, the Worker still returns IP JSON, but it will not POST (`X-Log-Error` explains which one).

The live site `https://ip.example.com` only updates after you **redeploy** this Worker. Editing `worker/client.js` in git is not enough.

## Run at home

### Docker (recommended)

On the home server:

```bash
git clone <this-repo> iplogger
cd iplogger
cp .env.example .env
# edit .env: LOG_SECRET and DASHBOARD_PASSWORD

mkdir -p data
docker compose up -d --build
```

To refresh after a git pull:

```bash
git pull
docker compose up -d --build
```

SQLite lives in `./data/visits.db` on the host, so rebuilds keep history.

If you prefer to build on a laptop and copy the image:

```bash
docker build -t iplogger:local .
docker save iplogger:local | ssh you@homeserver docker load
```

Then on the server, run the same `docker-compose.yml` (it already sets `image: iplogger:local`).

Dashboard, from a machine on the LAN:

```
http://<home-server-lan-ip>:3000/dashboard
```

Health check:

```bash
curl -i http://127.0.0.1:3000/
```

### Without Docker

```bash
npm install
LOG_SECRET=dev-secret DASHBOARD_PASSWORD=dev-pass npm start
```

## Cloudflare Tunnel

Do not open WAN 443 to this container. Install `cloudflared` on the same box (or on OPNsense) and point a hostname at `http://127.0.0.1:3000`.

```bash
cloudflared tunnel login
cloudflared tunnel create iplogger
cloudflared tunnel route dns iplogger ingest.example.com
```

Example `~/.cloudflared/config.yml`:

```yaml
tunnel: <tunnel-id>
credentials-file: /home/you/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: ingest.example.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Then:

```bash
cloudflared tunnel run iplogger
```

Set the Worker `BACKEND_URL` to `https://ingest.example.com/api/log`. Keep `/dashboard` on the LAN. If you later expose the dashboard through the same hostname, basic auth is already on; Cloudflare Access in front of it is better.

## Worker deploy

1. Paste the new `worker/client.js` into the Worker that serves `ip.example.com`.
2. Settings → Variables and Secrets → secret `LOG_SECRET` (same value as the home app).
3. Text var `BACKEND_URL` = `https://ingest.example.com/api/log`.
4. Save and deploy.

After deploy:

```bash
curl -i https://ip.example.com/?debug
```

You want `X-Log-Status: 200`. `401` means the Worker secret does not match the home app. `0` plus a `_log.error` means the Worker never sent the POST, or the tunnel/home box was unreachable.

## API

### `GET /`

Health check. Returns plain text `IP Logger is running`.

### `POST /api/log`

Accepts the Worker payload and inserts a row. A database error is logged but the Worker still gets `200`, so the public IP endpoint does not fail when the disk is unhappy.

**Headers**

```
Content-Type: application/json
Authorization: Bearer <LOG_SECRET>
```

**Success** — `200`

```json
{ "status": "ok" }
```

**Wrong or missing token** — `401`

```json
{ "error": "Unauthorized" }
```

### `GET /dashboard`

Browser UI. HTTP basic auth (`DASHBOARD_USER` / `DASHBOARD_PASSWORD`).

### `GET /api/stats` and `GET /api/visits`

JSON used by the dashboard. Same basic auth. `GET /api/visits?q=stockholm&limit=100`. `GET /api/visits/:id` returns the full stored payload.

### Worker `fetch` (any method)

Any request to the Worker returns the collected JSON with:

```
Content-Type: application/json
Access-Control-Allow-Origin: *
Cache-Control: no-store
X-Log-Status: 200
X-Log-Error:
```

`X-Log-Status` is the HTTP status from the home app (`200` / `401`) or `0` if the Worker never sent the POST. Add `?debug` to include a `_log` object in the JSON body.

## Local testing

### 1. Home app only

```bash
npm install
LOG_SECRET=dev-secret DASHBOARD_PASSWORD=dev-pass npm start
```

Health check:

```bash
curl -i http://localhost:3000/
```

Accepted log:

```bash
curl -i http://localhost:3000/api/log \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-secret" \
  -d '{
    "ip": "203.0.113.10",
    "country": "US",
    "city": "Testville",
    "userAgent": "curl",
    "method": "GET",
    "url": "http://localhost/",
    "timestamp": "2026-08-15T12:00:00.000Z"
  }'
```

Expect `200` and `{"status":"ok"}`. Then open `http://localhost:3000/dashboard` as `admin` / `dev-pass`.

Rejected log (wrong token):

```bash
curl -i http://localhost:3000/api/log \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wrong" \
  -d '{"ip":"1.2.3.4"}'
```

Expect `401`.

### 2. Worker + local backend

```bash
# terminal 1
LOG_SECRET=dev-secret DASHBOARD_PASSWORD=dev-pass npm start

# terminal 2
npx wrangler dev worker/client.js --port 8787 --var LOG_SECRET:dev-secret --var BACKEND_URL:http://localhost:3000/api/log
```

Then:

```bash
curl -i "http://localhost:8787/?debug"
```

Expect `X-Log-Status: 200` and a new row on `/dashboard`. Geo fields are `null` locally. Fake an IP with `-H "CF-Connecting-IP: 8.8.8.8"`.

Cloudflare cannot reach `localhost` from a deployed Worker. Use the tunnel hostname in production.

### 3. End-to-end in production

1. Confirm `docker compose` is up and `curl http://127.0.0.1:3000/` works on the home box.
2. Confirm the tunnel hostname reaches `/` from the internet.
3. Put the same `LOG_SECRET` on the Worker and set `BACKEND_URL` to `https://<tunnel-host>/api/log`.
4. Deploy `worker/client.js`.
5. `curl -i https://ip.example.com/?debug` — look for `X-Log-Status: 200`.
6. Open `http://<lan-ip>:3000/dashboard` and confirm the row.
