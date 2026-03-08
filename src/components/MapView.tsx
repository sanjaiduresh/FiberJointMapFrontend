import { useCallback, useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Map as LeafletMap } from 'leaflet';
import type { FiberJoint } from '../types';

// Fix default marker icons for Leaflet with bundlers
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Central Base coordinates: 8°20'11.9"N 77°52'11.5"E
const BASE_LAT = 8.336639;
const BASE_LNG = 77.869861;

// Custom cyan marker icon for joints
const cyanIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="#06b6d4"/>
      <circle cx="12" cy="12" r="5" fill="white"/>
    </svg>
  `),
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -36],
});

// Central Base icon — orange/red star marker
const baseIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44">
      <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 28 16 28s16-16 16-28C32 7.2 24.8 0 16 0z" fill="#f97316"/>
      <polygon points="16,6 18.5,12.5 25,13 20,17.5 21.5,24 16,20.5 10.5,24 12,17.5 7,13 13.5,12.5" fill="white"/>
    </svg>
  `),
  iconSize: [32, 44],
  iconAnchor: [16, 44],
  popupAnchor: [0, -44],
});

// Live location pulsing dot icon
const liveLocationIcon = new L.DivIcon({
  className: 'live-location-marker',
  html: `
    <div style="position:relative;width:20px;height:20px;">
      <div style="position:absolute;inset:0;border-radius:50%;background:rgba(59,130,246,0.3);animation:livePulse 2s ease-out infinite;"></div>
      <div style="position:absolute;top:4px;left:4px;width:12px;height:12px;border-radius:50%;background:#3b82f6;border:2.5px solid white;box-shadow:0 0 8px rgba(59,130,246,0.6);"></div>
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

interface MapClickHandlerProps {
  onClick: (lat: number, lng: number) => void;
}

function MapClickHandler({ onClick }: MapClickHandlerProps) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to track live location
function LiveLocationTracker({ onLocationUpdate }: { onLocationUpdate: (lat: number, lng: number, accuracy: number) => void }) {
  const map = useMap();

  useEffect(() => {
    if (!navigator.geolocation) return;

    let firstFix = true;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        onLocationUpdate(latitude, longitude, accuracy);

        // On first fix, don't fly — just note it. Map stays centered on base.
        if (firstFix) {
          firstFix = false;
        }
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [map, onLocationUpdate]);

  return null;
}

interface MapViewProps {
  joints: FiberJoint[];
  onMapClick: (lat: number, lng: number) => void;
  onDelete: (id: string) => void;
  mapRef: React.MutableRefObject<LeafletMap | null>;
  onMapReady?: (map: LeafletMap | null) => void;
}

export default function MapView({ joints, onMapClick, onDelete, mapRef, onMapReady }: MapViewProps) {
  const [liveLocation, setLiveLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);

  const setMapRef = useCallback(
    (map: LeafletMap | null) => {
      mapRef.current = map;
      onMapReady?.(map);
    },
    [mapRef, onMapReady],
  );

  const handleLocationUpdate = useCallback((lat: number, lng: number, accuracy: number) => {
    setLiveLocation({ lat, lng, accuracy });
  }, []);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <MapContainer
      center={[BASE_LAT, BASE_LNG]}
      zoom={13}
      className="h-full w-full"
      ref={setMapRef}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler onClick={onMapClick} />
      <LiveLocationTracker onLocationUpdate={handleLocationUpdate} />

      {/* Central Base Marker */}
      <Marker position={[BASE_LAT, BASE_LNG]} icon={baseIcon}>
        <Popup>
          <div className="min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🏢</span>
              <h3 className="font-bold text-base text-slate-800">Central Base</h3>
            </div>
            <p className="text-sm text-slate-600 mb-2">ISP Headquarters — Main Operations Center</p>
            <p className="text-xs text-slate-400 font-mono">
              📍 {BASE_LAT.toFixed(6)}, {BASE_LNG.toFixed(6)}
            </p>
          </div>
        </Popup>
      </Marker>

      {/* Live Location Marker */}
      {liveLocation && (
        <>
          <Circle
            center={[liveLocation.lat, liveLocation.lng]}
            radius={liveLocation.accuracy}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              weight: 1,
            }}
          />
          <Marker position={[liveLocation.lat, liveLocation.lng]} icon={liveLocationIcon}>
            <Popup>
              <div className="min-w-[180px]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📡</span>
                  <h3 className="font-bold text-base text-slate-800">Your Location</h3>
                </div>
                <p className="text-xs text-slate-400 font-mono mb-1">
                  📍 {liveLocation.lat.toFixed(6)}, {liveLocation.lng.toFixed(6)}
                </p>
                <p className="text-xs text-slate-400">
                  Accuracy: ±{liveLocation.accuracy.toFixed(0)}m
                </p>
              </div>
            </Popup>
          </Marker>
        </>
      )}

      {/* Joint Markers */}
      {joints.map((joint) => (
        <Marker key={joint.id} position={[joint.lat, joint.lng]} icon={cyanIcon}>
          <Popup>
            <div className="min-w-[200px]">
              <h3 className="font-bold text-base text-slate-800 mb-1">{joint.label}</h3>
              {joint.notes && (
                <p className="text-sm text-slate-600 mb-2">{joint.notes}</p>
              )}
              <p className="text-xs text-slate-400 mb-1 font-mono">
                📍 {joint.lat.toFixed(6)}, {joint.lng.toFixed(6)}
              </p>
              <p className="text-xs text-slate-400 mb-3">
                🕐 {formatDate(joint.createdAt)}
              </p>
              <button
                onClick={() => onDelete(joint.id)}
                className="w-full px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Delete Joint
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export type { LeafletMap };
export { BASE_LAT, BASE_LNG };
