/**
 * Maps IANA timezone strings to approximate [longitude, latitude] coordinates.
 * Used to plot member scores on the world map.
 */
export const TIMEZONE_COORDS: Record<string, [number, number]> = {
  // UTC
  "UTC": [0, 51.5],

  // Americas
  "America/New_York": [-74.0, 40.7],
  "America/Chicago": [-87.6, 41.9],
  "America/Denver": [-104.9, 39.7],
  "America/Phoenix": [-112.1, 33.4],
  "America/Los_Angeles": [-118.2, 34.1],
  "America/Anchorage": [-149.9, 61.2],
  "Pacific/Honolulu": [-157.8, 21.3],
  "America/Toronto": [-79.4, 43.7],
  "America/Vancouver": [-123.1, 49.3],
  "America/Mexico_City": [-99.1, 19.4],
  "America/Sao_Paulo": [-46.6, -23.5],
  "America/Argentina/Buenos_Aires": [-58.4, -34.6],
  "America/Bogota": [-74.1, 4.7],
  "America/Lima": [-77.0, -12.0],
  "America/Santiago": [-70.7, -33.5],
  "America/Caracas": [-66.9, 10.5],

  // Europe
  "Europe/London": [-0.1, 51.5],
  "Europe/Dublin": [-6.3, 53.3],
  "Europe/Lisbon": [-9.1, 38.7],
  "Europe/Paris": [2.3, 48.9],
  "Europe/Berlin": [13.4, 52.5],
  "Europe/Rome": [12.5, 41.9],
  "Europe/Madrid": [-3.7, 40.4],
  "Europe/Amsterdam": [4.9, 52.4],
  "Europe/Brussels": [4.4, 50.8],
  "Europe/Zurich": [8.5, 47.4],
  "Europe/Stockholm": [18.1, 59.3],
  "Europe/Oslo": [10.7, 59.9],
  "Europe/Copenhagen": [12.6, 55.7],
  "Europe/Helsinki": [25.0, 60.2],
  "Europe/Athens": [23.7, 37.9],
  "Europe/Bucharest": [26.1, 44.4],
  "Europe/Warsaw": [21.0, 52.2],
  "Europe/Prague": [14.4, 50.1],
  "Europe/Vienna": [16.4, 48.2],
  "Europe/Budapest": [19.0, 47.5],
  "Europe/Moscow": [37.6, 55.8],
  "Europe/Istanbul": [29.0, 41.0],
  "Europe/Kiev": [30.5, 50.5],

  // Asia & Pacific
  "Asia/Dubai": [55.3, 25.2],
  "Asia/Riyadh": [46.7, 24.7],
  "Asia/Tehran": [51.4, 35.7],
  "Asia/Karachi": [67.0, 24.9],
  "Asia/Kolkata": [88.4, 22.6],
  "Asia/Colombo": [79.9, 6.9],
  "Asia/Dhaka": [90.4, 23.7],
  "Asia/Yangon": [96.2, 16.8],
  "Asia/Bangkok": [100.5, 13.8],
  "Asia/Jakarta": [106.8, -6.2],
  "Asia/Singapore": [103.8, 1.4],
  "Asia/Kuala_Lumpur": [101.7, 3.1],
  "Asia/Manila": [121.0, 14.6],
  "Asia/Shanghai": [121.5, 31.2],
  "Asia/Hong_Kong": [114.2, 22.3],
  "Asia/Taipei": [121.5, 25.0],
  "Asia/Tokyo": [139.7, 35.7],
  "Asia/Seoul": [126.9, 37.6],
  "Australia/Perth": [115.9, -31.9],
  "Australia/Darwin": [130.8, -12.5],
  "Australia/Adelaide": [138.6, -34.9],
  "Australia/Sydney": [151.2, -33.9],
  "Australia/Melbourne": [144.9, -37.8],
  "Australia/Brisbane": [153.0, -27.5],
  "Pacific/Auckland": [174.8, -36.9],
  "Pacific/Fiji": [178.4, -18.1],

  // Africa
  "Africa/Cairo": [31.2, 30.1],
  "Africa/Johannesburg": [28.0, -26.2],
  "Africa/Lagos": [3.4, 6.5],
  "Africa/Nairobi": [36.8, -1.3],
  "Africa/Casablanca": [-7.6, 33.6],
};

/**
 * Returns [longitude, latitude] for a given IANA timezone,
 * or null if unknown.
 */
export function getCoordsForTimezone(timezone: string): [number, number] | null {
  return TIMEZONE_COORDS[timezone] ?? null;
}
