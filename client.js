export default {
  async fetch(request, env, ctx) {
    const cf = request.cf || {};

    const ip = request.headers.get("CF-Connecting-IP")
            || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
            || "unknown";

    const data = {
      ip,
      country: cf.country || null,
      city: cf.city || null,
      region: cf.region || null,
      regionCode: cf.regionCode || null,
      postalCode: cf.postalCode || null,
      continent: cf.continent || null,
      latitude: cf.latitude || null,
      longitude: cf.longitude || null,
      timezone: cf.timezone || null,
      asn: cf.asn || null,
      asOrganization: cf.asOrganization || null,
      colo: cf.colo || null,
      httpProtocol: cf.httpProtocol || null,
      userAgent: request.headers.get("User-Agent") || null,
      method: request.method,
      url: request.url,
      timestamp: new Date().toISOString()
    };

    const backendUrl = env?.BACKEND_URL || "https://iplogger-kx3i.onrender.com/api/log";
    const secret = env?.LOG_SECRET;
    const debug = new URL(request.url).searchParams.has("debug");
    const log = await sendLog(backendUrl, secret, data, ctx);

    const body = debug ? { ...data, _log: log } : data;

    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
        "X-Log-Status": String(log.status ?? 0),
        "X-Log-Error": log.error || ""
      }
    });
  }
};

async function sendLog(backendUrl, secret, data, ctx) {
  if (!secret) {
    const error = "LOG_SECRET is not set on the Worker";
    console.error(error);
    return { ok: false, status: 0, error };
  }

  const promise = fetch(backendUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${secret}`
    },
    body: JSON.stringify(data)
  });

  // Keep the subrequest alive even if the client disconnects.
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(promise);
  }

  try {
    const res = await promise;
    if (!res.ok) {
      const error = `Render returned ${res.status}`;
      console.error(error);
      return { ok: false, status: res.status, error };
    }
    return { ok: true, status: res.status, error: "" };
  } catch (err) {
    const error = String(err);
    console.error("Failed to send log to Render:", error);
    return { ok: false, status: 0, error };
  }
}
