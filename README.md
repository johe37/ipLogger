# IP Logger

Two-piece service that captures a visitor’s IP and Cloudflare edge metadata, then stores it in your logs.

1. **`client.js`** — Cloudflare Worker. Runs at the edge, reads the connecting IP plus Cloudflare `request.cf` geo/network fields, returns that JSON to the caller, and fire-and-forgets a copy to the backend.
2. **`index.js`** — Express app on Render. Accepts authenticated `POST /api/log` requests and prints them to stdout (visible in Render logs). Persistence is a TODO.

```
Visitor ──GET──▶ Cloudflare Worker (client.js)
                      │
                      ├── returns JSON to the visitor
                      │
                      └── POST /api/log ──▶ Render (index.js) ──▶ console.log
```

The visitor still gets the IP JSON even if Render fails. After a deploy of the current Worker, `curl -i` also shows `X-Log-Status` / `X-Log-Error` so you can see whether the POST landed.

## Repo layout

| File | Role |
|---|---|
| `client.js` | Cloudflare Worker (ES module, `export default { fetch }`) |
| `index.js` | Express logger for Render |
| `package.json` | Node dependencies for the Render service |

`package.json` is for the Express app. The Worker has no npm dependencies. Deploy it by pasting `client.js` into the Cloudflare dashboard.

## What gets logged

The Worker builds this object and both returns it and posts it to Render:

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

- Node.js 18+ (Express 5 requires it)
- A [Render](https://render.com) web service for `index.js`
- A [Cloudflare Workers](https://developers.cloudflare.com/workers/) account for `client.js`
- Optional, for local Worker testing: [Wrangler](https://developers.cloudflare.com/workers/wrangler/) (`npm i -g wrangler`)

## Configure

### Render (`index.js`)

Set these environment variables on the service:

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORT` | no | `3000` | Render sets this automatically |
| `LOG_SECRET` | **yes in production** | `change-me-to-a-strong-secret` | Bearer token the Worker must send |

Start command:

```bash
npm start
```

which runs `node index.js`.

### Cloudflare Worker (`client.js`)

The Worker reads:

| Variable | Where | Purpose |
|---|---|---|
| `BACKEND_URL` | Worker dashboard variable (optional) | Render URL, including `/api/log`. Defaults to `https://iplogger-kx3i.onrender.com/api/log` in `client.js`. |
| `LOG_SECRET` | **Worker secret** (not source) | Must match Render `LOG_SECRET` |

There is no hardcoded fallback secret. If `LOG_SECRET` is missing, the Worker still returns IP JSON, but it will **not** POST to Render (`X-Log-Error: LOG_SECRET is not set on the Worker`).

The live site `https://ip.example.com` only updates after you **redeploy** this Worker. Editing `client.js` in git is not enough.

**Dashboard deploy**

1. Paste the new `client.js` into the Worker that serves `ip.example.com`.
2. Settings → Variables and Secrets → add secret `LOG_SECRET` with the same value as Render.
3. Optionally add a text var `BACKEND_URL` = `https://iplogger-kx3i.onrender.com/api/log`.
4. Save and deploy.

After deploy:

```bash
curl -i https://ip.example.com/?debug
```

You want `X-Log-Status: 200`. `401` means the Worker secret does not match Render. `0` plus `LOG_SECRET is not set on the Worker` means the secret was never added to the Worker.

## API

### `GET /` (Render)

Health check. Returns plain text `IP Logger is running`.

### `POST /api/log` (Render)

Accepts the Worker payload.

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

The request body is logged with `console.log("Received log:", data)` and is currently not written to a database.

### Worker `fetch` (any method)

Any request to the Worker returns the collected JSON with:

```
Content-Type: application/json
Access-Control-Allow-Origin: *
Cache-Control: no-store
X-Log-Status: 200
X-Log-Error:
```

`X-Log-Status` is the HTTP status from Render (`200` / `401`) or `0` if the Worker never sent the POST. Add `?debug` to include a `_log` object in the JSON body.

## Local testing

### 1. Render service only

From the repo root:

```bash
npm install
LOG_SECRET=dev-secret npm start
```

You should see `Server running on port 3000`.

Health check:

```bash
curl -i http://localhost:3000/
```

Expect `200` and `IP Logger is running`.

Accepted log (watch the terminal for `Received log:`):

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

Expect `200` and `{"status":"ok"}`.

Rejected log (wrong token):

```bash
curl -i http://localhost:3000/api/log \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wrong" \
  -d '{"ip":"1.2.3.4"}'
```

Expect `401` and `{"error":"Unauthorized"}`.

### 2. Worker + local backend

Optional. Use [Wrangler](https://developers.cloudflare.com/workers/wrangler/) if you want to run `client.js` on your machine:

```bash
# terminal 1
LOG_SECRET=dev-secret npm start

# terminal 2
npx wrangler dev client.js --port 8787 --var LOG_SECRET:dev-secret --var BACKEND_URL:http://localhost:3000/api/log
```

Then:

```bash
curl -i "http://localhost:8787/?debug"
```

Expect `X-Log-Status: 200` and `Received log:` in the Express terminal. Geo fields are `null` locally. Fake an IP with `-H "CF-Connecting-IP: 8.8.8.8"`.

Cloudflare cannot reach `localhost` from a deployed Worker.

### 3. Worker against production Render

Point Wrangler at the live Render URL and pass the real `LOG_SECRET`:

```bash
npx wrangler dev client.js --port 8787 --var LOG_SECRET:YOUR_REAL_SECRET --var BACKEND_URL:https://iplogger-kx3i.onrender.com/api/log
curl -i "http://localhost:8787/?debug"
```

`X-Log-Status: 200` should match a new `Received log:` line on Render. Geo fields stay empty until traffic hits Cloudflare’s edge.

### 4. End-to-end in production

1. Confirm Render `LOG_SECRET` works via curl (you already did this).
2. Put that same value on the Worker as secret `LOG_SECRET`.
3. Deploy the updated `client.js` to the Worker that serves `ip.example.com`.
4. `curl -i https://ip.example.com/?debug` — look for `X-Log-Status: 200`.
5. Confirm the same object in Render → Logs.

