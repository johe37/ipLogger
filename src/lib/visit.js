const { int, text, timestamp } = require("./util");

function header(req, name) {
  const value = req.get(name);
  if (value == null || value === "") return null;
  return value;
}

function firstHeader(req, names) {
  for (const name of names) {
    const value = header(req, name);
    if (value) return value;
  }
  return null;
}

function clientIp(req) {
  const cf = header(req, "cf-connecting-ip");
  if (cf) return cf.trim();

  const xff = header(req, "x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();

  let ip = req.ip || req.socket?.remoteAddress || "unknown";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return ip || "unknown";
}

function coloFromRay(req) {
  const ray = header(req, "cf-ray");
  if (!ray) return null;
  const dash = ray.lastIndexOf("-");
  if (dash === -1) return null;
  const colo = ray.slice(dash + 1).trim();
  return colo || null;
}

function requestUrl(req) {
  const proto = header(req, "x-forwarded-proto") || req.protocol || "http";
  const host =
    header(req, "x-forwarded-host") || header(req, "host") || "localhost";
  return `${proto}://${host}${req.originalUrl}`;
}

function fromRequest(req) {
  const httpVersion = req.httpVersion ? `HTTP/${req.httpVersion}` : null;

  return {
    ip: clientIp(req),
    country: firstHeader(req, ["cf-ipcountry", "cf-ip-country"]),
    city: header(req, "cf-ipcity"),
    region: header(req, "cf-region"),
    regionCode: firstHeader(req, ["cf-region-code", "cf-regioncode"]),
    postalCode: firstHeader(req, ["cf-postal-code", "cf-postalcode"]),
    continent: header(req, "cf-ipcontinent"),
    latitude: header(req, "cf-iplatitude"),
    longitude: header(req, "cf-iplongitude"),
    timezone: header(req, "cf-timezone"),
    asn: int(firstHeader(req, ["cf-asn", "cf-ipasn"])),
    asOrganization: firstHeader(req, [
      "cf-ipasorg",
      "cf-asorganization",
      "cf-as-organization"
    ]),
    colo: coloFromRay(req),
    httpProtocol: header(req, "cf-http-protocol") || httpVersion,
    userAgent: header(req, "user-agent"),
    method: req.method,
    url: requestUrl(req),
    timestamp: new Date().toISOString()
  };
}

function toVisitRow(data) {
  return {
    ip: text(data.ip),
    country: text(data.country),
    city: text(data.city),
    region: text(data.region),
    region_code: text(data.regionCode),
    postal_code: text(data.postalCode),
    continent: text(data.continent),
    latitude: text(data.latitude),
    longitude: text(data.longitude),
    timezone: text(data.timezone),
    asn: int(data.asn),
    as_organization: text(data.asOrganization),
    colo: text(data.colo),
    http_protocol: text(data.httpProtocol),
    user_agent: text(data.userAgent),
    method: text(data.method),
    url: text(data.url),
    payload: JSON.stringify(data),
    created_at: timestamp(data.timestamp)
  };
}

function parsePayload(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

module.exports = { fromRequest, toVisitRow, parsePayload };
