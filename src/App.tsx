import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useJoints } from './hooks/useJoints';
import { useSegments } from './hooks/useSegments';
import MapView from './components/MapView';
import type { MapLibreMap } from './components/MapView';
import { BASE_LAT, BASE_LNG } from './components/MapView';
import AddJointModal from './components/AddJointModal';
import AddConnectionModal from './components/AddConnectionModal';
import LoginPage from './components/LoginPage';
import Sidebar from './components/JointSidebar';
import SearchBar from './components/SearchBar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Segment, CreateJointPayload } from './types';
import {
  PanelLeftClose, PanelLeftOpen, Building, Locate,
  MapPin, Plus, Link, X, Undo2, Check, Loader2, LogOut,
  Map as MapIcon, Settings, Trash2, Scissors, Circle, CircleDot,
} from 'lucide-react';
import SpliceJointModal from './components/SpliceJointModal';
import EditJointModal from './components/EditJointModal';
import TeamManagement from './components/TeamManagement';
import AdminDashboard from './components/AdminDashboard';

// ─── helpers ─────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function bfsPath(fromId: string, toId: string, segments: Segment[]): string[] | null {
  const adj = new Map<string, Array<{ neighborId: string; segmentId: string }>>();
  segments.forEach((s) => {
    if (!adj.has(s.fromJointId)) adj.set(s.fromJointId, []);
    if (!adj.has(s.toJointId)) adj.set(s.toJointId, []);
    adj.get(s.fromJointId)!.push({ neighborId: s.toJointId, segmentId: s.id });
    adj.get(s.toJointId)!.push({ neighborId: s.fromJointId, segmentId: s.id });
  });
  if (!adj.has(fromId) || !adj.has(toId)) return null;
  const visited = new Set<string>();
  const queue: Array<{ jointId: string; path: string[] }> = [{ jointId: fromId, path: [] }];
  visited.add(fromId);
  while (queue.length > 0) {
    const { jointId, path } = queue.shift()!;
    if (jointId === toId) return path;
    for (const { neighborId, segmentId } of adj.get(jointId) || []) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ jointId: neighborId, path: [...path, segmentId] });
      }
    }
  }
  return null;
}

// ─── component ───────────────────────────────────────────────────────────────

export default function App() {
  const { user, token, loading: authLoading, logout, isAuthenticated, isAdmin, role } = useAuth();

  // ── map mode ──
  type MapMode = 'live' | 'draft';
  const [mapMode, setMapMode] = useState<MapMode>('live');
  const isDraftMap = mapMode === 'draft';

  // Live map: only APPROVED items
  const {
    joints: approvedJoints, loading: ajLoading, error: ajError,
    createJoint, deleteJoint, spliceJoint, updateJoint,
    approveJoint, rejectJoint,
    refetch: refetchApprovedJoints,
  } = useJoints(token, 'APPROVED');

  // Draft map: ALL items (no filter)
  const {
    joints: allJoints, loading: draftJointsLoading, error: draftJointsError,
    refetch: refetchDraftJoints,
  } = useJoints(token);

  const {
    segments: approvedSegments, loading: asLoading, error: asError,
    createSegment, deleteSegment, applySplice,
    approveSegment, rejectSegment,
    refetch: refetchApprovedSegments,
  } = useSegments(token, 'APPROVED');

  const {
    segments: allSegments, loading: draftSegLoading, error: draftSegError,
    refetch: refetchDraftSegments,
  } = useSegments(token);

  // Active data based on map mode
  const joints = isDraftMap ? allJoints : approvedJoints;
  const segments = isDraftMap ? allSegments : approvedSegments;
  const jointsLoading = isDraftMap ? draftJointsLoading : ajLoading;
  const segmentsLoading = isDraftMap ? draftSegLoading : asLoading;
  const jointsError = isDraftMap ? draftJointsError : ajError;
  const segmentsError = isDraftMap ? draftSegError : asError;

  const isMobile = useIsMobile();

  // ── live location (single source of truth) ──
  const [liveLocation, setLiveLocation] = useState<{
    lat: number; lng: number; accuracy: number;
  } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setLiveLocation({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracy: p.coords.accuracy,
      }),
      (err) => console.warn('Geolocation error:', err.message),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // ── modal / ui state ──
  const [addJointModalCoords, setAddJointModalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [teamManagementOpen, setTeamManagementOpen] = useState(false);
  const mapRef = useRef<MapLibreMap | null>(null);

  // ── placement mode state ──
  const [placementMode, setPlacementMode] = useState(false);
  const [placementPos, setPlacementPos] = useState<{ lat: number; lng: number } | null>(null);
  const [placementData, setPlacementData] = useState<Omit<CreateJointPayload, 'lat' | 'lng'> | null>(null);
  const [placementIsSaving, setPlacementIsSaving] = useState(false);

  // ── edit & move mode state ──
  const [editingJointId, setEditingJointId] = useState<string | null>(null);
  const editingJoint = joints.find(j => j.id === editingJointId) || null;

  const [moveModeJointId, setMoveModeJointId] = useState<string | null>(null);
  const [movePos, setMovePos] = useState<{ lat: number; lng: number } | null>(null);
  const [moveIsSaving, setMoveIsSaving] = useState(false);

  // ── splice state ──
  const [spliceMode, setSpliceMode] = useState(false);
  const [spliceSegmentId, setSpliceSegmentId] = useState<string | null>(null);
  const [spliceMarkerPos, setSpliceMarkerPos] = useState<{ lat: number; lng: number } | null>(null);
  const [spliceModalData, setSpliceModalData] = useState<{
    segmentId: string;
    lat: number;
    lng: number;
  } | null>(null);

  // ── waypoint mode state ──
  const [waypointMode, setWaypointMode] = useState(false);
  const [pendingWaypoints, setPendingWaypoints] = useState<Array<{ lat: number; lng: number }>>([]);
  const [pendingConnection, setPendingConnection] = useState<{
    fromJointId: string;
    toJointId: string;
    cableType: 'Single Mode' | 'Multi Mode';
    fiberCount: number;
    lengthMeters: string;
  } | null>(null);
  const [waypointsDone, setWaypointsDone] = useState(false);

  // ── trace / highlight state ──
  const [traceMode, setTraceMode] = useState(false);
  const [traceFrom, setTraceFrom] = useState<string | null>(null);
  const [highlightedSegmentIds, setHighlightedSegmentIds] = useState<string[]>([]);

  // ── toast ──
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── map ready ──
  const hasFlownToBase = useRef(false);
  const onMapReady = useCallback((map: MapLibreMap | null) => {
    mapRef.current = map;
    if (map && !hasFlownToBase.current) {
      hasFlownToBase.current = true;
      setTimeout(() => map.jumpTo({ center: [BASE_LNG, BASE_LAT], zoom: 15 }), 300);
    }
  }, []);

  // ── filtered joints ──
  const filteredJoints = useMemo(() => {
    if (!searchQuery.trim()) return joints;
    const q = searchQuery.toLowerCase();
    return joints.filter(
      (j) => j.label.toLowerCase().includes(q) || j.notes?.toLowerCase().includes(q),
    );
  }, [joints, searchQuery]);

  const pendingFromJoint = pendingConnection
    ? joints.find((j) => j.id === pendingConnection.fromJointId) ?? null
    : null;
  const pendingToJoint = pendingConnection
    ? joints.find((j) => j.id === pendingConnection.toJointId) ?? null
    : null;

  // ── handlers ─────────────────────────────────────────────────────────────

  const handleMapClick = (lat: number, lng: number) => {
    if (waypointMode) {
      setPendingWaypoints((prev) => [...prev, { lat, lng }]);
      return;
    }
    if (spliceMode || placementMode || moveModeJointId) return;
    setAddJointModalCoords({ lat, lng });
  };

  const handlePickWaypoints = (state: { fromJointId: string; toJointId: string; cableType: 'Single Mode' | 'Multi Mode'; fiberCount: number; lengthMeters: string }) => {
    setPendingConnection(state);
    setPendingWaypoints([]);
    setWaypointMode(true);
    setShowConnectionModal(false);
    showToast('Click on the map to place turns along the cable route');
  };

  const handleWaypointsDone = () => {
    setWaypointMode(false);
    setWaypointsDone(true);
    setShowConnectionModal(true);
  };

  const handleWaypointsCancel = () => {
    setWaypointMode(false);
    setPendingWaypoints([]);
    setPendingConnection(null);
    setShowConnectionModal(true);
  };

  const handleUndoWaypoint = () => {
    setPendingWaypoints((prev) => prev.slice(0, -1));
  };

  const handleFlyTo = (lat: number, lng: number) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 1500 });
    if (isMobile) setSidebarOpen(false);
  };

  const handleFlyToLive = () => {
    if (liveLocation) {
      mapRef.current?.flyTo({
        center: [liveLocation.lng, liveLocation.lat],
        zoom: 16,
        duration: 1500,
      });
    } else {
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          setLiveLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          mapRef.current?.flyTo({
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 16,
            duration: 1500,
          });
        },
        () => showToast('Could not get your location', 'error'),
        { enableHighAccuracy: true },
      );
    }
  };

  const handleDeleteJoint = async (id: string) => {
    if (!confirm('Delete this joint? Connected segments will also be deleted.')) return;
    try {
      await deleteJoint(id);
      showToast('Joint deleted');
    } catch {
      showToast('Failed to delete joint', 'error');
    }
  };

  const handleDeleteSegment = async (id: string) => {
    if (!confirm('Delete this segment?')) return;
    try {
      await deleteSegment(id);
      showToast('Segment deleted');
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete segment', 'error');
    }
  };

  // ── approval handlers ──
  const handleApproveJoint = async (id: string) => {
    try {
      await approveJoint(id);
      refetchDraftJoints(true);
      refetchApprovedJoints(true);
      showToast('Joint approved!');
    } catch {
      showToast('Failed to approve joint', 'error');
    }
  };

  const handleRejectJoint = async (id: string) => {
    if (!confirm('Reject this joint? It will be removed.')) return;
    try {
      await rejectJoint(id);
      refetchDraftJoints(true);
      showToast('Joint rejected');
    } catch {
      showToast('Failed to reject joint', 'error');
    }
  };

  const handleApproveSegment = async (id: string) => {
    try {
      await approveSegment(id);
      refetchDraftSegments(true);
      refetchApprovedSegments(true);
      showToast('Segment approved!');
    } catch {
      showToast('Failed to approve segment', 'error');
    }
  };

  const handleRejectSegment = async (id: string) => {
    if (!confirm('Reject this segment?')) return;
    try {
      await rejectSegment(id);
      refetchDraftSegments(true);
      showToast('Segment rejected');
    } catch {
      showToast('Failed to reject segment', 'error');
    }
  };

  const handleSegmentClick = (segmentId: string, lat: number, lng: number) => {
    setSpliceSegmentId(segmentId);
    setSpliceMarkerPos({ lat, lng });
    setSpliceMode(true);
    showToast('Drag the marker to the exact splice point, then confirm');
  };

  const handleSpliceMarkerMove = (lat: number, lng: number) => {
    setSpliceMarkerPos({ lat, lng });
  };

  const handleConfirmSplicePosition = () => {
    if (!spliceSegmentId || !spliceMarkerPos) return;
    setSpliceMode(false);
    setSpliceModalData({
      segmentId: spliceSegmentId,
      lat: spliceMarkerPos.lat,
      lng: spliceMarkerPos.lng,
    });
  };

  const handleCancelSpliceMode = () => {
    setSpliceMode(false);
    setSpliceSegmentId(null);
    setSpliceMarkerPos(null);
  };

  const resetSpliceState = () => {
    setSpliceModalData(null);
    setSpliceSegmentId(null);
    setSpliceMarkerPos(null);
  };

  const handleTraceRoute = (fromId: string, toId: string) => {
    if (!toId) {
      setTraceFrom(fromId);
      const joint = joints.find((j) => j.id === fromId);
      showToast(`Start: ${joint?.label ?? 'joint'} — now click the destination`);
      return;
    }
    const pathSegIds = bfsPath(fromId, toId, segments);
    if (!pathSegIds || pathSegIds.length === 0) {
      showToast('No route found between these joints', 'error');
    } else {
      setHighlightedSegmentIds(pathSegIds);
      showToast(`Route found! ${pathSegIds.length} segment${pathSegIds.length > 1 ? 's' : ''} highlighted`);
    }
    setTraceMode(false);
    setTraceFrom(null);
  };

  const handleToggleTrace = () => {
    setTraceMode((v) => !v);
    setTraceFrom(null);
    setHighlightedSegmentIds([]);
  };

  // ── auth loading ──────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-dvh w-screen bg-background flex items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;
  if (isAdmin) return <AdminDashboard />;

  const anyLoading = jointsLoading || segmentsLoading;
  const anyError = jointsError || segmentsError;

  const baseJoints = joints.filter((j) => j.jointType === 'Base');
  const totalKm = segments.reduce((acc, s) => acc + s.lengthMeters, 0) / 1000;

  // ── sidebar content ───────────────────────────────────────────────────────

  const sidebarContent = (
    <div className="w-80 h-full flex flex-col bg-card border-r border-border">
      {/* Header */}
      <div className="px-4 pt-5 pb-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary flex items-center justify-center">
              <MapIcon className="size-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground tracking-tight">FiberTrack</h1>
              <p className="text-[11px] text-muted-foreground">ISP Joint Mapper</p>
            </div>
          </div>
          {isMobile && (
            <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(false)}>
              <X className="size-4" />
            </Button>
          )}
        </div>

        {/* User info */}
        <div className="flex items-center justify-between bg-muted rounded-lg px-3 py-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="size-6 rounded-full bg-primary flex items-center justify-center text-[10px] font-bold text-primary-foreground">
              {user?.name?.charAt(0).toUpperCase() ?? '?'}
            </div>
            <span className="text-xs text-foreground font-medium">{user?.name ?? 'User'}</span>
          </div>
          <Button
            variant="ghost" size="xs" onClick={logout}
            className="text-muted-foreground hover:text-destructive h-6 px-2"
          >
            <LogOut className="size-3" />
            <span className="text-[10px]">Logout</span>
          </Button>
        </div>

        <SearchBar onSearch={setSearchQuery} />
      </div>

      {/* Loading / Error */}
      {anyLoading && (
        <div className="flex items-center justify-center py-3 border-b border-border">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground ml-2">Loading...</span>
        </div>
      )}
      {anyError && (
        <div className="px-3 py-2 border-b border-border">
          <p className="text-xs text-destructive">{anyError}</p>
        </div>
      )}

      {/* Sidebar joint list */}
      <div className="flex-1 overflow-hidden">
        <Sidebar
          joints={filteredJoints}
          segments={segments}
          onFlyTo={handleFlyTo}
          onEditJoint={setEditingJointId}
          onDeleteJoint={handleDeleteJoint}
          onTraceRoute={handleTraceRoute}
          traceMode={traceMode}
          onToggleTraceMode={handleToggleTrace}
          traceFrom={traceFrom}
          onOpenSettings={() => setSettingsOpen(true)}
          userRole={role}
          onApproveJoint={handleApproveJoint}
          onRejectJoint={handleRejectJoint}
          isDraftMap={isDraftMap}
          onOpenTeamManagement={() => setTeamManagementOpen(true)}
        />
      </div>
    </div>
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="h-dvh w-screen flex bg-background text-foreground overflow-hidden relative">

      {/* Toast */}
      {toast && (
        <div className={cn(
          'fixed top-4 left-1/2 -translate-x-1/2 z-[2000] px-4 py-2.5 rounded-lg shadow-md text-sm font-medium transition-all',
          toast.type === 'error'
            ? 'bg-destructive text-destructive-foreground'
            : 'bg-primary text-primary-foreground',
        )}>
          {toast.message}
        </div>
      )}

      {/* Mobile Sidebar */}
      {isMobile && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="w-80 p-0" showCloseButton={false}>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <div className={cn(
          'flex-shrink-0 transition-all duration-300 overflow-hidden',
          sidebarOpen ? 'w-80' : 'w-0',
        )}>
          {sidebarContent}
        </div>
      )}

      {/* Map Area */}
      <div className="flex-1 relative isolate">

        {/* Toggle Sidebar */}
        <Button
          variant="outline" size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-3 left-3 z-10 bg-card shadow-sm"
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          {sidebarOpen && !isMobile
            ? <PanelLeftClose className="size-4" />
            : <PanelLeftOpen className="size-4" />
          }
        </Button>

        {/* Map Controls */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
          <Button
            variant="outline" size="icon"
            onClick={() => mapRef.current?.flyTo({ center: [BASE_LNG, BASE_LAT], zoom: 15, duration: 1500 })}
            className="bg-card shadow-sm hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600"
            title="Fly to Base"
          >
            <Building className="size-4 text-orange-500" />
          </Button>

          <Button
            variant="outline" size="icon"
            onClick={handleFlyToLive}
            className={cn(
              'bg-card shadow-sm transition-colors',
              liveLocation
                ? 'hover:bg-blue-50 hover:border-blue-300 border-blue-200'
                : 'hover:bg-blue-50 hover:border-blue-300',
            )}
            title={liveLocation ? `My location (±${liveLocation.accuracy.toFixed(0)}m)` : 'Fly to My Location'}
          >
            <Locate className={cn(
              'size-4 transition-colors',
              liveLocation ? 'text-blue-500' : 'text-muted-foreground',
            )} />
          </Button>

          {highlightedSegmentIds.length > 0 && (
            <Button
              variant="outline" size="icon"
              onClick={() => setHighlightedSegmentIds([])}
              className="bg-card shadow-sm hover:bg-yellow-50 hover:border-yellow-300"
              title="Clear route highlight"
            >
              <X className="size-4 text-yellow-600" />
            </Button>
          )}
        </div>

        {/* ── Map Mode Toggle ── */}
        {!waypointMode && !spliceMode && !placementMode && !moveModeJointId && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
            <div className="flex bg-card border border-border rounded-xl shadow-lg overflow-hidden">
              <button
                onClick={() => setMapMode('live')}
                className={cn(
                  'px-4 py-2 text-xs font-semibold transition-all flex items-center gap-1.5',
                  !isDraftMap
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <div className={cn('size-2 rounded-full', !isDraftMap ? 'bg-green-400 animate-pulse' : 'bg-muted-foreground/40')} />
                Live Map
              </button>
              <button
                onClick={() => setMapMode('draft')}
                className={cn(
                  'px-4 py-2 text-xs font-semibold transition-all flex items-center gap-1.5 border-l border-border',
                  isDraftMap
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                )}
              >
                <div className={cn('size-2 rounded-full', isDraftMap ? 'bg-white animate-pulse' : 'bg-muted-foreground/40')} />
                Draft Map
              </button>
            </div>
          </div>
        )}

        {/* ── Waypoint mode banner ── */}
        {waypointMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <Badge className="h-7 px-3 text-xs font-medium shadow-md bg-purple-500 text-white flex items-center gap-1.5">
              <MapPin className="size-3" /> Click map to place turns — {pendingWaypoints.length} placed
            </Badge>
          </div>
        )}

        {/* ── Splice mode banner ── */}
        {spliceMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <Badge className="h-7 px-3 text-xs font-medium shadow-md bg-violet-600 text-white flex items-center gap-1.5">
              <Scissors className="size-3" /> Drag the marker to the splice point
            </Badge>
          </div>
        )}

        {/* ── Placement mode banner ── */}
        {placementMode && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <Badge className="h-7 px-3 text-xs font-medium shadow-md bg-blue-600 text-white flex items-center gap-1.5">
              <MapPin className="size-3" /> Drag the marker to the desired location
            </Badge>
          </div>
        )}

        {/* ── Move mode banner ── */}
        {moveModeJointId && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <Badge className="h-7 px-3 text-xs font-medium shadow-md bg-amber-500 text-white flex items-center gap-1.5">
              <MapPin className="size-3" /> Drag to move the joint
            </Badge>
          </div>
        )}

        {/* ── Waypoint controls (bottom bar) ── */}
        {waypointMode && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
            <Button
              variant="outline"
              onClick={handleUndoWaypoint}
              disabled={pendingWaypoints.length === 0}
              className="bg-card shadow-sm"
            >
              <Undo2 className="size-4 mr-1" />
              Undo
            </Button>
            <Button variant="destructive" onClick={handleWaypointsCancel}>
              Cancel
            </Button>
            <Button onClick={handleWaypointsDone} className="bg-purple-500 hover:bg-purple-600 shadow-md">
              <Check className="size-4 mr-1" />
              Done ({pendingWaypoints.length})
            </Button>
          </div>
        )}

        {/* ── Splice positioning controls (bottom bar) ── */}
        {spliceMode && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
            <div className="bg-card border border-violet-200 rounded-lg px-3 py-1.5 shadow-sm">
              {spliceMarkerPos ? (
                <p className="text-[11px] text-violet-700 font-mono tabular-nums">
                  {spliceMarkerPos.lat.toFixed(6)}, {spliceMarkerPos.lng.toFixed(6)}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">Drag the marker to position</p>
              )}
            </div>
            <Button
              variant="outline" size="sm"
              onClick={handleCancelSpliceMode}
              className="bg-card shadow-sm"
            >
              <X className="size-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSplicePosition}
              disabled={!spliceMarkerPos}
              className="bg-violet-600 hover:bg-violet-700 text-white shadow-md"
            >
              <Check className="size-3.5 mr-1" />
              Confirm
            </Button>
          </div>
        )}

        {/* ── Placement positioning controls (bottom bar) ── */}
        {placementMode && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-card border border-blue-200 rounded-lg px-3 py-1.5 shadow-sm">
                {placementPos ? (
                  <p className="text-[11px] text-blue-700 font-mono tabular-nums">
                    {placementPos.lat.toFixed(6)}, {placementPos.lng.toFixed(6)}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Drag to position</p>
                )}
              </div>
              {liveLocation && (
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPlacementPos({ lat: liveLocation.lat, lng: liveLocation.lng })}
                  className="bg-card shadow-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                >
                  <Locate className="size-3.5 mr-1" />
                  Use Live
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  setPlacementMode(false);
                  setPlacementData(null);
                  setPlacementPos(null);
                }}
                disabled={placementIsSaving}
                className="bg-card shadow-sm"
              >
                <X className="size-3.5 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  if (!placementData || !placementPos) return;
                  setPlacementIsSaving(true);
                  try {
                    await createJoint({ ...placementData, lat: placementPos.lat, lng: placementPos.lng });
                    showToast('Joint added!');
                    setPlacementMode(false);
                    setPlacementData(null);
                    setPlacementPos(null);
                  } catch {
                    showToast('Failed to add joint', 'error');
                  } finally {
                    setPlacementIsSaving(false);
                  }
                }}
                disabled={!placementPos || placementIsSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              >
                {placementIsSaving ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Check className="size-3.5 mr-1" />}
                Confirm Placement
              </Button>
            </div>
          </div>
        )}

        {/* ── Move positioning controls (bottom bar) ── */}
        {moveModeJointId && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="bg-card border border-amber-200 rounded-lg px-3 py-1.5 shadow-sm">
                {movePos ? (
                  <p className="text-[11px] text-amber-700 font-mono tabular-nums">
                    {movePos.lat.toFixed(6)}, {movePos.lng.toFixed(6)}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Drag to position</p>
                )}
              </div>
              {liveLocation && (
                <Button
                  variant="outline" size="sm"
                  onClick={() => setMovePos({ lat: liveLocation.lat, lng: liveLocation.lng })}
                  className="bg-card shadow-sm text-amber-600 hover:text-amber-700 hover:bg-amber-50 border-amber-200"
                >
                  <Locate className="size-3.5 mr-1" />
                  Use Live
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => {
                  setMoveModeJointId(null);
                  setMovePos(null);
                }}
                disabled={moveIsSaving}
                className="bg-card shadow-sm"
              >
                <X className="size-3.5 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  if (!movePos || !moveModeJointId) return;
                  setMoveIsSaving(true);
                  try {
                    await updateJoint(moveModeJointId, { lat: movePos.lat, lng: movePos.lng });
                    showToast('Joint moved successfully!');
                    setMoveModeJointId(null);
                    setMovePos(null);
                  } catch {
                    showToast('Failed to move joint', 'error');
                  } finally {
                    setMoveIsSaving(false);
                  }
                }}
                disabled={!movePos || moveIsSaving}
                className="bg-amber-500 hover:bg-amber-600 text-white shadow-md"
              >
                {moveIsSaving ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Check className="size-3.5 mr-1" />}
                Confirm Move
              </Button>
            </div>
          </div>
        )}

        {/* ── FAB — only on Draft Map ── */}
        {isDraftMap && !waypointMode && !spliceMode && !placementMode && !moveModeJointId && (
          <div className="absolute bottom-6 right-4 md:right-6 z-10">
            {showAddMenu && (
              <div className="absolute bottom-16 right-0 bg-card border border-border rounded-xl shadow-lg overflow-hidden mb-2 w-52 ring-1 ring-foreground/5">
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    showToast('Click on the map to place a joint');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left border-b border-border"
                >
                  <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Add Joint</p>
                    <p className="text-[10px] text-muted-foreground">Click map to place</p>
                  </div>
                </button>
                <button
                  onClick={() => { setShowAddMenu(false); setShowConnectionModal(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left"
                >
                  <div className="size-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Link className="size-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Add Connection</p>
                    <p className="text-[10px] text-muted-foreground">Link two joints</p>
                  </div>
                </button>
              </div>
            )}

            <Button
              size="lg"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className={cn(
                'size-14 rounded-2xl shadow-lg transition-all',
                showAddMenu
                  ? 'bg-muted text-muted-foreground border border-border rotate-45'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-primary/20',
              )}
              title="Add Joint or Connection"
            >
              <Plus className="size-7" />
            </Button>
          </div>
        )}

        {showAddMenu && (
          <div className="fixed inset-0 z-[5]" onClick={() => setShowAddMenu(false)} />
        )}

        {/* ── Map ── */}
        <MapView
          joints={filteredJoints}
          segments={segments}
          onMapClick={handleMapClick}
          onEditJoint={setEditingJointId}
          onDeleteJoint={handleDeleteJoint}
          onApproveJoint={handleApproveJoint}
          onRejectJoint={handleRejectJoint}
          onDeleteSegment={handleDeleteSegment}
          onApproveSegment={handleApproveSegment}
          onRejectSegment={handleRejectSegment}
          onSegmentClick={handleSegmentClick}
          highlightedSegmentIds={highlightedSegmentIds}
          mapRef={mapRef}
          onMapReady={onMapReady}
          waypointMode={waypointMode}
          pendingWaypoints={pendingWaypoints}
          pendingFromJoint={pendingFromJoint}
          pendingToJoint={pendingToJoint}
          spliceMode={spliceMode}
          spliceMarkerPos={spliceMarkerPos}
          onSpliceMarkerMove={handleSpliceMarkerMove}
          placementMode={placementMode}
          placementPos={placementPos}
          onPlacementMarkerMove={(lat, lng) => setPlacementPos({ lat, lng })}
          moveMode={!!moveModeJointId}
          movePos={movePos}
          onMoveMarkerMove={(lat, lng) => setMovePos({ lat, lng })}
          liveLocation={liveLocation}
          userRole={role}
        />
      </div>

      {/* ── Modals ───────────────────────────────────────────────────────────── */}

      {addJointModalCoords && (
        <AddJointModal
          onSubmit={(payload) => {
            setPlacementData(payload);
            setPlacementPos(addJointModalCoords);
            setPlacementMode(true);
            setAddJointModalCoords(null);
            showToast('Drag the marker to exactly where you want to place the joint.');
          }}
          onClose={() => setAddJointModalCoords(null)}
        />
      )}

      {editingJoint && (
        <EditJointModal
          joint={editingJoint}
          onSubmit={async (payload) => {
            await updateJoint(editingJoint.id, payload);
            showToast('Joint updated!');
          }}
          onMoveLocation={() => {
            setMoveModeJointId(editingJoint.id);
            setMovePos({ lat: editingJoint.lat, lng: editingJoint.lng });
            setEditingJointId(null);
            showToast('Drag the marker to the new location.');
            handleFlyTo(editingJoint.lat, editingJoint.lng);
          }}
          onClose={() => setEditingJointId(null)}
        />
      )}

      {showConnectionModal && (
        <AddConnectionModal
          joints={joints}
          onSubmit={async (payload) => {
            await createSegment(payload);
            const from = joints.find((j) => j.id === payload.fromJointId);
            const to = joints.find((j) => j.id === payload.toJointId);
            showToast(`Connected ${from?.label} to ${to?.label}`);
            setPendingWaypoints([]);
            setPendingConnection(null);
            setWaypointsDone(false);
          }}
          onClose={() => {
            setShowConnectionModal(false);
            setPendingWaypoints([]);
            setPendingConnection(null);
            setWaypointsDone(false);
          }}
          onPickWaypoints={handlePickWaypoints}
          pendingWaypoints={pendingWaypoints}
          waypointsDone={waypointsDone}
          onResetWaypointsDone={() => setWaypointsDone(false)}
          pendingConnection={pendingConnection}
        />
      )}

      {spliceModalData && (
        <SpliceJointModal
          lat={spliceModalData.lat}
          lng={spliceModalData.lng}
          segmentId={spliceModalData.segmentId}
          segments={segments}
          joints={joints}
          liveLocation={liveLocation}
          onSubmit={async (payload) => {
            const result = await spliceJoint(payload);
            applySplice(result.deletedSegmentId, result.segmentA, result.segmentB);
            showToast(`Splice joint "${payload.label}" added`);
            resetSpliceState();
          }}
          onClose={resetSpliceState}
        />
      )}

      {/* ── Team Management ── */}
      <TeamManagement
        open={teamManagementOpen}
        onClose={() => setTeamManagementOpen(false)}
      />

      {/* ── Settings Sheet ──────────────────────────────────────────────────── */}

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-80 sm:w-96 overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle className="flex items-center gap-2">
              <Settings className="size-4" />
              Settings
            </SheetTitle>
          </SheetHeader>

          <div className="space-y-6">
            {/* Network Stats */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Network Overview
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Total Joints', value: joints.length, color: 'text-blue-600' },
                  { label: 'Segments', value: segments.length, color: 'text-purple-600' },
                  { label: 'Total Length', value: `${totalKm.toFixed(2)} km`, color: 'text-green-600' },
                  { label: 'Base Stations', value: baseJoints.length, color: 'text-orange-600' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-muted rounded-xl p-3 border border-border">
                    <p className={cn('text-xl font-bold', stat.color)}>{stat.value}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Live Location Status */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                GPS Status
              </p>
              <div
                className={cn(
                  'flex items-center justify-between rounded-xl px-3 py-2.5 border',
                  liveLocation
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-muted border-border',
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'size-2 rounded-full',
                    liveLocation ? 'bg-blue-500 animate-pulse' : 'bg-muted-foreground/40',
                  )} />
                  <div>
                    <p className={cn('text-xs font-medium', liveLocation ? 'text-blue-700' : 'text-muted-foreground')}>
                      {liveLocation ? 'Location active' : 'Location unavailable'}
                    </p>
                    {liveLocation && (
                      <p className="text-[10px] text-blue-600 font-mono">
                        ±{liveLocation.accuracy.toFixed(0)}m accuracy
                      </p>
                    )}
                  </div>
                </div>
                {liveLocation && (
                  <Button
                    variant="ghost" size="xs"
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 h-6 px-2"
                    onClick={() => { handleFlyToLive(); setSettingsOpen(false); }}
                  >
                    <Locate className="size-3 mr-1" />
                    <span className="text-[10px]">Go</span>
                  </Button>
                )}
              </div>
            </section>

            {/* Base Joints */}
            {baseJoints.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Base Stations
                </p>
                <div className="space-y-2">
                  {baseJoints.map((j) => (
                    <div
                      key={j.id}
                      className="flex items-center justify-between bg-muted border border-border rounded-xl px-3 py-2.5 cursor-pointer hover:bg-muted/80"
                      onClick={() => { handleFlyTo(j.lat, j.lng); setSettingsOpen(false); }}
                    >
                      <div className="flex items-center gap-2">
                        <Building className="size-5 shrink-0 text-orange-500" />
                        <div>
                          <p className="text-sm font-medium text-foreground">{j.label}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {j.lat.toFixed(5)}, {j.lng.toFixed(5)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="icon-xs"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); handleDeleteJoint(j.id); }}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Role info */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Your Role
              </p>
              <div className="bg-muted rounded-xl px-3 py-2.5 border border-border">
                <p className="text-sm font-medium text-foreground">{role === 'OWNER' ? '👑 Owner' : '👷 Employee'}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {user?.organizationName || 'Organization'}
                </p>
              </div>
            </section>

            {/* Joint type legend */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Joint Types
              </p>
              <div className="space-y-2">
                {[
                  { type: 'Base', icon: Building, iconColor: 'text-orange-500', dot: 'bg-orange-500', desc: 'ISP central / head-end' },
                  { type: 'Main', icon: CircleDot, iconColor: 'text-blue-500', dot: 'bg-blue-500', desc: 'Primary distribution joint' },
                  { type: 'Sub', icon: Circle, iconColor: 'text-yellow-500', dot: 'bg-yellow-500', desc: 'Sub-distribution joint' },
                  { type: 'Splice', icon: Scissors, iconColor: 'text-purple-500', dot: 'bg-purple-500', desc: 'Mid-cable splice point' },
                ].map(({ type, icon: Icon, iconColor, dot, desc }) => (
                  <div key={type} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted border border-border">
                    <div className={cn('size-2.5 rounded-full shrink-0', dot)} />
                    <Icon className={cn("size-4 shrink-0", iconColor)} />
                    <div>
                      <p className="text-xs font-medium text-foreground">{type}</p>
                      <p className="text-[10px] text-muted-foreground">{desc}</p>
                    </div>
                    <Badge variant="secondary" className="ml-auto text-[10px] h-4">
                      {joints.filter((j) => j.jointType === type).length}
                    </Badge>
                  </div>
                ))}
              </div>
            </section>

            {/* Account */}
            <section>
              <p className="text-xs font-semibold text-destructive/70 uppercase tracking-wider mb-3">
                Account
              </p>
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/5"
                onClick={() => { setSettingsOpen(false); logout(); }}
              >
                <LogOut className="size-4" />
                Sign Out
              </Button>
            </section>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}