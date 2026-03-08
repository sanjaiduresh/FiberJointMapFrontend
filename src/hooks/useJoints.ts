import { useState, useEffect, useCallback } from 'react';
import type { FiberJoint, CreateJointPayload } from '../types';

const API_URL = '/api/joints';

interface RawJoint {
  _id: string;
  label: string;
  notes: string;
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
    try {
      if (!silent) setLoading(true);
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Failed to fetch joints');
      const data: RawJoint[] = await res.json();
      setJoints(data.map(mapJoint));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

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

  // Initial fetch
  useEffect(() => {
    fetchJoints();
  }, [fetchJoints]);

  // 10-second polling
  useEffect(() => {
    const interval = setInterval(() => fetchJoints(true), 10000);
    return () => clearInterval(interval);
  }, [fetchJoints]);

  return { joints, loading, error, createJoint, deleteJoint, refetch: fetchJoints };
}
