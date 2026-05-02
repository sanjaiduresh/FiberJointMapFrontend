import { useState, useEffect, useCallback } from 'react';
import type { FiberJoint, CreateJointPayload, SpliceJointPayload } from '../types';
import { API_BASE } from '../config';
import type { RawSegment } from './useSegments';

const API_URL = `${API_BASE}/api/joints`;
const SEGMENTS_URL = `${API_BASE}/api/segments`;

interface RawJoint {
  _id: string;
  label: string;
  notes: string;
  jointType: 'Base' | 'Main' | 'Sub' | 'Splice';
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  lat: number;
  lng: number;
  createdBy: { userId: string; userName: string };
  createdAt: string;
}

function mapJoint(raw: RawJoint): FiberJoint {
  return {
    id: raw._id,
    label: raw.label,
    notes: raw.notes,
    jointType: raw.jointType || 'Main',
    cableType: raw.cableType || 'Single Mode',
    fiberCount: raw.fiberCount ?? 12,
    lat: raw.lat,
    lng: raw.lng,
    createdBy: raw.createdBy || { userId: '', userName: 'Unknown' },
    createdAt: raw.createdAt,
  };
}

export function useJoints(token: string | null) {
  const [joints, setJoints] = useState<FiberJoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJoints = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      if (!silent) setLoading(true);
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch joints');
      const data: RawJoint[] = await res.json();
      setJoints(data.map(mapJoint));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token]);

  const createJoint = useCallback(async (payload: CreateJointPayload) => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create joint');
    const raw: RawJoint = await res.json();
    const newJoint = mapJoint(raw);
    setJoints((prev) => [newJoint, ...prev]);
    return newJoint;
  }, [token]);

  const deleteJoint = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to delete joint');
    setJoints((prev) => prev.filter((j) => j.id !== id));
  }, [token]);

  const updateJoint = useCallback(async (id: string, payload: Partial<CreateJointPayload>) => {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to update joint');
    const raw: RawJoint = await res.json();
    const updatedJoint = mapJoint(raw);
    setJoints((prev) => prev.map((j) => (j.id === id ? updatedJoint : j)));
    return updatedJoint;
  }, [token]);

  // Splice a joint onto an existing segment — splits it into two
  const spliceJoint = useCallback(async (payload: SpliceJointPayload): Promise<{
    spliceJoint: FiberJoint;
    segmentA: RawSegment;
    segmentB: RawSegment;
    deletedSegmentId: string;
  }> => {
    const { segmentId, ...rest } = payload;
    const res = await fetch(`${SEGMENTS_URL}/${segmentId}/splice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(rest),
    });
    if (!res.ok) throw new Error('Failed to splice joint');
    const data = await res.json();

    // Add the new splice joint to state immediately
    const newJoint = mapJoint(data.spliceJoint);
    setJoints((prev) => [newJoint, ...prev]);

    return {
      spliceJoint: newJoint,
      segmentA: data.segmentA,
      segmentB: data.segmentB,
      deletedSegmentId: data.deletedSegmentId,
    };
  }, [token]);

  // Initial fetch
  useEffect(() => {
    fetchJoints();
  }, [fetchJoints]);

  // 10-second polling
  useEffect(() => {
    const interval = setInterval(() => fetchJoints(true), 10000);
    return () => clearInterval(interval);
  }, [fetchJoints]);

  return { joints, loading, error, createJoint, updateJoint, deleteJoint, spliceJoint, refetch: fetchJoints };
}