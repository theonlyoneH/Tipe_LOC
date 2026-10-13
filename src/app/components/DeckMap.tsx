import { memo, useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Lead, RankingEngine } from '../lib/types';
import { arc, geoOf } from '../lib/geo';

// Free OpenStreetMap tiles (no API key; attribution required). Override with
// VITE_MAP_TILES / VITE_MAP_ATTRIBUTION to use another provider (e.g. MapTiler).
const TILES = import.meta.env.VITE_MAP_TILES || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

interface DeckMapProps {
  leads: Lead[];               // remaining deck, current first
  current?: Lead;
  homeCountry?: string;
  hotCountries?: RankingEngine['regime']['hot_countries'];
}

/** Fly to the current lead's country, keeping it clear of the card overlay. */
function FlyTo({ country }: { country?: string }) {
  const map = useMap();
  useEffect(() => {
    const g = geoOf(country);
    if (!g) return;
    const [lat, lng, zoom] = g;
    const size = map.getSize();
    // Desktop: card sits on the right, so push the target left. Mobile: card is below, push it up.
    const offset = size.x >= 1024 ? L.point(size.x * 0.22, 0) : L.point(0, size.y * 0.2);
    const target = map.unproject(map.project([lat, lng], zoom).add(offset), zoom);
    map.flyTo(target, zoom, { duration: 1.4, easeLinearity: 0.2 });
  }, [country, map]);
  return null;
}

const countIcon = (n: number, active: boolean) =>
  L.divIcon({
    className: '',
    html: `<div class="deck-pin${active ? ' deck-pin-active' : ''}">${n}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

export const DeckMap = memo(function DeckMap({ leads, current, homeCountry, hotCountries = [] }: DeckMapProps) {
  const byCountry = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of leads) if (geoOf(l.country)) m.set(l.country, (m.get(l.country) ?? 0) + 1);
    return [...m.entries()];
  }, [leads]);

  const home = geoOf(homeCountry);
  const target = geoOf(current?.country);
  const route = home && target && homeCountry !== current?.country ? arc([home[0], home[1]], [target[0], target[1]]) : null;

  return (
    <MapContainer
      center={[25, 10]}
      zoom={2}
      minZoom={2}
      zoomControl={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      dragging={false}
      keyboard={false}
      worldCopyJump
      className="absolute inset-0 z-0"
      style={{ background: '#e8eef5' }}
    >
      <TileLayer url={TILES} attribution={ATTRIBUTION} maxZoom={19} />
      <FlyTo country={current?.country} />

      {/* News hotspots: green = good news for that market, red = risk/tariffs. */}
      {hotCountries.map(({ country, polarity }) => {
        const g = geoOf(country);
        if (!g || Math.abs(polarity) < 0.1) return null;
        const color = polarity > 0 ? '#10b981' : '#ef4444';
        return (
          <CircleMarker key={`hot-${country}`} center={[g[0], g[1]]} radius={18 + Math.min(22, Math.abs(polarity) * 10)}
            pathOptions={{ color, weight: 1, fillColor: color, fillOpacity: 0.12 }}>
            <Tooltip direction="top">{country}: {polarity > 0 ? 'positive' : 'negative'} news</Tooltip>
          </CircleMarker>
        );
      })}

      {route && <Polyline positions={route} pathOptions={{ color: '#2563eb', weight: 2.5, dashArray: '6 8', opacity: 0.85 }} />}

      {home && (
        <CircleMarker center={[home[0], home[1]]} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#0f172a', fillOpacity: 1 }}>
          <Tooltip direction="top">You · {homeCountry}</Tooltip>
        </CircleMarker>
      )}

      {byCountry.map(([country, n]) => {
        const g = geoOf(country)!;
        return (
          <Marker key={country} position={[g[0], g[1]]} icon={countIcon(n, country === current?.country)} interactive={false} />
        );
      })}
    </MapContainer>
  );
});

export default DeckMap;
