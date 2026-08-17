const net = require("node:net");
const config = require("../config");

const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX = 2000;

const fillKeys = [
  "country",
  "city",
  "region",
  "regionCode",
  "postalCode",
  "continent",
  "latitude",
  "longitude",
  "timezone",
  "asn",
  "asOrganization"
];

function isPublicIp(ip) {
  if (!ip || ip === "unknown") return false;

  const version = net.isIP(ip);
  if (version === 4) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    return true;
  }

  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return false;
    if (lower.startsWith("fe80:")) return false;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return false;
    if (lower.startsWith("::ffff:")) return isPublicIp(ip.slice(7));
    return true;
  }

  return false;
}

function needsEnrichment(data) {
  return !data.city || !data.region || data.asn == null || !data.asOrganization;
}

function mergeGeo(base, extra) {
  if (!extra) return base;
  const out = { ...base };
  for (const key of fillKeys) {
    if (out[key] == null && extra[key] != null && extra[key] !== "") {
      out[key] = extra[key];
    }
  }
  return out;
}

function remember(ip, data) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    cache.delete(first);
  }
  cache.set(ip, { data, expires: Date.now() + CACHE_TTL_MS });
}

async function lookup(ip) {
  const hit = cache.get(ip);
  if (hit && hit.expires > Date.now()) return hit.data;

  const url = `https://ipwho.is/${encodeURIComponent(ip)}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(1500),
    headers: { Accept: "application/json" }
  });
  if (!res.ok) {
    throw new Error(`ipwho.is returned ${res.status}`);
  }

  const body = await res.json();
  if (!body || body.success === false) {
    throw new Error(body?.message || "ipwho.is lookup failed");
  }

  const data = {
    country: body.country_code || null,
    city: body.city || null,
    region: body.region || null,
    regionCode: body.region_code || null,
    postalCode: body.postal || null,
    continent: body.continent_code || null,
    latitude: body.latitude == null ? null : String(body.latitude),
    longitude: body.longitude == null ? null : String(body.longitude),
    timezone: body.timezone?.id || null,
    asn: body.connection?.asn ?? null,
    asOrganization: body.connection?.org || body.connection?.isp || null
  };
  remember(ip, data);
  return data;
}

async function enrich(data) {
  if (!config.geoLookup) {
    return { data, geo: { source: "headers", error: "" } };
  }
  if (!needsEnrichment(data) || !isPublicIp(data.ip)) {
    return { data, geo: { source: "headers", error: "" } };
  }

  try {
    const extra = await lookup(data.ip);
    return {
      data: mergeGeo(data, extra),
      geo: { source: "headers+lookup", error: "" }
    };
  } catch (err) {
    return {
      data,
      geo: { source: "headers", error: String(err) }
    };
  }
}

module.exports = { enrich, isPublicIp, needsEnrichment, mergeGeo };
