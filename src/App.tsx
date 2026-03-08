import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useJoints } from './hooks/useJoints';
import MapView from './components/MapView';
import type { LeafletMap } from './components/MapView';
import { BASE_LAT, BASE_LNG } from './components/MapView';
import AddJointModal from './components/AddJointModal';
import JointSidebar from './components/JointSidebar';
import SearchBar from './components/SearchBar';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

export default function App() {
  const { joints, loading, error, createJoint, deleteJoint } = useJoints();
  const [modalCoords, setModalCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const mapRef = useRef<LeafletMap | null>(null);

  // Fly to base on first load
  const hasFlownToBase = useRef(false);
  const onMapReady = useCallback((map: LeafletMap | null) => {
    mapRef.current = map;
    if (map && !hasFlownToBase.current) {
      hasFlownToBase.current = true;
      // Small delay to let tiles load, then fly
      setTimeout(() => {
        map.setView([BASE_LAT, BASE_LNG], 15);
      }, 300);
    }
  }, []);

  const filteredJoints = useMemo(() => {
    if (!searchQuery.trim()) return joints;
    const q = searchQuery.toLowerCase();
    return joints.filter(
      (j) =>
        j.label.toLowerCase().includes(q) || j.notes.toLowerCase().includes(q),
    );
  }, [joints, searchQuery]);

  const handleMapClick = (lat: number, lng: number) => {
    setModalCoords({ lat, lng });
  };

  const handleFlyTo = (lat: number, lng: number) => {
    mapRef.current?.flyTo([lat, lng], 16, { duration: 1.5 });
    if (isMobile) setSidebarOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this joint?')) {
      await deleteJoint(id);
    }
  };

  return (
    <div className="h-screen w-screen flex bg-slate-950 text-white overflow-hidden relative">
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
            <div className="flex items-center justify-between mb-4">
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
              {/* Close button on mobile */}
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
            <SearchBar onSearch={setSearchQuery} />
          </div>

          {/* Joint Count */}
          <div className="px-4 py-2.5 border-b border-slate-800/50">
            <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {filteredJoints.length} Joint{filteredJoints.length !== 1 ? 's' : ''}
              {searchQuery && ` matching "${searchQuery}"`}
            </span>
          </div>

          {/* Joints List */}
          <div className="flex-1 overflow-y-auto p-3 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-12 px-4">
                <p className="text-red-400 text-sm mb-2">Failed to load joints</p>
                <p className="text-slate-500 text-xs">{error}</p>
              </div>
            ) : (
              <JointSidebar joints={filteredJoints} onFlyTo={handleFlyTo} onDelete={handleDelete} />
            )}
          </div>

          {/* Sidebar Footer */}
          <div className="px-4 py-3 border-t border-slate-800/50 bg-slate-900/50">
            <p className="text-[10px] text-slate-600 text-center">
              Click anywhere on the map to add a joint
            </p>
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative">
        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-4 left-4 z-[1050] p-2 bg-slate-800/90 hover:bg-slate-700 border border-slate-600/50 rounded-xl shadow-lg backdrop-blur-sm transition-all"
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
        >
          <svg
            className={`w-5 h-5 text-slate-300 transition-transform ${sidebarOpen && !isMobile ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>

        {/* Map Control Buttons */}
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
                  () => alert('Could not get your location'),
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
        </div>

        {/* Map */}
        <MapView
          joints={filteredJoints}
          onMapClick={handleMapClick}
          onDelete={handleDelete}
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
          }}
          onClose={() => setModalCoords(null)}
        />
      )}
    </div>
  );
}
