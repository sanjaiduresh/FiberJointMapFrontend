import { useEffect, useRef, useState, useMemo } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import type { FiberJoint, Segment } from '../types';
import type { JointType } from '../types';

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

// ---------- popup HTML ----------

function jointHTML(j: FiberJoint) {
  const typeColors: Record<JointType, string> = {
    Base: 'badge-orange', Main: 'badge-cyan', Sub: 'badge-yellow', Splice: 'badge-purple',
  };
  const typeColor = typeColors[j.jointType ?? 'Main'] ?? 'badge-cyan';
  return `<div class="map-popup">
    <h3 class="popup-title">${j.label}</h3>
    <div class="popup-badges">
      <span class="badge ${typeColor}">${j.jointType ?? 'Main'}</span>
      <span class="badge badge-cyan">${j.cableType}</span>
      <span class="badge badge-blue">${j.fiberCount} fibers</span>
    </div>
    ${j.notes ? `<p class="popup-notes">${j.notes}</p>` : ''}
    <p class="popup-coord">📍 ${j.lat.toFixed(6)}, ${j.lng.toFixed(6)}</p>
    <p class="popup-meta">👤 ${j.createdBy?.userName || 'Unknown'}</p>
    <p class="popup-meta">🕐 ${fmtDate(j.createdAt)}</p>
    <button data-delete-joint="${j.id}" class="popup-btn popup-btn-red">Delete Joint</button>
  </div>`;
}

function segmentPopupHTML(seg: Segment, fromLabel: string, toLabel: string) {
  const dist = seg.lengthMeters >= 1000
    ? `${(seg.lengthMeters / 1000).toFixed(2)} km`
    : `${seg.lengthMeters.toFixed(0)} m`;
  return `<div class="map-popup">
    <h3 class="popup-title">Cable Segment</h3>
    <div class="popup-badges">
      <span class="badge badge-cyan">${seg.cableType}</span>
      <span class="badge badge-blue">${seg.fiberCount} fibers</span>
    </div>
    <p class="popup-notes">📏 <strong>${dist}</strong></p>
    <p class="popup-coord">From: <strong>${fromLabel}</strong></p>
    <p class="popup-coord">To: <strong>${toLabel}</strong></p>
    <p class="popup-meta">👤 ${seg.createdBy?.userName || 'Unknown'}</p>
    <button data-splice-segment="${seg.id}" class="popup-btn popup-btn-purple">✂️ Add Splice Here</button>
    <button data-delete-segment="${seg.id}" class="popup-btn popup-btn-red" style="margin-top:4px">Delete Segment</button>
  </div>`;
}

// ---------- types ----------

export type { MapLibreMap };

interface MapViewProps {
  joints: FiberJoint[];
  segments: Segment[];
  onMapClick: (lat: number, lng: number) => void;
  onDeleteJoint: (id: string) => void;
  onDeleteSegment?: (id: string) => void;
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
  // ── live location (owned by App.tsx) ──
  liveLocation?: { lat: number; lng: number; accuracy?: number } | null;
}

// ---------- component ----------

export default function MapView({
  joints, segments, onMapClick, onDeleteJoint, onDeleteSegment, onSegmentClick,
  highlightedSegmentIds, mapRef, onMapReady,
  waypointMode, pendingWaypoints, pendingFromJoint, pendingToJoint,
  spliceMode, spliceMarkerPos, onSpliceMarkerMove,
  liveLocation,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const jMarkers = useRef(new Map<string, maplibregl.Marker>());
  const wpMarkers = useRef<maplibregl.Marker[]>([]);
  const liveMarker = useRef<maplibregl.Marker | null>(null);
  const spliceMarkerRef = useRef<maplibregl.Marker | null>(null);
  const segmentPopup = useRef<maplibregl.Popup | null>(null);
  const suppressClick = useRef(false);

  const cbDelete = useRef(onDeleteJoint); cbDelete.current = onDeleteJoint;
  const cbDeleteSeg = useRef(onDeleteSegment); cbDeleteSeg.current = onDeleteSegment;
  const cbSplice = useRef(onSegmentClick); cbSplice.current = onSegmentClick;
  const cbClick = useRef(onMapClick); cbClick.current = onMapClick;
  const cbSpliceMove = useRef(onSpliceMarkerMove); cbSpliceMove.current = onSpliceMarkerMove;

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
          'line-opacity': 0.85,
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

        const fromLabel = e.features[0].properties?.fromLabel as string ?? 'Unknown';
        const toLabel = e.features[0].properties?.toLabel as string ?? 'Unknown';

        const popup = new maplibregl.Popup({
          maxWidth: '300px',
          className: 'ft-popup',
          offset: [0, -8],
        })
          .setLngLat([clickLng, clickLat])
          .setHTML(segmentPopupHTML(seg, fromLabel, toLabel))
          .addTo(map);

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

  // ── EVENT DELEGATION for popup buttons ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const h = (e: MouseEvent) => {
      const t = e.target as HTMLElement;

      const dj = t.closest<HTMLElement>('[data-delete-joint]');
      if (dj) { cbDelete.current(dj.dataset.deleteJoint!); return; }

      const ds = t.closest<HTMLElement>('[data-delete-segment]');
      if (ds) {
        segmentPopup.current?.remove();
        cbDeleteSeg.current?.(ds.dataset.deleteSegment!);
        return;
      }

      const sp = t.closest<HTMLElement>('[data-splice-segment]');
      if (sp) {
        const segId = sp.dataset.spliceSegment!;
        const popup = segmentPopup.current;
        if (popup) {
          const lngLat = popup.getLngLat();
          segmentPopup.current?.remove();
          suppressClick.current = true;
          setTimeout(() => { suppressClick.current = false; }, 100);
          cbSplice.current?.(segId, lngLat.lat, lngLat.lng);
        }
        return;
      }
    };
    el.addEventListener('click', h);
    return () => el.removeEventListener('click', h);
  }, []);

  // ── SYNC JOINT MARKERS ──
  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !mapLoaded) return;
    const curr = jMarkers.current;
    const ids = new Set(joints.map(j => j.id));

    for (const [id, m] of curr) {
      if (!ids.has(id)) { m.remove(); curr.delete(id); }
    }

    for (const j of joints) {
      const { svg, w, h, offset } = getJointSVG(j.jointType);
      const ex = curr.get(j.id);
      if (ex) {
        ex.setLngLat([j.lng, j.lat]);
        ex.getPopup()?.setHTML(jointHTML(j));
        const newEl = mkEl(svg, w, h, suppressClick);
        ex.getElement().replaceChildren(...Array.from(newEl.childNodes));
        ex.getElement().style.width = `${w}px`;
        ex.getElement().style.height = `${h}px`;
      } else {
        const el = mkEl(svg, w, h, suppressClick);
        const popup = new maplibregl.Popup({
          offset: [0, -offset],
          maxWidth: '300px',
          className: 'ft-popup',
        }).setHTML(jointHTML(j));
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

      const isHl = highlightedSegmentIds.includes(seg.id);
      let color = '#3b82f6';
      let weight = 3;
      if (isHl) { color = '#f59e0b'; weight = 5; }

      const coords: [number, number][] = [
        [from.lng, from.lat],
        ...(seg.waypoints || []).map(w => [w.lng, w.lat] as [number, number]),
        [to.lng, to.lat],
      ];

      features.push({
        type: 'Feature',
        properties: { color, weight, segmentId: seg.id, fromLabel: from.label, toLabel: to.label },
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
  }, [segments, jointsById, highlightedSegmentIds, mapLoaded]);

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
      Object.assign(el.style, { width: '20px', height: '20px' });

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
          <span style="font-size:18px">📡</span>
          <h3 class="popup-title">Your Location</h3>
        </div>
        <p class="popup-coord">📍 ${liveLocation.lat.toFixed(6)}, ${liveLocation.lng.toFixed(6)}</p>
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

  return <div ref={containerRef} className="h-full w-full" />;
}