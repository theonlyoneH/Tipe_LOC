// Approximate country centroids [lat, lng, zoom] for the deck map.
// Large countries use a lower zoom so the whole country stays in view.
export const COUNTRY_GEO: Record<string, [number, number, number]> = {
  USA: [39.8, -98.6, 3], 'United States': [39.8, -98.6, 3], Canada: [56.1, -106.3, 3], Mexico: [23.6, -102.5, 4],
  Brazil: [-14.2, -51.9, 3], Argentina: [-38.4, -63.6, 3], Chile: [-35.7, -71.5, 3], Colombia: [4.6, -74.1, 4], Peru: [-9.2, -75.0, 4],
  UK: [54.0, -2.5, 5], 'United Kingdom': [54.0, -2.5, 5], Ireland: [53.4, -8.2, 6], France: [46.6, 2.2, 5], Germany: [51.2, 10.4, 5],
  Netherlands: [52.1, 5.3, 6], Belgium: [50.5, 4.5, 6], Spain: [40.4, -3.7, 5], Portugal: [39.4, -8.2, 6], Italy: [42.8, 12.5, 5],
  Switzerland: [46.8, 8.2, 6], Austria: [47.5, 14.6, 6], Poland: [51.9, 19.1, 5], Sweden: [62.0, 15.0, 4], Norway: [61.0, 9.0, 4],
  Denmark: [56.0, 10.0, 6], Finland: [64.0, 26.0, 4], Greece: [39.1, 21.8, 5], Turkey: [39.0, 35.2, 5], Ukraine: [48.4, 31.2, 5],
  Russia: [61.5, 99.0, 2], Israel: [31.0, 34.9, 6], Egypt: [26.8, 30.8, 5], 'Saudi Arabia': [23.9, 45.1, 4], UAE: [23.4, 53.8, 6],
  Qatar: [25.3, 51.2, 7], Iran: [32.4, 53.7, 4], Pakistan: [30.4, 69.3, 4], India: [21.0, 78.9, 4], Bangladesh: [23.7, 90.4, 6],
  'Sri Lanka': [7.9, 80.8, 6], China: [35.9, 104.2, 3], Japan: [36.2, 138.3, 4], 'South Korea': [36.5, 127.9, 6],
  Taiwan: [23.7, 121.0, 6], Vietnam: [14.1, 108.3, 5], Thailand: [15.9, 100.9, 5], Malaysia: [4.2, 102.0, 5], Singapore: [1.35, 103.8, 8],
  Indonesia: [-2.5, 118.0, 4], Philippines: [12.9, 121.8, 5], Australia: [-25.3, 133.8, 3], 'New Zealand': [-41.0, 174.0, 5],
  'South Africa': [-30.6, 22.9, 4], Nigeria: [9.1, 8.7, 5], Kenya: [0.0, 37.9, 5], Morocco: [31.8, -7.1, 5], Ethiopia: [9.1, 40.5, 5],
};

export const geoOf = (country?: string | null) => (country ? COUNTRY_GEO[country] : undefined);

/** Points along a curved arc between two coordinates (for the trade-route line). */
export function arc(from: [number, number], to: [number, number], steps = 32): [number, number][] {
  const [lat1, lng1] = from;
  const [lat2, lng2] = to;
  const mid: [number, number] = [(lat1 + lat2) / 2, (lng1 + lng2) / 2];
  const dist = Math.hypot(lat2 - lat1, lng2 - lng1);
  // Bow the arc perpendicular to the straight line, proportional to its length.
  const ctrl: [number, number] = [mid[0] + dist * 0.2, mid[1] - (lat2 - lat1) * 0.1];
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    pts.push([a * lat1 + b * ctrl[0] + c * lat2, a * lng1 + b * ctrl[1] + c * lng2]);
  }
  return pts;
}
