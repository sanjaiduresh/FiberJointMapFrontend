import { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import type { FiberJoint, Segment, UserRole } from '../types';
import type { JointType } from '../types';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit3, Trash2, Scissors, Navigation, Layers, X } from 'lucide-react';

export const BASE_LAT = 8.336639;
export const BASE_LNG = 77.869861;

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/bright';

// ---------- helpers ----------

function mkEl(svg: string, w: number, h: number, suppress: { current: boolean }): HTMLDivElement {
  const el = document.createElement('div');
  el.innerHTML = svg;
  el.style.width = `${w}px`;
  el.style.height = `${h}px`;
  el.style.cursor = 'pointer';
  el.addEventListener('click', () => {
    suppress.current = true;
    setTimeout(() => { suppress.current = false; }, 0);
  });
  return el;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function circlePolygon(lng: number, lat: number, meters: number, n = 64) {
  const coords: [number, number][] = [];
  const km = meters / 1000;
  const dx = km / (111.32 * Math.cos((lat * Math.PI) / 180));
  const dy = km / 110.574;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * 2 * Math.PI;
    coords.push([lng + dx * Math.cos(a), lat + dy * Math.sin(a)]);
  }
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  };
}

// ---------- SVG icons ----------

const JOINT_SVGS: Record<JointType, { svg: string; w: number; h: number; offset: number }> = {
  Base: {
    w: 32, h: 44, offset: 44,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 44" width="32" height="44">
      <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 28 16 28s16-16 16-28C32 7.2 24.8 0 16 0z" fill="#f97316"/>
      <polygon points="16,6 18.5,12.5 25,13 20,17.5 21.5,24 16,20.5 10.5,24 12,17.5 7,13 13.5,12.5" fill="white"/>
    </svg>`,
  },
  Main: {
    w: 26, h: 38, offset: 38,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 38" width="26" height="38">
      <path d="M13 0C5.8 0 0 5.8 0 13c0 9.75 13 25 13 25s13-15.25 13-25C26 5.8 20.2 0 13 0z" fill="#3b82f6"/>
      <circle cx="13" cy="13" r="5" fill="white"/>
    </svg>`,
  },
  Sub: {
    w: 22, h: 32, offset: 32,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 32" width="22" height="32">
      <path d="M11 0C4.9 0 0 4.9 0 11c0 8.25 11 21 11 21s11-12.75 11-21C22 4.9 17.1 0 11 0z" fill="#eab308"/>
      <circle cx="11" cy="11" r="4" fill="white"/>
    </svg>`,
  },
  Splice: {
    w: 20, h: 28, offset: 28,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 28" width="20" height="28">
      <path d="M10 0C4.5 0 0 4.5 0 10c0 7.5 10 18 10 18s10-10.5 10-18C20 4.5 15.5 0 10 0z" fill="#a855f7"/>
      <circle cx="10" cy="10" r="4" fill="white"/>
    </svg>`,
  },
};

function getJointSVG(type?: JointType) {
  return JOINT_SVGS[type ?? 'Main'];
}

// ---------- popup components ----------

function JointPopup({ j, onEdit, onDelete, onApprove, onReject, onPhotoClick, userRole }: { j: FiberJoint, onEdit: (id: string) => void, onDelete: (id: string) => void, onApprove?: (id: string) => void, onReject?: (id: string) => void, onPhotoClick?: (url: string) => void, userRole?: UserRole | null }) {
  const typeColors: Record<JointType, string> = {
    Base: 'bg-orange-100 text-orange-800 border-orange-200',
    Main: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    Sub: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Splice: 'bg-purple-100 text-purple-800 border-purple-200',
  };
  const typeColor = typeColors[j.jointType ?? 'Main'] ?? typeColors.Main;
  const isOwner = userRole === 'OWNER';
  const isPending = j.approvalStatus === 'PENDING';
  const photos = j.photos || [];

  return (
    <div className="p-3 min-w-[220px] flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-[15px] leading-tight pr-4 text-foreground">{j.label}</h3>
        {j.approvalStatus === 'PENDING' && (
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Pending Creation</Badge>
        )}
        {j.approvalStatus === 'PENDING_EDIT' && (
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Pending Edit</Badge>
        )}
        {j.approvalStatus === 'PENDING_DELETE' && (
          <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px]">Pending Delete</Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-1">
        <Badge variant="outline" className={typeColor}>{j.jointType ?? 'Main'}</Badge>
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{j.cableType}</Badge>
        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">{j.fiberCount} fibers</Badge>
      </div>
      {j.notes && <p className="text-xs text-muted-foreground line-clamp-2">{j.notes}</p>}
      {/* Photo Thumbnails */}
      {photos.length > 0 && (
        <div className="flex gap-1.5 mt-0.5">
          {photos.slice(0, 3).map((photo, i) => (
            <button key={photo.publicId} type="button" onClick={() => onPhotoClick?.(photo.url)} className="block focus:outline-none">
              <img
                src={photo.url}
                alt={`Photo ${i + 1}`}
                className="w-14 h-14 rounded-md object-cover border border-border hover:opacity-80 transition-opacity cursor-pointer"
              />
            </button>
          ))}
          {photos.length > 3 && (
            <div className="w-14 h-14 rounded-md bg-muted border border-border flex items-center justify-center text-xs font-semibold text-muted-foreground">
              +{photos.length - 3}
            </div>
          )}
        </div>
      )}
      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">Loc: {j.lat.toFixed(6)}, {j.lng.toFixed(6)}</p>
      <div className="text-[11px] text-muted-foreground flex flex-col gap-0.5 mt-0.5">
        <span>User: {j.createdBy?.userName || 'Unknown'}</span>
        <span>Added: {fmtDate(j.createdAt)}</span>
      </div>
      <div className="flex flex-col gap-1.5 mt-2">
        <div className="flex gap-2">
          <Button variant="default" size="sm" className="flex-1 h-7 text-xs bg-blue-600 hover:bg-blue-700 cursor-pointer" onClick={() => onEdit(j.id)}>
            <Edit3 className="size-3.5 mr-1" /> Edit
          </Button>
          {isOwner && (
            <Button variant="destructive" size="sm" className="flex-1 h-7 text-xs cursor-pointer" onClick={() => onDelete(j.id)}>
              <Trash2 className="size-3.5 mr-1" /> Delete
            </Button>
          )}
        </div>
        {['PENDING', 'PENDING_EDIT', 'PENDING_DELETE'].includes(j.approvalStatus) && isOwner && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] text-green-700 border-green-300 hover:bg-green-50 cursor-pointer" onClick={() => onApprove?.(j.id)}>
              Approve
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] text-red-700 border-red-300 hover:bg-red-50 cursor-pointer" onClick={() => onReject?.(j.id)}>
              Reject
            </Button>
          </div>
        )}
        <Button variant="outline" size="sm" className="w-full h-7 text-xs cursor-pointer" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${j.lat},${j.lng}`, '_blank')}>
          <Navigation className="size-3.5 mr-1" /> Get Direction
        </Button>
      </div>
    </div>
  );
}

function SegmentPopup({ seg, fromLabel, toLabel, onSplice, onDelete, onApprove, onReject, userRole }: { seg: Segment, fromLabel: string, toLabel: string, onSplice: (id: string) => void, onDelete: (id: string) => void, onApprove?: (id: string) => void, onReject?: (id: string) => void, userRole?: UserRole | null }) {
  const dist = seg.lengthMeters >= 1000
    ? `${(seg.lengthMeters / 1000).toFixed(2)} km`
    : `${seg.lengthMeters.toFixed(0)} m`;
  const isOwner = userRole === 'OWNER';
  const isPending = seg.approvalStatus === 'PENDING';

  return (
    <div className="p-3 min-w-[220px] flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold text-[15px] leading-tight pr-4 text-foreground">Cable Segment</h3>
        {seg.approvalStatus === 'PENDING' && (
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Pending Creation</Badge>
        )}
        {seg.approvalStatus === 'PENDING_EDIT' && (
          <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Pending Edit</Badge>
        )}
        {seg.approvalStatus === 'PENDING_DELETE' && (
          <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 text-[10px]">Pending Delete</Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-1">
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">{seg.cableType}</Badge>
        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">{seg.fiberCount} fibers</Badge>
      </div>
      <p className="text-sm text-foreground">Length: <strong className="font-semibold">{dist}</strong></p>
      <div className="text-[11px] text-muted-foreground flex flex-col gap-0.5">
        <p>From: <strong className="font-medium text-foreground">{fromLabel}</strong></p>
        <p>To: <strong className="font-medium text-foreground">{toLabel}</strong></p>
        <p className="mt-1">User: {seg.createdBy?.userName || 'Unknown'}</p>
      </div>
      <div className="flex flex-col gap-1.5 mt-2">
        <Button variant="secondary" size="sm" className="w-full h-7 text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200" onClick={() => onSplice(seg.id)}>
          <Scissors className="size-3.5 mr-1.5" /> Add Splice Here
        </Button>
        {isOwner && (
          <Button variant="destructive" size="sm" className="w-full h-7 text-xs" onClick={() => onDelete(seg.id)}>
            <Trash2 className="size-3.5 mr-1.5" /> Delete Segment
          </Button>
        )}
        {['PENDING', 'PENDING_EDIT', 'PENDING_DELETE'].includes(seg.approvalStatus) && isOwner && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] text-green-700 border-green-300 hover:bg-green-50" onClick={() => onApprove?.(seg.id)}>
              Approve
            </Button>
            <Button variant="outline" size="sm" className="flex-1 h-7 text-[10px] text-red-700 border-red-300 hover:bg-red-50" onClick={() => onReject?.(seg.id)}>
              Reject
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- types ----------

export type { MapLibreMap };

interface MapViewProps {
  joints: FiberJoint[];
  segments: Segment[];
  onMapClick: (lat: number, lng: number) => void;
  onEditJoint?: (id: string) => void;
  onDeleteJoint: (id: string) => void;
  onApproveJoint?: (id: string) => void;
  onRejectJoint?: (id: string) => void;
  onDeleteSegment?: (id: string) => void;
  onApproveSegment?: (id: string) => void;
  onRejectSegment?: (id: string) => void;
  onSegmentClick?: (segmentId: string, lat: number, lng: number) => void;
  highlightedSegmentIds: string[];
  mapRef: React.MutableRefObject<maplibregl.Map | null>;
  onMapReady?: (map: maplibregl.Map | null) => void;
  waypointMode?: boolean;
  pendingWaypoints?: Array<{ lat: number; lng: number }>;
  pendingFromJoint?: FiberJoint | null;
  pendingToJoint?: FiberJoint | null;
  // ── splice marker ──
  spliceMode?: boolean;
  spliceMarkerPos?: { lat: number; lng: number } | null;
  onSpliceMarkerMove?: (lat: number, lng: number) => void;
  // ── placement marker ──
  placementMode?: boolean;
  placementPos?: { lat: number; lng: number } | null;
  onPlacementMarkerMove?: (lat: number, lng: number) => void;
  // ── move marker ──
  moveMode?: boolean;
  movePos?: { lat: number; lng: number } | null;
  onMoveMarkerMove?: (lat: number, lng: number) => void;
  // ── live location (owned by App.tsx) ──
  liveLocation?: { lat: number; lng: number; accuracy?: number } | null;
  // ── RBAC ──
  userRole?: UserRole | null;
}

// ---------- component ----------

export default function MapView({
  joints, segments, onMapClick, onEditJoint, onDeleteJoint, onApproveJoint, onRejectJoint, onDeleteSegment, onApproveSegment, onRejectSegment, onSegmentClick,
  highlightedSegmentIds, mapRef, onMapReady,
  waypointMode, pendingWaypoints, pendingFromJoint, pendingToJoint,
  spliceMode, spliceMarkerPos, onSpliceMarkerMove,
  placementMode, placementPos, onPlacementMarkerMove,
  moveMode, movePos, onMoveMarkerMove,
  liveLocation,
  userRole,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [mapStyleType, setMapStyleType] = useState<'street' | 'hybrid' | 'satellite'>('street');
  const [showStyleMenu, setShowStyleMenu] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const jMarkers = useRef(new Map<string, maplibregl.Marker>());
  const jRoots = useRef(new Map<string, Root>());
  const wpMarkers = useRef<maplibregl.Marker[]>([]);
  const liveMarker = useRef<maplibregl.Marker | null>(null);
  const spliceMarkerRef = useRef<maplibregl.Marker | null>(null);
  const placementMarkerRef = useRef<maplibregl.Marker | null>(null);
  const segmentPopup = useRef<maplibregl.Popup | null>(null);
  const segmentPopupRoot = useRef<Root | null>(null);
  const suppressClick = useRef(false);

  const cbEdit = useRef(onEditJoint);
  const cbDelete = useRef(onDeleteJoint);
  const cbApprove = useRef(onApproveJoint);
  const cbReject = useRef(onRejectJoint);
  const cbDeleteSeg = useRef(onDeleteSegment);
  const cbApproveSeg = useRef(onApproveSegment);
  const cbRejectSeg = useRef(onRejectSegment);
  const cbSplice = useRef(onSegmentClick);
  const cbClick = useRef(onMapClick);
  const cbSpliceMove = useRef(onSpliceMarkerMove);
  const cbPlacementMove = useRef(onPlacementMarkerMove);
  const cbMoveMove = useRef(onMoveMarkerMove);
  const cbPhotoClick = useRef<(url: string) => void>(null);

  useEffect(() => {
    cbEdit.current = onEditJoint;
    cbDelete.current = onDeleteJoint;
    cbApprove.current = onApproveJoint;
    cbReject.current = onRejectJoint;
    cbDeleteSeg.current = onDeleteSegment;
    cbApproveSeg.current = onApproveSegment;
    cbRejectSeg.current = onRejectSegment;
    cbSplice.current = onSegmentClick;
    cbClick.current = onMapClick;
    cbSpliceMove.current = onSpliceMarkerMove;
    cbPlacementMove.current = onPlacementMarkerMove;
    cbMoveMove.current = onMoveMarkerMove;
    cbPhotoClick.current = (url: string) => setPreviewUrl(url);
  }, [onEditJoint, onDeleteJoint, onApproveJoint, onRejectJoint, onDeleteSegment, onApproveSegment, onRejectSegment, onSegmentClick, onMapClick, onSpliceMarkerMove, onPlacementMarkerMove, onMoveMarkerMove]);

  const jointsById = useMemo(() => {
    const m = new Map<string, FiberJoint>();
    joints.forEach(j => m.set(j.id, j));
    return m;
  }, [joints]);

  const segmentsById = useRef(new Map<string, Segment>());
  useEffect(() => {
    segmentsById.current.clear();
    segments.forEach(s => segmentsById.current.set(s.id, s));
  }, [segments]);

  // ── INIT MAP ──
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [BASE_LNG, BASE_LAT],
      zoom: 13,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

    map.on('load', () => {
      // ── Segment lines ──
      map.addSource('segments', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'segments-line',
        type: 'line',
        source: 'segments',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': ['get', 'weight'],
          'line-opacity': ['coalesce', ['get', 'opacity'], 0.85],
        },
      });
      // Wide invisible hit area for clicks
      map.addLayer({
        id: 'segments-click',
        type: 'line',
        source: 'segments',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': 'transparent', 'line-width': 16 },
      });

      // ── Distance labels ──
      map.addSource('segment-labels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'segment-labels-text',
        type: 'symbol',
        source: 'segment-labels',
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'symbol-placement': 'point',
          'text-allow-overlap': false,
          'text-ignore-placement': false,
        },
        paint: {
          'text-color': '#1e293b',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      });

      // ── Preview line (waypoint mode) ──
      map.addSource('preview', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'preview-line',
        type: 'line',
        source: 'preview',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#a855f7',
          'line-width': 3,
          'line-opacity': 0.7,
          'line-dasharray': [2, 2],
        },
      });

      // ── Live location accuracy circle ──
      map.addSource('live-acc', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.addLayer({
        id: 'live-fill',
        type: 'fill',
        source: 'live-acc',
        paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.1 },
      });
      map.addLayer({
        id: 'live-border',
        type: 'line',
        source: 'live-acc',
        paint: { 'line-color': '#3b82f6', 'line-width': 1 },
      });

      // ── Google Hybrid raster source ──
      map.addSource('google-hybrid', {
        type: 'raster',
        tiles: ['https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'],
        tileSize: 256,
      });
      map.addLayer({
        id: 'google-hybrid-layer',
        type: 'raster',
        source: 'google-hybrid',
        paint: { 'raster-opacity': 0 },
      }, 'segments-line');

      // ── Google Satellite raster source ──
      map.addSource('google-satellite', {
        type: 'raster',
        tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
        tileSize: 256,
      });
      map.addLayer({
        id: 'google-satellite-layer',
        type: 'raster',
        source: 'google-satellite',
        paint: { 'raster-opacity': 0 },
      }, 'segments-line');

      // ── Segment click handler ──
      map.on('click', 'segments-click', (e) => {
        e.originalEvent.stopPropagation();
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 0);
        if (!e.features?.[0]) return;

        const segId = e.features[0].properties?.segmentId as string;
        const clickLat = e.lngLat.lat;
        const clickLng = e.lngLat.lng;
        const seg = segmentsById.current.get(segId);
        if (!seg) return;

        segmentPopup.current?.remove();
        setSelectedSegmentId(segId);

        const fromLabel = e.features[0].properties?.fromLabel as string ?? 'Unknown';
        const toLabel = e.features[0].properties?.toLabel as string ?? 'Unknown';

        if (segmentPopupRoot.current) {
          segmentPopupRoot.current.unmount();
          segmentPopupRoot.current = null;
        }

        const container = document.createElement('div');
        const root = createRoot(container);
        segmentPopupRoot.current = root;

        root.render(
          <SegmentPopup
            seg={seg}
            fromLabel={fromLabel}
            toLabel={toLabel}
            userRole={userRole}
            onSplice={(id) => {
              segmentPopup.current?.remove();
              suppressClick.current = true;
              setTimeout(() => { suppressClick.current = false; }, 100);
              cbSplice.current?.(id, clickLat, clickLng);
            }}
            onDelete={(id) => {
              segmentPopup.current?.remove();
              cbDeleteSeg.current?.(id);
            }}
            onApprove={(id) => {
              segmentPopup.current?.remove();
              cbApproveSeg.current?.(id);
            }}
            onReject={(id) => {
              segmentPopup.current?.remove();
              cbRejectSeg.current?.(id);
            }}
          />
        );

        const popup = new maplibregl.Popup({
          maxWidth: '300px',
          className: 'ft-popup',
          offset: [0, -8],
        })
          .setLngLat([clickLng, clickLat])
          .setDOMContent(container)
          .addTo(map);

        popup.on('close', () => {
          setSelectedSegmentId(null);
          if (segmentPopupRoot.current) {
            setTimeout(() => {
              segmentPopupRoot.current?.unmount();
              segmentPopupRoot.current = null;
            }, 0);
          }
        });

        segmentPopup.current = popup;
      });

      map.on('mouseenter', 'segments-click', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'segments-click', () => {
        map.getCanvas().style.cursor = '';
      });

      setMapLoaded(true);
    });

    // ── General map click ──
    map.on('click', (e) => {
      if (suppressClick.current) return;
      const hits = map.queryRenderedFeatures(e.point, { layers: ['segments-click'] });
      if (hits.length > 0) return;
      cbClick.current(e.lngLat.lat, e.lngLat.lng);
    });

    mapObjRef.current = map;
    mapRef.current = map;
    onMapReady?.(map);
    return () => {
      map.remove();
      mapObjRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── EVENT DELEGATION (Removed, replaced by React onClick handlers) ──

  // ── SYNC JOINT MARKERS ──
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !mapLoaded) return;
    const curr = jMarkers.current;
    const ids = new Set(joints.map(j => j.id));

    for (const [id, m] of curr) {
      if (!ids.has(id)) {
        m.remove();
        curr.delete(id);
        jRoots.current.get(id)?.unmount();
        jRoots.current.delete(id);
      }
    }

    for (const j of joints) {
      const { svg, w, h, offset } = getJointSVG(j.jointType);
      const ex = curr.get(j.id);
      const isPending = j.approvalStatus === 'PENDING' || j.approvalStatus === 'PENDING_EDIT';
      const isPendingDelete = j.approvalStatus === 'PENDING_DELETE';
      
      const popupContent = (
        <JointPopup 
          j={j} 
          onEdit={(id) => cbEdit.current?.(id)} 
          onDelete={(id) => cbDelete.current(id)}
          onApprove={(id) => cbApprove.current?.(id)}
          onReject={(id) => cbReject.current?.(id)}
          onPhotoClick={(url) => cbPhotoClick.current?.(url)}
          userRole={userRole}
        />
      );

      if (ex) {
        ex.setLngLat([j.lng, j.lat]);
        jRoots.current.get(j.id)?.render(popupContent);
        const newEl = mkEl(svg, w, h, suppressClick);
        ex.getElement().replaceChildren(...Array.from(newEl.childNodes));
        ex.getElement().style.width = `${w}px`;
        ex.getElement().style.height = `${h}px`;
        ex.getElement().style.opacity = isPending ? '0.55' : isPendingDelete ? '0.4' : '1';
        ex.getElement().style.filter = isPending ? 'saturate(0.5)' : isPendingDelete ? 'grayscale(1) sepia(1) hue-rotate(-50deg) saturate(5)' : '';
      } else {
        const el = mkEl(svg, w, h, suppressClick);
        if (isPending) {
          el.style.opacity = '0.55';
          el.style.filter = 'saturate(0.5)';
        } else if (isPendingDelete) {
          el.style.opacity = '0.4';
          el.style.filter = 'grayscale(1) sepia(1) hue-rotate(-50deg) saturate(5)';
        }
        const container = document.createElement('div');
        const root = createRoot(container);
        root.render(popupContent);
        jRoots.current.set(j.id, root);

        const popup = new maplibregl.Popup({
          offset: [0, -offset],
          maxWidth: '300px',
          className: 'ft-popup',
        }).setDOMContent(container);
        
        curr.set(j.id,
          new maplibregl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat([j.lng, j.lat])
            .setPopup(popup)
            .addTo(map),
        );
      }
    }
  }, [joints, mapLoaded]);

  // ── SYNC SEGMENT LINES + LABELS ──
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource('segments') as maplibregl.GeoJSONSource;
    const labelSrc = map.getSource('segment-labels') as maplibregl.GeoJSONSource;
    if (!src) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const features: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const labelFeatures: any[] = [];

    for (const seg of segments) {
      const from = jointsById.get(seg.fromJointId);
      const to = jointsById.get(seg.toJointId);
      if (!from || !to) continue;

      const isPending = seg.approvalStatus === 'PENDING' || seg.approvalStatus === 'PENDING_EDIT';
      const isPendingDelete = seg.approvalStatus === 'PENDING_DELETE';
      const isHl = highlightedSegmentIds.includes(seg.id) || selectedSegmentId === seg.id;
      let color = isPending ? '#f59e0b' : isPendingDelete ? '#ef4444' : '#3b82f6';
      let weight = (isPending || isPendingDelete) ? 2.5 : 3;
      let opacity = (isPending || isPendingDelete) ? 0.5 : 0.85;
      if (isHl) { color = '#f59e0b'; weight = 5; opacity = 0.85; }

      const coords: [number, number][] = [
        [from.lng, from.lat],
        ...(seg.waypoints || []).map(w => [w.lng, w.lat] as [number, number]),
        [to.lng, to.lat],
      ];

      features.push({
        type: 'Feature',
        properties: { color, weight, opacity, segmentId: seg.id, fromLabel: from.label, toLabel: to.label },
        geometry: { type: 'LineString', coordinates: coords },
      });

      const midIdx = Math.floor(coords.length / 2);
      const midCoord = coords.length % 2 === 0
        ? [
          (coords[midIdx - 1][0] + coords[midIdx][0]) / 2,
          (coords[midIdx - 1][1] + coords[midIdx][1]) / 2,
        ]
        : coords[midIdx];

      const label = seg.lengthMeters >= 1000
        ? `${(seg.lengthMeters / 1000).toFixed(2)}km`
        : `${seg.lengthMeters.toFixed(0)}m`;

      labelFeatures.push({
        type: 'Feature',
        properties: { label },
        geometry: { type: 'Point', coordinates: midCoord },
      });
    }

    src.setData({ type: 'FeatureCollection', features });
    labelSrc?.setData({ type: 'FeatureCollection', features: labelFeatures });
  }, [segments, jointsById, highlightedSegmentIds, selectedSegmentId, mapLoaded]);

  // ── SYNC PREVIEW LINE ──
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !mapLoaded) return;
    const src = map.getSource('preview') as maplibregl.GeoJSONSource;
    if (!src) return;
    if (!waypointMode || !pendingFromJoint) {
      src.setData({ type: 'FeatureCollection', features: [] });
      return;
    }
    const coords: [number, number][] = [
      [pendingFromJoint.lng, pendingFromJoint.lat],
      ...(pendingWaypoints || []).map(w => [w.lng, w.lat] as [number, number]),
    ];
    if (pendingToJoint) coords.push([pendingToJoint.lng, pendingToJoint.lat]);
    src.setData(coords.length >= 2
      ? {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: coords },
        }],
      }
      : { type: 'FeatureCollection', features: [] });
  }, [waypointMode, pendingFromJoint, pendingToJoint, pendingWaypoints, mapLoaded]);

  // ── SYNC WAYPOINT MARKERS ──
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !mapLoaded) return;
    wpMarkers.current.forEach(m => m.remove());
    wpMarkers.current = [];
    if (!waypointMode || !pendingWaypoints) return;
    pendingWaypoints.forEach((wp, i) => {
      const el = document.createElement('div');
      Object.assign(el.style, {
        width: '14px', height: '14px', borderRadius: '50%',
        background: '#c084fc', border: '2px solid #a855f7',
        cursor: 'pointer', boxShadow: '0 0 6px rgba(168,85,247,0.5)',
      });
      el.addEventListener('click', () => {
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 0);
      });
      const popup = new maplibregl.Popup({ offset: [0, -10], className: 'ft-popup' }).setHTML(
        `<div class="map-popup" style="text-align:center">
          <p class="popup-title">Turn ${i + 1}</p>
          <p class="popup-coord">${wp.lat.toFixed(6)}, ${wp.lng.toFixed(6)}</p>
        </div>`,
      );
      wpMarkers.current.push(
        new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([wp.lng, wp.lat])
          .setPopup(popup)
          .addTo(map),
      );
    });
  }, [waypointMode, pendingWaypoints, mapLoaded]);

  // ── SYNC SPLICE MARKER ──
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !mapLoaded) return;

    if (!spliceMode || !spliceMarkerPos) {
      spliceMarkerRef.current?.remove();
      spliceMarkerRef.current = null;
      return;
    }

    if (!spliceMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 38" width="28" height="38">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.3 21.7 0 14 0z" fill="#7c3aed"/>
        <path d="M9 9 L19 19 M19 9 L9 19 M14 11 L14 17" stroke="white" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
      Object.assign(el.style, {
        cursor: 'grab',
        filter: 'drop-shadow(0 2px 6px rgba(124,58,237,0.6))',
        userSelect: 'none',
      });

      el.addEventListener('mousedown', () => {
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 300);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', draggable: true })
        .setLngLat([spliceMarkerPos.lng, spliceMarkerPos.lat])
        .addTo(map);

      marker.on('dragstart', () => { el.style.cursor = 'grabbing'; });
      marker.on('drag', () => {
        const pos = marker.getLngLat();
        cbSpliceMove.current?.(pos.lat, pos.lng);
      });
      marker.on('dragend', () => {
        el.style.cursor = 'grab';
        const pos = marker.getLngLat();
        cbSpliceMove.current?.(pos.lat, pos.lng);
      });

      spliceMarkerRef.current = marker;
    } else {
      spliceMarkerRef.current.setLngLat([spliceMarkerPos.lng, spliceMarkerPos.lat]);
    }
  }, [spliceMode, spliceMarkerPos, mapLoaded]);

  // ── SYNC PLACEMENT MARKER ──
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !mapLoaded) return;

    if (!placementMode || !placementPos) {
      placementMarkerRef.current?.remove();
      placementMarkerRef.current = null;
      return;
    }

    if (!placementMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 38" width="26" height="38">
        <path d="M13 0C5.8 0 0 5.8 0 13c0 9.75 13 25 13 25s13-15.25 13-25C26 5.8 20.2 0 13 0z" fill="#3b82f6"/>
        <circle cx="13" cy="13" r="5" fill="white"/>
      </svg>`;
      Object.assign(el.style, {
        cursor: 'grab',
        filter: 'drop-shadow(0 2px 6px rgba(59,130,246,0.6))',
        userSelect: 'none',
      });

      el.addEventListener('mousedown', () => {
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 300);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', draggable: true })
        .setLngLat([placementPos.lng, placementPos.lat])
        .addTo(map);

      marker.on('dragstart', () => { el.style.cursor = 'grabbing'; });
      marker.on('drag', () => {
        const pos = marker.getLngLat();
        cbPlacementMove.current?.(pos.lat, pos.lng);
      });
      marker.on('dragend', () => {
        el.style.cursor = 'grab';
        const pos = marker.getLngLat();
        cbPlacementMove.current?.(pos.lat, pos.lng);
      });

      placementMarkerRef.current = marker;
    } else {
      placementMarkerRef.current.setLngLat([placementPos.lng, placementPos.lat]);
    }
  }, [placementMode, placementPos, mapLoaded]);

  // ── SYNC MOVE MARKER ──
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !mapLoaded) return;

    // Use placementMarkerRef since we never have placementMode and moveMode active together
    if (!moveMode || !movePos) {
      if (!placementMode) { // don't remove if placement mode is using it
        placementMarkerRef.current?.remove();
        placementMarkerRef.current = null;
      }
      return;
    }

    if (!placementMarkerRef.current) {
      const el = document.createElement('div');
      el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 26 38" width="26" height="38">
        <path d="M13 0C5.8 0 0 5.8 0 13c0 9.75 13 25 13 25s13-15.25 13-25C26 5.8 20.2 0 13 0z" fill="#f59e0b"/>
        <circle cx="13" cy="13" r="5" fill="white"/>
      </svg>`;
      Object.assign(el.style, {
        cursor: 'grab',
        filter: 'drop-shadow(0 2px 6px rgba(245,158,11,0.6))',
        userSelect: 'none',
      });

      el.addEventListener('mousedown', () => {
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 300);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', draggable: true })
        .setLngLat([movePos.lng, movePos.lat])
        .addTo(map);

      marker.on('dragstart', () => { el.style.cursor = 'grabbing'; });
      marker.on('drag', () => {
        const pos = marker.getLngLat();
        cbMoveMove.current?.(pos.lat, pos.lng);
      });
      marker.on('dragend', () => {
        el.style.cursor = 'grab';
        const pos = marker.getLngLat();
        cbMoveMove.current?.(pos.lat, pos.lng);
      });

      placementMarkerRef.current = marker;
    } else {
      placementMarkerRef.current.setLngLat([movePos.lng, movePos.lat]);
    }
  }, [moveMode, movePos, placementMode, mapLoaded]);

  // ── SYNC LIVE LOCATION (from prop — App.tsx owns the watchPosition) ──
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !mapLoaded) return;
    const accSrc = map.getSource('live-acc') as maplibregl.GeoJSONSource;

    if (!liveLocation) {
      liveMarker.current?.remove();
      liveMarker.current = null;
      accSrc?.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    if (!liveMarker.current) {
      const el = document.createElement('div');
      el.className = 'live-location-marker';
      el.innerHTML = `
        <div style="position:relative;width:20px;height:20px">
          <div style="
            position:absolute;inset:0;border-radius:50%;
            background:rgba(59,130,246,0.3);
            animation:livePulse 2s ease-out infinite
          "></div>
          <div style="
            position:absolute;top:4px;left:4px;
            width:12px;height:12px;border-radius:50%;
            background:#3b82f6;border:2.5px solid white;
            box-shadow:0 0 8px rgba(59,130,246,0.6)
          "></div>
        </div>`;
      Object.assign(el.style, { width: '20px', height: '20px', cursor: 'pointer' });

      const popup = new maplibregl.Popup({
        offset: [0, -10],
        className: 'ft-popup',
        closeButton: false,
      });

      liveMarker.current = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([liveLocation.lng, liveLocation.lat])
        .setPopup(popup)
        .addTo(map);

      // Suppress map click when tapping the live dot
      el.addEventListener('click', () => {
        suppressClick.current = true;
        setTimeout(() => { suppressClick.current = false; }, 0);
      });
    }

    // Always update position + popup content
    liveMarker.current.setLngLat([liveLocation.lng, liveLocation.lat]);
    liveMarker.current.getPopup()?.setHTML(
      `<div class="map-popup">
        <div class="popup-row">
          <h3 class="popup-title">Your Location</h3>
        </div>
        <p class="popup-coord">Location: ${liveLocation.lat.toFixed(6)}, ${liveLocation.lng.toFixed(6)}</p>
        ${liveLocation.accuracy != null
        ? `<p class="popup-meta">Accuracy: ±${liveLocation.accuracy.toFixed(0)}m</p>`
        : ''}
      </div>`,
    );

    // Update accuracy ring
    if (liveLocation.accuracy != null) {
      accSrc?.setData({
        type: 'FeatureCollection',
        features: [circlePolygon(liveLocation.lng, liveLocation.lat, liveLocation.accuracy)],
      } as GeoJSON.FeatureCollection);
    }
  }, [liveLocation, mapLoaded]);

  // ── HANDLE STYLE TOGGLE ──
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !mapLoaded) return;

    try {
      if (mapStyleType === 'hybrid') {
        map.setPaintProperty('google-hybrid-layer', 'raster-opacity', 1);
        map.setPaintProperty('google-satellite-layer', 'raster-opacity', 0);
      } else if (mapStyleType === 'satellite') {
        map.setPaintProperty('google-hybrid-layer', 'raster-opacity', 0);
        map.setPaintProperty('google-satellite-layer', 'raster-opacity', 1);
      } else {
        map.setPaintProperty('google-hybrid-layer', 'raster-opacity', 0);
        map.setPaintProperty('google-satellite-layer', 'raster-opacity', 0);
      }
    } catch (err) {
      console.error('Failed to set map style:', err);
    }
  }, [mapStyleType, mapLoaded]);

  return (
    <div className="h-full w-full relative">
      <div ref={containerRef} className="h-full w-full" />
      
      {/* Floating Style Selector */}
      <div className="absolute bottom-3 left-3 z-10 flex flex-col items-start gap-1">
        {showStyleMenu && (
          <div className="bg-card border border-border rounded-xl shadow-lg p-1.5 flex flex-col gap-1 mb-1 transition-all">
            <button
              onClick={() => { setMapStyleType('street'); setShowStyleMenu(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-left ${mapStyleType === 'street' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              Street View
            </button>
            <button
              onClick={() => { setMapStyleType('hybrid'); setShowStyleMenu(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-left ${mapStyleType === 'hybrid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              Hybrid Satellite
            </button>
            <button
              onClick={() => { setMapStyleType('satellite'); setShowStyleMenu(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all text-left ${mapStyleType === 'satellite' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            >
              Pure Satellite
            </button>
          </div>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowStyleMenu(!showStyleMenu)}
          className="bg-card shadow-sm border border-border rounded-xl flex items-center justify-center"
          title="Change Map Style"
        >
          <Layers className="size-4" />
        </Button>
      </div>

      {/* Full-size photo preview overlay */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            className="absolute top-4 right-4 size-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/40 transition-colors cursor-pointer"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="size-5" />
          </button>
          <img
            src={previewUrl}
            alt="Full size preview"
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}