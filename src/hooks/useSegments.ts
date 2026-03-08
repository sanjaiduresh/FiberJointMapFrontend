import { useState, useEffect, useCallback } from 'react';
import type { Segment, CreateSegmentPayload } from '../types';
import { API_BASE } from '../config';

const API_URL = `${API_BASE}/api/segments`;

interface RawSegment {
  _id: string;
  fromJointId: string;
  toJointId: string;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  lengthMeters: number;
  createdBy: { userId: string; userName: string };
  createdAt: string;
}

function mapSegment(raw: RawSegment): Segment {
  return {
    id: raw._id,
    fromJointId: raw.fromJointId,
    toJointId: raw.toJointId,
    cableType: raw.cableType,
    fiberCount: raw.fiberCount,
    lengthMeters: raw.lengthMeters,
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
  };
}

export function useSegments(token: string | null) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSegments = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Failed to fetch segments');
      const data: RawSegment[] = await res.json();
      setSegments(data.map(mapSegment));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const createSegment = useCallback(async (payload: CreateSegmentPayload) => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create segment');
    const raw: RawSegment = await res.json();
    const newSegment = mapSegment(raw);
    setSegments((prev) => [newSegment, ...prev]);
    return newSegment;
  }, [token]);

  const deleteSegment = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to delete segment');
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }, [token]);

  // Initial fetch
  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  // 10-second polling
  useEffect(() => {
    const interval = setInterval(() => fetchSegments(true), 10000);
    return () => clearInterval(interval);
  }, [fetchSegments]);

  return { segments, loading, error, createSegment, deleteSegment, refetch: fetchSegments };
}
