import { useState, useEffect, useCallback } from 'react';
import type { FiberJoint, CreateJointPayload, SpliceJointPayload, ApprovalStatus } from '../types';
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
  approvalStatus: ApprovalStatus;
  photos?: Array<{ url: string; publicId: string; uploadedAt: string }>;
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
    approvalStatus: raw.approvalStatus || 'APPROVED',
    photos: (raw.photos || []).map(p => ({ url: p.url, publicId: p.publicId, uploadedAt: p.uploadedAt })),
    createdAt: raw.createdAt,
  };
}

export function useJoints(token: string | null, approvalStatusFilter?: ApprovalStatus) {
  const [joints, setJoints] = useState<FiberJoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchJoints = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      if (!silent) setLoading(true);
      const url = approvalStatusFilter
        ? `${API_URL}?approvalStatus=${approvalStatusFilter}`
        : API_URL;
      const res = await fetch(url, {
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
  }, [token, approvalStatusFilter]);

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
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete joint');
    }
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

  const approveJoint = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/${id}/approve`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to approve joint');
    const raw: RawJoint = await res.json();
    const approved = mapJoint(raw);
    setJoints((prev) => prev.map((j) => (j.id === id ? approved : j)));
    return approved;
  }, [token]);

  const rejectJoint = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/${id}/reject`, {
      method: 'PUT',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to reject joint');
    // Remove from local state after rejection
    setJoints((prev) => prev.filter((j) => j.id !== id));
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

  const uploadJointPhoto = useCallback(async (jointId: string, file: File): Promise<FiberJoint> => {
    const formData = new FormData();
    formData.append('photo', file);
    const res = await fetch(`${API_URL}/${jointId}/photos`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error('Failed to upload photo');
    const raw: RawJoint = await res.json();
    const updated = mapJoint(raw);
    setJoints((prev) => prev.map((j) => (j.id === jointId ? updated : j)));
    return updated;
  }, [token]);

  const deleteJointPhoto = useCallback(async (jointId: string, publicId: string): Promise<FiberJoint> => {
    const res = await fetch(`${API_URL}/${jointId}/photos/${encodeURIComponent(publicId)}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Failed to delete photo');
    const raw: RawJoint = await res.json();
    const updated = mapJoint(raw);
    setJoints((prev) => prev.map((j) => (j.id === jointId ? updated : j)));
    return updated;
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

  return {
    joints, loading, error,
    createJoint, updateJoint, deleteJoint,
    approveJoint, rejectJoint,
    spliceJoint, refetch: fetchJoints,
    uploadJointPhoto, deleteJointPhoto,
  };
}