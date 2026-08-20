# IP Logger

Home-hosted service that captures a visitor’s IP and Cloudflare edge metadata, stores it in SQLite, and serves a password-protected dashboard.

Traffic comes in through a Cloudflare Tunnel. There is no Worker. The Express app both answers the public IP lookup and writes the row.

```
Visitor ──▶ Cloudflare (proxy + location headers) ──▶ Tunnel ──▶ Express
                                                              ├── GET /            IP JSON + insert
                                                              ├── GET /dashboard   basic auth UI + insert
                                                              └── GET /health      liveness (not stored)
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
| `scripts/seed.js` | Sample visits for local dashboard/map |
| `Dockerfile` | Image for the home server |
| `docker-compose.yml` | Build, run, persist `/data` |

## What gets logged

Each request is stored, including `/` and `/dashboard`. Not stored: `/health` (Docker probes), `/api/*` (the dashboard polls these every 10s), plus favicon/robots.

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

Geo fields prefer Cloudflare request headers when they are present. A proxied hostname always sends `CF-IPCountry` (so you at least get `SE`). City, region, coordinates, timezone, ASN, and org are **not** sent unless you turn on **Rules → Transform Rules → Managed Transforms → Add visitor location headers**, and Cloudflare never sends org by default.

When those headers are missing, the app fills the gaps with a lookup to [ipwho.is](https://ipwho.is/) (cached per IP for 24h). Set `GEO_LOOKUP=0` to disable that. Private/LAN addresses are not looked up.

Optional extra transform rules if you want ASN from Cloudflare instead of the lookup:

| Header | Value |
|---|---|
| `cf-asn` | `ip.src.asnum` |

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
| `GEO_LOOKUP` | no | `1` | When `1`, fill missing city/region/org via ipwho.is. Set `0` to use Cloudflare headers only |

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

Tracker-style paths such as `/whatever` and `/dashboard` are logged the same way. `/health` and the dashboard JSON APIs are not.

### `GET /health`

Liveness. Browsers get a joke page. `curl` still returns plain text (`Service is running. Nice IP you've got there.`). Docker uses this so health checks are not stored as visits.

### `GET /dashboard`

Browser UI. HTTP basic auth (`DASHBOARD_USER` / `DASHBOARD_PASSWORD`). The page view is stored as a visit. The JSON calls the page makes are not.

### `GET /api/stats`, `/api/visits`, and `/api/locations`

JSON used by the dashboard. Same basic auth.

- `GET /api/stats` — totals, unique IPs, countries, last seen
- `GET /api/visits?q=stockholm&limit=30&offset=0` — table rows (`limit` default 30, max 100). `GET /api/visits/:id` is the full stored payload
- `GET /api/locations` — map points and a country breakdown. Same `q` / `country` filters. Visits with coordinates are plotted exactly; visits that only have a country code use that country’s centroid

The dashboard map and country list follow the search (and a country click) so they stay in sync with the table. The four headline stats stay global.

## Development

There is no automated test suite (`npm test` is a stub). Run the Express app locally and hit it with curl or a browser.

### Start

```bash
npm install
DASHBOARD_PASSWORD=dev-pass npm start
```

It listens on `http://localhost:3000`. SQLite is `./data/visits.db` unless you set `DATABASE_PATH`. Dashboard user defaults to `admin`.

To fill the dashboard and map with sample visits (writes into the same SQLite file; run again to append):

```bash
npm run seed
```

Use the same `DATABASE_PATH` as the running app if you overrode it. The page polls every 10s, so you do not need to restart.

Docker is the same app on port 3000 if you prefer that over `npm start`:

```bash
cp .env.example .env   # set DASHBOARD_PASSWORD
docker compose up -d --build
curl -i http://127.0.0.1:3000/health
```

### Exercise the endpoints

IP lookup (geo fields are usually `null` without Cloudflare headers; with `GEO_LOOKUP=1` a public IP can still get city/org from ipwho.is):

```bash
curl -i "http://localhost:3000/?debug"
```

Fake an edge request so CF headers and logging look like production:

```bash
curl -i "http://localhost:3000/?debug" \
  -H "CF-Connecting-IP: 8.8.8.8" \
  -H "CF-IPCountry: US" \
  -H "CF-IPCity: Testville" \
  -H "CF-Ray: 0000000000000000-SFO"
```

You want `200`, `X-Log-Status: 200`, and a new row on the dashboard.

Health (must **not** create a visit):

```bash
curl -i http://localhost:3000/health
```

Dashboard in the browser as `admin` / `dev-pass`:

```
http://localhost:3000/dashboard
```

Dashboard JSON (same basic auth):

```bash
curl -u admin:dev-pass "http://localhost:3000/api/stats"
curl -u admin:dev-pass "http://localhost:3000/api/visits?limit=30"
curl -u admin:dev-pass "http://localhost:3000/api/locations"
```

### Local vs production

- Without Cloudflare, IP comes from the socket (often `::1` or `127.0.0.1`).
- Country/city/ASN only show up if you send the `CF-*` headers, or if geo lookup fills gaps for a public IP.
- The map needs either `CF-IPlatitude` / `CF-IPlongitude` (or a public-IP lookup) for an exact pin, or at least `CF-IPCountry` to place a country-level pin.
- `/`, `/dashboard`, and tracker-style paths are stored. `/health` and `/api/*` are not.

### Production smoke check

After the tunnel is up:

1. Confirm `docker compose` is up and `curl http://127.0.0.1:3000/health` works on the home box.
2. `curl -i https://ip.example.com/?debug` — look for your IP, geo fields, and `X-Log-Status: 200`.
3. Open `https://ip.example.com/dashboard` and confirm the row.
