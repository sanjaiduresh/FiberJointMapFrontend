import { useState, useEffect, useCallback } from 'react';
import type { Segment, CreateSegmentPayload, ApprovalStatus } from '../types';
import { API_BASE } from '../config';

const API_URL = `${API_BASE}/api/segments`;

export interface RawSegment {
  _id: string;
  fromJointId: string;
  toJointId: string;
  waypoints: Array<{ lat: number; lng: number }>;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  lengthMeters: number;
  createdBy: { userId: string; userName: string };
  organizationId: string;
  approvalStatus: ApprovalStatus;
  createdAt: string;
}

function mapSegment(raw: RawSegment): Segment {
  return {
    id: raw._id,
    fromJointId: raw.fromJointId,
    toJointId: raw.toJointId,
    waypoints: raw.waypoints || [],
    cableType: raw.cableType,
    fiberCount: raw.fiberCount,
    lengthMeters: raw.lengthMeters,
    createdBy: raw.createdBy,
    organizationId: raw.organizationId || '',
    approvalStatus: raw.approvalStatus || 'APPROVED',
    createdAt: raw.createdAt,
  };
}

export function useSegments(token: string | null, approvalStatusFilter?: string) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSegments = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      if (!silent) setLoading(true);
      const url = approvalStatusFilter
        ? `${API_URL}?approvalStatus=${approvalStatusFilter}`
        : API_URL;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch segments');
      const data: RawSegment[] = await res.json();
      setSegments(data.map(mapSegment));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token, approvalStatusFilter]);

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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete segment');
    }
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }, [token]);

  const approveSegment = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/${id}/approve`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to approve segment');
    const raw: RawSegment = await res.json();
    const approved = mapSegment(raw);
    setSegments((prev) => prev.map((s) => (s.id === id ? approved : s)));
    return approved;
  }, [token]);

  const rejectSegment = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/${id}/reject`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to reject segment');
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }, [token]);

  // Called after a splice — removes the old segment, adds the two new ones
  const applySplice = useCallback((
    deletedSegmentId: string,
    rawSegA: RawSegment,
    rawSegB: RawSegment,
  ) => {
    setSegments((prev) => [
      ...prev.filter((s) => s.id !== deletedSegmentId),
      mapSegment(rawSegA),
      mapSegment(rawSegB),
    ]);
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSegments();
  }, [fetchSegments]);

  // 10-second polling
  useEffect(() => {
    const interval = setInterval(() => fetchSegments(true), 10000);
    return () => clearInterval(interval);
  }, [fetchSegments]);


  return {
    segments, loading, error,
    createSegment, deleteSegment,
    approveSegment, rejectSegment,
    applySplice,
    refetch: fetchSegments,
  };
}