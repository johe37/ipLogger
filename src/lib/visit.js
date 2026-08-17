const { int, text, timestamp } = require("./util");

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

module.exports = { toVisitRow, parsePayload };
