# IP Logger

Home-hosted service that captures a visitor’s IP and Cloudflare edge metadata, stores it in SQLite, and serves a password-protected dashboard.

Traffic comes in through a Cloudflare Tunnel. There is no Worker. The Express app both answers the public IP lookup and writes the row.

```
Visitor ──▶ Cloudflare (proxy + location headers) ──▶ Tunnel ──▶ Express
                                                              ├── GET /            IP JSON + insert
                                                              ├── GET /health      liveness
                                                              └── GET /dashboard   basic auth UI
```

If the home box or tunnel is down, `ip.example.com` is down.

## Repo layout

| File | Role |
|---|---|
| `src/index.js` | Express entrypoint |
| `src/app.js` | Route wiring |
| `src/db.js` | SQLite schema and queries |
| `src/routes/` | IP lookup, health, dashboard APIs |
| `src/public/dashboard.html` | Password-protected visit list |
| `Dockerfile` | Image for the home server |
| `docker-compose.yml` | Build, run, persist `/data` |

## What gets logged

Each request that is not `/health`, `/dashboard`, or `/api/*` is stored as:

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
  "httpProtocol": "HTTP/1.1",
  "userAgent": "curl/8.7.1",
  "method": "GET",
  "url": "https://ip.example.com/",
  "timestamp": "2026-08-15T12:00:00.000Z"
}
```

IP resolution order:

1. `CF-Connecting-IP` (set by Cloudflare)
2. First address in `X-Forwarded-For`
3. The connecting socket address

Geo fields come from Cloudflare request headers. They are `null` on a raw LAN hit. Behind the tunnel, turn on **Rules → Transform Rules → Managed Transforms → Add visitor location headers** so city, region, coordinates, and timezone arrive as `cf-ip*` headers.

Optional extra transform rules if you still want ASN / org (not in the managed transform):

| Header | Value |
|---|---|
| `cf-asn` | `ip.src.asnum` |
| `cf-ipasorg` | `ip.src.as.org` (if available on your plan) |

`colo` is parsed from `CF-Ray` (the `SFO` in `…-SFO`). `httpProtocol` is whatever `cloudflared` speaks to Express, usually `HTTP/1.1`, not the visitor’s HTTP/2 or HTTP/3.

A database error is logged but the visitor still gets `200` and the IP JSON.

## Prerequisites

- Node.js 22.13+ if you run without Docker
- Docker + Compose if you run the container
- A [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to the home server

## Configure

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | no | `3000` | Listen port |
| `DASHBOARD_USER` | no | `admin` | HTTP basic auth user for `/dashboard` |
| `DASHBOARD_PASSWORD` | **yes to view the dashboard** | empty | HTTP basic auth password. If unset, `/dashboard` returns 503 |
| `DATABASE_PATH` | no | `./data/visits.db` locally, `/data/visits.db` in Docker | SQLite file |

Copy `.env.example` to `.env` and set `DASHBOARD_PASSWORD`.

## Run at home

### Docker (recommended)

On the home server:

```bash
git clone <this-repo> iplogger
cd iplogger
cp .env.example .env
# edit .env: DASHBOARD_PASSWORD

mkdir -p data
docker compose up -d --build
```

To refresh after a git pull:

```bash
git pull
docker compose up -d --build
```

SQLite lives in the Compose `data` volume, so rebuilds keep history.

Dashboard, from a machine on the LAN or via the tunnel:

```
http://<home-server-lan-ip>:3000/dashboard
https://ip.example.com/dashboard
```

Health check:

```bash
curl -i http://127.0.0.1:3000/health
```

### Without Docker

```bash
npm install
DASHBOARD_PASSWORD=dev-pass npm start
```

## Cloudflare Tunnel

Do not open WAN 443 to this container. Install `cloudflared` on the same box (or on OPNsense) and point the public hostname at `http://127.0.0.1:3000`.

```bash
cloudflared tunnel login
cloudflared tunnel create iplogger
cloudflared tunnel route dns iplogger ip.example.com
```

Example `~/.cloudflared/config.yml`:

```yaml
tunnel: <tunnel-id>
credentials-file: /home/you/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: ip.example.com
    service: http://127.0.0.1:3000
  - service: http_status:404
```

Then:

```bash
cloudflared tunnel run iplogger
```

In the Cloudflare dashboard for that hostname:

1. Make sure the DNS record is **proxied** (orange cloud).
2. Enable **Add visitor location headers**.
3. Optionally add the ASN header transform above.
4. Delete the old Worker that used to serve this hostname, and remove any Worker route on `ip.example.com`.
5. If `ingest.example.com` still exists, point it at the same tunnel or 301 it to `ip.example.com`.

Basic auth is already on `/dashboard`. [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/policies/access/) in front of it is better if the dashboard is on the public hostname.

## API

### `GET /` (any method, most other paths too)

Returns the collected JSON. Also inserts a visit row.

```
Content-Type: application/json
Access-Control-Allow-Origin: *
Cache-Control: no-store
X-Log-Status: 200
X-Log-Error:
```

`X-Log-Status` is `200` on a successful insert, `500` if SQLite failed, or `204` if the path is skipped (`/favicon.ico`, `/robots.txt`). Add `?debug` to include a `_log` object in the JSON body.

Tracker-style paths such as `/whatever` are logged the same way. `/health`, `/dashboard`, and `/api/*` are not.

### `GET /health`

Liveness. Browsers get a joke page. `curl` still returns plain text (`Service is running. Nice IP you've got there.`). Docker uses this so health checks are not stored as visits.

### `POST /api/log`

Removed. Returns `410 Gone`. Hits on `/` are logged directly.

### `GET /dashboard`

Browser UI. HTTP basic auth (`DASHBOARD_USER` / `DASHBOARD_PASSWORD`).

### `GET /api/stats` and `GET /api/visits`

JSON used by the dashboard. Same basic auth. `GET /api/visits?q=stockholm&limit=100`. `GET /api/visits/:id` returns the full stored payload.

## Local testing

```bash
npm install
DASHBOARD_PASSWORD=dev-pass npm start
```

IP lookup (geo fields are `null` without Cloudflare headers):

```bash
curl -i "http://localhost:3000/?debug"
```

Fake an edge request:

```bash
curl -i "http://localhost:3000/?debug" \
  -H "CF-Connecting-IP: 8.8.8.8" \
  -H "CF-IPCountry: US" \
  -H "CF-IPCity: Testville" \
  -H "CF-Ray: 0000000000000000-SFO"
```

Expect `200`, `X-Log-Status: 200`, and a new row on `/dashboard`.

Health (must not create a visit):

```bash
curl -i http://localhost:3000/health
```

Dashboard, as `admin` / `dev-pass`:

```
http://localhost:3000/dashboard
```

Old ingest URL (must be 410):

```bash
curl -i http://localhost:3000/api/log \
  -H "Content-Type: application/json" \
  -d '{"ip":"1.2.3.4"}'
```

End-to-end after the tunnel is up:

1. Confirm `docker compose` is up and `curl http://127.0.0.1:3000/health` works on the home box.
2. `curl -i https://ip.example.com/?debug` — look for your IP, geo fields, and `X-Log-Status: 200`.
3. Open `https://ip.example.com/dashboard` and confirm the row.
