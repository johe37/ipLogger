#!/usr/bin/env node
const config = require("../src/config");
const db = require("../src/db");

const samples = [
  {
    ip: "8.8.8.8",
    country: "US",
    city: "Council Bluffs",
    region: "Iowa",
    regionCode: "IA",
    continent: "NA",
    latitude: "41.2619",
    longitude: "-95.8608",
    timezone: "America/Chicago",
    asn: 15169,
    asOrganization: "GOOGLE",
    colo: "SFO",
    path: "/",
    userAgent: "curl/8.7.1",
    hoursAgo: 0.2
  },
  {
    ip: "1.1.1.1",
    country: "AU",
    city: "Sydney",
    region: "New South Wales",
    regionCode: "NSW",
    continent: "OC",
    latitude: "-33.8688",
    longitude: "151.2093",
    timezone: "Australia/Sydney",
    asn: 13335,
    asOrganization: "CLOUDFLARENET",
    colo: "SYD",
    path: "/",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0.0.0",
    hoursAgo: 1
  },
  {
    ip: "9.9.9.9",
    country: "US",
    city: "Berkeley",
    region: "California",
    regionCode: "CA",
    continent: "NA",
    latitude: "37.8715",
    longitude: "-122.2730",
    timezone: "America/Los_Angeles",
    asn: 19281,
    asOrganization: "QUAD9-AS-1",
    colo: "SFO",
    path: "/newsletter",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) Safari/604.1",
    hoursAgo: 2
  },
  {
    ip: "185.228.168.9",
    country: "SE",
    city: "Stockholm",
    region: "Stockholm",
    regionCode: "AB",
    continent: "EU",
    latitude: "59.3293",
    longitude: "18.0686",
    timezone: "Europe/Stockholm",
    asn: 8473,
    asOrganization: "Bahnhof",
    colo: "ARN",
    path: "/",
    userAgent: "Mozilla/5.0 (X11; Linux x86_64) Firefox/129.0",
    hoursAgo: 3
  },
  {
    ip: "80.67.169.12",
    country: "FR",
    city: "Paris",
    region: "Île-de-France",
    regionCode: "IDF",
    continent: "EU",
    latitude: "48.8566",
    longitude: "2.3522",
    timezone: "Europe/Paris",
    asn: 20766,
    asOrganization: "Gitoyen",
    colo: "CDG",
    path: "/pixel.gif",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0",
    hoursAgo: 5
  },
  {
    ip: "5.1.66.255",
    country: "DE",
    city: "Frankfurt",
    region: "Hesse",
    regionCode: "HE",
    continent: "EU",
    latitude: "50.1109",
    longitude: "8.6821",
    timezone: "Europe/Berlin",
    asn: 50472,
    asOrganization: "Chaos Computer Club",
    colo: "FRA",
    path: "/",
    userAgent: "curl/8.7.1",
    hoursAgo: 6
  },
  {
    ip: "51.15.0.1",
    country: "GB",
    city: "London",
    region: "England",
    regionCode: "ENG",
    continent: "EU",
    latitude: "51.5074",
    longitude: "-0.1278",
    timezone: "Europe/London",
    asn: 12876,
    asOrganization: "SCALEWAY",
    colo: "LHR",
    path: "/dashboard",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
    hoursAgo: 8
  },
  {
    ip: "133.242.0.1",
    country: "JP",
    city: "Tokyo",
    region: "Tokyo",
    regionCode: "13",
    continent: "AS",
    latitude: "35.6762",
    longitude: "139.6503",
    timezone: "Asia/Tokyo",
    asn: 9370,
    asOrganization: "SAKURA-B",
    colo: "NRT",
    path: "/",
    userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/128.0.0.0",
    hoursAgo: 12
  },
  {
    ip: "103.86.96.100",
    country: "SG",
    city: "Singapore",
    region: "Singapore",
    regionCode: "SG",
    continent: "AS",
    latitude: "1.3521",
    longitude: "103.8198",
    timezone: "Asia/Singapore",
    asn: 13335,
    asOrganization: "CLOUDFLARENET",
    colo: "SIN",
    path: "/track/campaign",
    userAgent: "Twitterbot/1.0",
    hoursAgo: 16
  },
  {
    ip: "200.160.2.3",
    country: "BR",
    city: "São Paulo",
    region: "São Paulo",
    regionCode: "SP",
    continent: "SA",
    latitude: "-23.5505",
    longitude: "-46.6333",
    timezone: "America/Sao_Paulo",
    asn: 22548,
    asOrganization: "NIC.br",
    colo: "GRU",
    path: "/",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Firefox/129.0",
    hoursAgo: 20
  },
  {
    ip: "196.216.2.1",
    country: "ZA",
    city: "Johannesburg",
    region: "Gauteng",
    regionCode: "GP",
    continent: "AF",
    latitude: "-26.2041",
    longitude: "28.0473",
    timezone: "Africa/Johannesburg",
    asn: 2018,
    asOrganization: "TENET-1",
    colo: "JNB",
    path: "/",
    userAgent: "curl/8.4.0",
    hoursAgo: 28
  },
  {
    ip: "41.223.24.1",
    country: "NG",
    city: "Lagos",
    region: "Lagos",
    regionCode: "LA",
    continent: "AF",
    latitude: "6.5244",
    longitude: "3.3792",
    timezone: "Africa/Lagos",
    asn: 29465,
    asOrganization: "VCG-AS",
    colo: "LOS",
    path: "/invite",
    userAgent: "Mozilla/5.0 (Linux; Android 13) Chrome/127.0.0.0",
    hoursAgo: 30
  },
  {
    ip: "142.113.0.1",
    country: "CA",
    city: "Toronto",
    region: "Ontario",
    regionCode: "ON",
    continent: "NA",
    latitude: "43.6532",
    longitude: "-79.3832",
    timezone: "America/Toronto",
    asn: 577,
    asOrganization: "BACOM",
    colo: "YYZ",
    path: "/",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0.0.0",
    hoursAgo: 36
  },
  {
    ip: "201.144.0.1",
    country: "MX",
    city: "Mexico City",
    region: "Mexico City",
    regionCode: "CMX",
    continent: "NA",
    latitude: "19.4326",
    longitude: "-99.1332",
    timezone: "America/Mexico_City",
    asn: 8151,
    asOrganization: "Uninet",
    colo: "MEX",
    path: "/",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/604.1",
    hoursAgo: 40
  },
  {
    ip: "203.0.113.10",
    country: "JP",
    path: "/country-only",
    userAgent: "curl/8.7.1",
    hoursAgo: 10
  },
  {
    ip: "203.0.113.20",
    country: "DE",
    path: "/country-only",
    userAgent: "curl/8.7.1",
    hoursAgo: 18
  },
  {
    ip: "192.168.1.20",
    path: "/",
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/128.0.0.0",
    hoursAgo: 0.5
  }
];

function hoursAgo(hours) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

db.open();
for (const sample of samples) {
  const { path = "/", hoursAgo: ago = 0, userAgent, ...geo } = sample;
  db.insertVisit({
    ...geo,
    httpProtocol: "HTTP/1.1",
    userAgent: userAgent || "seed-script",
    method: "GET",
    url: `http://localhost:3000${path}`,
    timestamp: hoursAgo(ago)
  });
}
const stats = db.getStats();
db.close();

console.log(`Seeded ${samples.length} visits into ${config.databasePath}`);
console.log(
  `Database now has ${stats.total} hits from ${stats.uniqueIps} IPs in ${stats.countries} countries`
);
