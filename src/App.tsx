import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useJoints } from './hooks/useJoints';
import { useCuts } from './hooks/useCuts';
import { useSegments } from './hooks/useSegments';
import { useGeolocation } from './hooks/useGeolocation';
import MapView from './components/MapView';
import type { LeafletMap } from './components/MapView';
import { BASE_LAT, BASE_LNG } from './components/MapView';
import AddJointModal from './components/AddJointModal';
import AddCutModal from './components/AddCutModal';
import AddConnectionModal from './components/AddConnectionModal';
import LoginPage from './components/LoginPage';
import Sidebar from './components/JointSidebar';
import SearchBar from './components/SearchBar';
import type { Segment } from './types';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

// BFS to find shortest path between two joints via segments
function bfsPath(
  fromId: string,
  toId: string,
  segments: Segment[]
): string[] | null {
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

    const neighbors = adj.get(jointId) || [];
    for (const { neighborId, segmentId } of neighbors) {
      if (!visited.has(neighborId)) {
        visited.add(neighborId);
        queue.push({ jointId: neighborId, path: [...path, segmentId] });
      }
    }
  }

  return null;
}

export default function App() {
  const { user, token, loading: authLoading, logout, isAuthenticated } = useAuth();
  const { joints, loading: jointsLoading, error: jointsError, createJoint, deleteJoint } = useJoints(token);
  const { cuts, loading: cutsLoading, error: cutsError, createCut, markFixed } = useCuts(token);
  const { segments, loading: segmentsLoading, error: segmentsError, createSegment } = useSegments(token);
  const geo = useGeolocation();

  const [modalCoords, setModalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cutModalCoords, setCutModalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const mapRef = useRef<LeafletMap | null>(null);

  // Modes
  const [cutMode, setCutMode] = useState(false);

  // Path tracing
  const [traceMode, setTraceMode] = useState(false);
  const [traceFrom, setTraceFrom] = useState<string | null>(null);
  const [highlightedSegmentIds, setHighlightedSegmentIds] = useState<string[]>([]);

  // Toast messages
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fly to base on first load
  const hasFlownToBase = useRef(false);
  const onMapReady = useCallback((map: LeafletMap | null) => {
    mapRef.current = map;
    if (map && !hasFlownToBase.current) {
      hasFlownToBase.current = true;
      setTimeout(() => map.setView([BASE_LAT, BASE_LNG], 15), 300);
    }
  }, []);

  const filteredJoints = useMemo(() => {
    if (!searchQuery.trim()) return joints;
    const q = searchQuery.toLowerCase();
    return joints.filter(
      (j) => j.label.toLowerCase().includes(q) || j.notes.toLowerCase().includes(q),
    );
  }, [joints, searchQuery]);

  const handleMapClick = (lat: number, lng: number) => {
    if (cutMode) {
      setCutModalCoords({ lat, lng });
    } else {
      setModalCoords({ lat, lng });
    }
  };

  const handleFlyTo = (lat: number, lng: number) => {
    mapRef.current?.flyTo([lat, lng], 16, { duration: 1.5 });
    if (isMobile) setSidebarOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this joint? Connected segments and cuts will also be deleted.')) {
      try {
        await deleteJoint(id);
        showToast('Joint deleted successfully');
      } catch {
        showToast('Failed to delete joint', 'error');
      }
    }
  };

  const handleMarkFixed = async (id: string) => {
    try {
      await markFixed(id);
      showToast('Cut marked as fixed! ✅');
    } catch {
      showToast('Failed to mark cut as fixed', 'error');
    }
  };

  // Trace route
  const handleTraceRoute = (fromId: string, toId: string) => {
    if (!toId) {
      setTraceFrom(fromId);
      const joint = joints.find((j) => j.id === fromId);
      showToast(`Start: ${joint?.label || 'joint'} — now click the destination`);
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

  // GPS cut placement
  const handleGpsCut = () => {
    geo.getLocation();
  };

  useEffect(() => {
    if (geo.lat != null && geo.lng != null && cutMode) {
      setCutModalCoords({ lat: geo.lat, lng: geo.lng });
    }
  }, [geo.lat, geo.lng, cutMode]);

  useEffect(() => {
    if (geo.error) showToast(geo.error, 'error');
  }, [geo.error, showToast]);

  // Show auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen w-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;

  const anyLoading = jointsLoading || cutsLoading || segmentsLoading;
  const anyError = jointsError || cutsError || segmentsError;

  return (
    <div className="h-screen w-screen flex bg-slate-950 text-white overflow-hidden relative">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[2000] px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium backdrop-blur-sm transition-all ${
          toast.type === 'error'
            ? 'bg-red-500/90 text-white border border-red-400/50'
            : 'bg-emerald-500/90 text-white border border-emerald-400/50'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Mobile Backdrop */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1100]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          ${isMobile
            ? `fixed top-0 left-0 h-full z-[1200] transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`
            : `${sidebarOpen ? 'w-80' : 'w-0'} flex-shrink-0 transition-all duration-300 overflow-hidden`
          }
        `}
      >
        <div className="w-80 h-full flex flex-col bg-slate-900/95 border-r border-slate-700/50">
          {/* Sidebar Header */}
          <div className="px-4 pt-5 pb-4 border-b border-slate-700/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0020 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-base font-bold text-white tracking-tight">FiberTrack</h1>
                  <p className="text-[11px] text-slate-400">ISP Joint Mapper</p>
                </div>
              </div>
              {isMobile && (
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors"
                >
                  <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* User Info Bar */}
            <div className="flex items-center justify-between bg-slate-800/50 rounded-lg px-3 py-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-[10px] font-bold text-white">
                  {user?.name?.charAt(0).toUpperCase() || '?'}
                </div>
                <span className="text-xs text-slate-300 font-medium">{user?.name || 'User'}</span>
              </div>
              <button
                onClick={logout}
                className="text-[10px] text-slate-400 hover:text-red-400 transition-colors px-2 py-1 rounded"
                title="Logout"
              >
                Logout
              </button>
            </div>

            <SearchBar onSearch={setSearchQuery} />
          </div>

          {/* Loading / Error */}
          {anyLoading && (
            <div className="flex items-center justify-center py-3 border-b border-slate-800/50">
              <div className="w-5 h-5 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              <span className="text-xs text-slate-500 ml-2">Loading...</span>
            </div>
          )}
          {anyError && (
            <div className="px-3 py-2 border-b border-slate-800/50">
              <p className="text-xs text-red-400">{anyError}</p>
            </div>
          )}

          {/* Sidebar Content */}
          <Sidebar
            joints={filteredJoints}
            cuts={cuts}
            segments={segments}
            onFlyTo={handleFlyTo}
            onDeleteJoint={handleDelete}
            onTraceRoute={handleTraceRoute}
            traceMode={traceMode}
            onToggleTraceMode={() => {
              setTraceMode(!traceMode);
              setTraceFrom(null);
              setHighlightedSegmentIds([]);
              if (cutMode) setCutMode(false);
            }}
            traceFrom={traceFrom}
          />

          {/* Sidebar Footer */}
          <div className="px-4 py-3 border-t border-slate-800/50 bg-slate-900/50">
            <p className="text-[10px] text-slate-600 text-center">
              {cutMode ? 'Click map or use GPS to place a cut marker'
                : 'Click on the map to add a joint'}
            </p>
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative">
        {/* Toggle Sidebar */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 z-[1050] p-2 bg-slate-800/90 hover:bg-slate-700 border border-slate-600/50 rounded-xl shadow-lg backdrop-blur-sm transition-all"
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <svg
            className={`w-5 h-5 text-slate-300 transition-transform ${sidebarOpen && !isMobile ? '' : 'rotate-180'}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* Map Control Buttons (top-right) */}
        <div className="absolute top-4 right-4 z-[1050] flex flex-col gap-2">
          {/* Fly to Base */}
          <button
            onClick={() => mapRef.current?.flyTo([BASE_LAT, BASE_LNG], 15, { duration: 1.5 })}
            className="p-2.5 bg-slate-800/90 hover:bg-orange-600/90 border border-slate-600/50 hover:border-orange-500/50 rounded-xl shadow-lg backdrop-blur-sm transition-all group"
            title="Fly to Base"
          >
            <svg className="w-5 h-5 text-orange-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </button>

          {/* Fly to My Location */}
          <button
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => mapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 1.5 }),
                  () => showToast('Could not get your location', 'error'),
                  { enableHighAccuracy: true }
                );
              }
            }}
            className="p-2.5 bg-slate-800/90 hover:bg-blue-600/90 border border-slate-600/50 hover:border-blue-500/50 rounded-xl shadow-lg backdrop-blur-sm transition-all group"
            title="Fly to My Location"
          >
            <svg className="w-5 h-5 text-blue-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2v2m0 16v2m10-10h-2M4 12H2" />
            </svg>
          </button>

          {/* Cut Mode */}
          <button
            onClick={() => {
              setCutMode(!cutMode);
              if (traceMode) { setTraceMode(false); setTraceFrom(null); setHighlightedSegmentIds([]); }
            }}
            className={`p-2.5 border rounded-xl shadow-lg backdrop-blur-sm transition-all group ${
              cutMode
                ? 'bg-red-600/90 border-red-500/50 hover:bg-red-500/90'
                : 'bg-slate-800/90 hover:bg-red-600/90 border-slate-600/50 hover:border-red-500/50'
            }`}
            title="Mark Cut Mode"
          >
            <svg className={`w-5 h-5 ${cutMode ? 'text-white' : 'text-red-400 group-hover:text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </button>

          {/* GPS Cut (only visible in cut mode) */}
          {cutMode && (
            <button
              onClick={handleGpsCut}
              disabled={geo.loading}
              className="p-2.5 bg-slate-800/90 hover:bg-green-600/90 border border-slate-600/50 hover:border-green-500/50 rounded-xl shadow-lg backdrop-blur-sm transition-all group disabled:opacity-50"
              title="Mark Cut at GPS Location"
            >
              {geo.loading ? (
                <div className="w-5 h-5 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-green-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Mode indicator banner */}
        {cutMode && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1050] px-4 py-2 rounded-xl shadow-lg text-xs font-medium backdrop-blur-sm bg-red-500/90 text-white border border-red-400/50">
            ⚠️ Cut Mode — Click map or use GPS
          </div>
        )}

        {/* ➕ Add Button (FAB) — bottom-right */}
        <div className="absolute bottom-6 right-6 z-[1050]">
          {/* Menu (shown when open) */}
          {showAddMenu && (
            <div className="absolute bottom-16 right-0 bg-slate-800/95 border border-slate-600/50 rounded-xl shadow-2xl backdrop-blur-sm overflow-hidden mb-2 w-52">
              <button
                onClick={() => {
                  setShowAddMenu(false);
                  // User clicks the map to place — just close menu, default map click behavior opens the joint modal
                  showToast('Click on the map to place a joint 📍');
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cyan-500/10 transition-colors text-left border-b border-slate-700/30"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">Add Joint</p>
                  <p className="text-[10px] text-slate-400">Click map to place</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowAddMenu(false);
                  setShowConnectionModal(true);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-purple-500/10 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">Add Connection</p>
                  <p className="text-[10px] text-slate-400">Link two joints</p>
                </div>
              </button>
            </div>
          )}

          {/* FAB Button */}
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className={`w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center transition-all ${
              showAddMenu
                ? 'bg-slate-700 border border-slate-500/50 rotate-45'
                : 'bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-cyan-500/30'
            }`}
            title="Add Joint or Connection"
          >
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Backdrop for add menu */}
        {showAddMenu && (
          <div className="fixed inset-0 z-[1040]" onClick={() => setShowAddMenu(false)} />
        )}

        {/* Map */}
        <MapView
          joints={filteredJoints}
          cuts={cuts}
          segments={segments}
          onMapClick={handleMapClick}
          onDeleteJoint={handleDelete}
          onMarkFixed={handleMarkFixed}
          highlightedSegmentIds={highlightedSegmentIds}
          mapRef={mapRef}
          onMapReady={onMapReady}
        />
      </div>

      {/* Add Joint Modal */}
      {modalCoords && (
        <AddJointModal
          lat={modalCoords.lat}
          lng={modalCoords.lng}
          onSubmit={async (payload) => {
            await createJoint(payload);
            showToast('Joint added! 📍');
          }}
          onClose={() => setModalCoords(null)}
        />
      )}

      {/* Add Cut Modal */}
      {cutModalCoords && (
        <AddCutModal
          lat={cutModalCoords.lat}
          lng={cutModalCoords.lng}
          segments={segments}
          joints={joints}
          onSubmit={async (payload) => {
            await createCut(payload);
            showToast('Cut marked! ⚠️');
          }}
          onClose={() => setCutModalCoords(null)}
        />
      )}

      {/* Add Connection Modal */}
      {showConnectionModal && (
        <AddConnectionModal
          joints={joints}
          onSubmit={async (payload) => {
            await createSegment(payload);
            const from = joints.find((j) => j.id === payload.fromJointId);
            const to = joints.find((j) => j.id === payload.toJointId);
            showToast(`Connected ${from?.label} → ${to?.label} 🔗`);
          }}
          onClose={() => setShowConnectionModal(false)}
        />
      )}
    </div>
  );
}
