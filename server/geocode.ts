/**
 * Geocoding via Nominatim (OpenStreetMap) — no API key required.
 * Results are cached in-memory for the lifetime of the server process
 * to avoid hammering the API on every globe request.
 *
 * Rate limit: Nominatim allows 1 req/sec. We serialize requests with a
 * simple queue so concurrent globe loads don't flood the endpoint.
 */

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "SweetMomentum/1.0 (track@sweetmo.io)";

// In-memory cache: "city,country" → [lon, lat] or null (not found)
const geocodeCache = new Map<string, [number, number] | null>();

// Simple rate-limit queue — Nominatim asks for max 1 req/sec
let lastRequestTime = 0;
async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    await new Promise(r => setTimeout(r, 1100 - elapsed));
  }
  lastRequestTime = Date.now();
  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en",
    },
  });
}

/**
 * Geocode a city + optional country string.
 * Returns [lon, lat] or null if not found.
 * Results are cached indefinitely for the server process lifetime.
 */
export async function geocodeCity(
  city: string | null | undefined,
  country: string | null | undefined
): Promise<[number, number] | null> {
  if (!city) return null;

  const cacheKey = `${(city || "").trim().toLowerCase()},${(country || "").trim().toLowerCase()}`;

  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  try {
    const params = new URLSearchParams({
      format: "json",
      limit: "1",
      q: country ? `${city.trim()}, ${country.trim()}` : city.trim(),
    });

    const res = await rateLimitedFetch(`${NOMINATIM_URL}?${params}`);
    if (!res.ok) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const data = await res.json() as Array<{ lon: string; lat: string }>;
    if (!data || data.length === 0) {
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const coords: [number, number] = [parseFloat(data[0].lon), parseFloat(data[0].lat)];
    geocodeCache.set(cacheKey, coords);
    return coords;
  } catch (err) {
    console.error("[geocode] Nominatim error:", err);
    geocodeCache.set(cacheKey, null);
    return null;
  }
}
