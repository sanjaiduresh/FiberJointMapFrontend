import { useState, useEffect, useCallback } from 'react';
import type { Cut, CreateCutPayload } from '../types';

const API_URL = '/api/cuts';

interface RawCut {
  _id: string;
  lat: number;
  lng: number;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  status: 'Cut' | 'Fixed';
  segmentId: string;
  markedBy: { userId: string; userName: string };
  fixedBy?: { userId: string; userName: string };
  fixedAt?: string;
  createdAt: string;
}

function mapCut(raw: RawCut): Cut {
  return {
    id: raw._id,
    lat: raw.lat,
    lng: raw.lng,
    severity: raw.severity,
    description: raw.description,
    status: raw.status,
    segmentId: raw.segmentId,
    markedBy: raw.markedBy,
    fixedBy: raw.fixedBy,
    fixedAt: raw.fixedAt,
    createdAt: raw.createdAt,
  };
}

export function useCuts(token: string | null) {
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCuts = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Failed to fetch cuts');
      const data: RawCut[] = await res.json();
      setCuts(data.map(mapCut));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const createCut = useCallback(async (payload: CreateCutPayload) => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to create cut');
    const raw: RawCut = await res.json();
    const newCut = mapCut(raw);
    setCuts((prev) => [newCut, ...prev]);
    return newCut;
  }, [token]);

  const markFixed = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/${id}/fix`, {
      method: 'PATCH',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to fix cut');
    const raw: RawCut = await res.json();
    const updated = mapCut(raw);
    setCuts((prev) => prev.map((c) => (c.id === id ? updated : c)));
    return updated;
  }, [token]);

  const deleteCut = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to delete cut');
    setCuts((prev) => prev.filter((c) => c.id !== id));
  }, [token]);

  // Initial fetch
  useEffect(() => {
    fetchCuts();
  }, [fetchCuts]);

  // 10-second polling
  useEffect(() => {
    const interval = setInterval(() => fetchCuts(true), 10000);
    return () => clearInterval(interval);
  }, [fetchCuts]);

  return { cuts, loading, error, createCut, markFixed, deleteCut, refetch: fetchCuts };
}
