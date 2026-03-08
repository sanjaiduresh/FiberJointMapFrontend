import { useState, useEffect, useCallback } from 'react';
import type { FiberJoint, CreateJointPayload } from '../types';

const API_URL = '/api/joints';

interface RawJoint {
  _id: string;
  label: string;
  notes: string;
  lat: number;
  lng: number;
  createdAt: string;
}

function mapJoint(raw: RawJoint): FiberJoint {
  return {
    id: raw._id,
    label: raw.label,
    notes: raw.notes,
    lat: raw.lat,
    lng: raw.lng,
    createdAt: raw.createdAt,
  };
}

export function useJoints() {
  const [joints, setJoints] = useState<FiberJoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJoints = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Failed to fetch joints');
      const data: RawJoint[] = await res.json();
      setJoints(data.map(mapJoint));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const createJoint = useCallback(async (payload: CreateJointPayload) => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create joint');
    const raw: RawJoint = await res.json();
    const newJoint = mapJoint(raw);
    setJoints((prev) => [newJoint, ...prev]);
    return newJoint;
  }, []);

  const deleteJoint = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete joint');
    setJoints((prev) => prev.filter((j) => j.id !== id));
  }, []);

  useEffect(() => {
    fetchJoints();
  }, [fetchJoints]);

  return { joints, loading, error, createJoint, deleteJoint, refetch: fetchJoints };
}
