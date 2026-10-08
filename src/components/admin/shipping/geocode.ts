// Address lookup via OpenStreetMap Nominatim (no API key), browser-only.
// Usage policy: https://operations.osmfoundation.org/policies/nominatim/
// — at most 1 request per second (requests are queued), results cached,
// and lookups are only triggered by an explicit action (address blur / button), never per keystroke.

export interface GeoResult {
  city: string;
  state: string;
  zip: string;
  countryCode: string;
}

const ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const MIN_INTERVAL_MS = 1100;

const cache = new Map<string, GeoResult | null>();
let queue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface NominatimItem {
  address?: Record<string, string>;
  display_name?: string;
}

// "Subang Jaya City Council" / "Majlis Bandaraya Shah Alam" → the city's own name.
const cleanCity = (s: string) => s
  .replace(/\s+(?:city|municipal|district)\s+council$/i, '')
  .replace(/^majlis\s+(?:bandaraya|perbandaran|daerah)\s+/i, '')
  .trim();

/** Free-text search (`q`), or a postal-code search (`postalcode`) when `postal` is set. */
async function request(q: string, countryCode?: string, postal = false): Promise<GeoResult | null> {
  const key = `${postal ? 'postal|' : ''}${countryCode ?? ''}|${q.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  const run = async () => {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    const params = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', limit: '1', 'accept-language': 'en' });
    params.set(postal ? 'postalcode' : 'q', q);
    if (countryCode) params.set('countrycodes', countryCode.toLowerCase());
    const res = await fetch(`${ENDPOINT}?${params}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const [item] = (await res.json()) as NominatimItem[];
    const a = item?.address;
    const state = a ? a.state || a.province || a.region || a.state_district || '' : '';
    let city = a ? a.city || a.town || a.village || a.municipality || a.city_district || a.county || '' : '';
    // Postal areas often carry the city only in the place name: "80400, Johor Bahru, Johor, Malaysia".
    if (a && !city && postal) {
      city = (item.display_name ?? '').split(',').map((p) => p.trim())
        .find((p) => p && p !== q && p !== state && p !== a.country) ?? '';
    }
    const result: GeoResult | null = a
      ? {
          city: cleanCity(city),
          state,
          zip: a.postcode || '',
          countryCode: (a.country_code || '').toUpperCase(),
        }
      : null;
    cache.set(key, result);
    return result;
  };

  const p = queue.then(run, run);
  queue = p.catch(() => undefined);
  return p;
}

// Singapore Land Authority OneMap search: public, no key, CORS-enabled, and far more
// accurate than OSM for Singapore block numbers / postal codes.
const ONEMAP_ENDPOINT = 'https://www.onemap.gov.sg/api/common/elastic/search';

interface OneMapItem {
  POSTAL?: string;
}

async function oneMap(q: string): Promise<GeoResult | null> {
  const key = `onemap|${q.toLowerCase()}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const params = new URLSearchParams({ searchVal: q, returnGeom: 'N', getAddrDetails: 'Y', pageNum: '1' });
  const res = await fetch(`${ONEMAP_ENDPOINT}?${params}`);
  if (!res.ok) throw new Error(`OneMap ${res.status}`);
  const { results } = (await res.json()) as { results?: OneMapItem[] };
  const postal = results?.find((r) => /^\d{6}$/.test(r.POSTAL ?? ''))?.POSTAL;
  const result = postal ? { city: 'Singapore', state: 'Singapore', zip: postal, countryCode: 'SG' } : null;
  cache.set(key, result);
  return result;
}

/**
 * Looks up an address that has already been stripped of unit details and postal code
 * (see searchableAddress): Malaysia with a postal code goes to OSM's postal-code search first,
 * Singapore to OneMap; then OSM with street + country, then OSM with the road name only.
 */
export async function geocodeAddress(
  query: { full: string; road: string },
  countryCode?: string,
  zip = '',
): Promise<GeoResult | null> {
  const full = query.full.trim();
  const road = query.road.trim();
  if (!full && !road) return null;

  // Malaysia: the postal code places the city far better than the road (road names repeat
  // across states: "Jalan Tun Razak" is in both Kuala Lumpur and Johor Bahru).
  if (countryCode === 'MY' && /^\d{5}$/.test(zip.trim())) {
    const my = await request(zip.trim(), countryCode, true);
    if (my?.city) return my;
  }
  if (countryCode === 'SG' && full) {
    try {
      const sg = await oneMap(full);
      if (sg) return sg;
    } catch {
      // OneMap unavailable: fall through to OSM.
    }
  }
  if (full) {
    const first = await request(full, countryCode);
    if (first) return first;
  }
  if (road && road.toLowerCase() !== full.toLowerCase()) return request(road, countryCode);
  return null;
}
