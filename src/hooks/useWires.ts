import { useState, useEffect, useCallback } from 'react';
import type { Wire, CreateWirePayload } from '../types';
import { API_BASE } from '../config';

const API_URL = `${API_BASE}/api/wires`;

interface RawWire {
  _id: string;
  name: string;
  color: string;
  organizationId: string;
  createdBy: { userId: string; userName: string };
  createdAt: string;
}

function mapWire(raw: RawWire): Wire {
  return {
    id: raw._id,
    name: raw.name,
    color: raw.color,
    organizationId: raw.organizationId,
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
  };
}

export function useWires(token: string | null) {
  const [wires, setWires] = useState<Wire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWires = useCallback(async (silent = false) => {
    if (!token) return;
    try {
      if (!silent) setLoading(true);
      const res = await fetch(API_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch wires');
      const data: RawWire[] = await res.json();
      setWires(data.map(mapWire));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [token]);

  const createWire = useCallback(async (payload: CreateWirePayload) => {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create wire');
    }
    const raw: RawWire = await res.json();
    const newWire = mapWire(raw);
    setWires((prev) => [newWire, ...prev]);
    return newWire;
  }, [token]);

  const updateWire = useCallback(async (id: string, payload: Partial<CreateWirePayload>) => {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to update wire');
    }
    const raw: RawWire = await res.json();
    const updated = mapWire(raw);
    setWires((prev) => prev.map((w) => (w.id === id ? updated : w)));
    return updated;
  }, [token]);

  const deleteWire = useCallback(async (id: string) => {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete wire');
    }
    setWires((prev) => prev.filter((w) => w.id !== id));
  }, [token]);

  useEffect(() => {
    fetchWires();
  }, [fetchWires]);

  return {
    wires, loading, error,
    createWire, updateWire, deleteWire,
    refetch: fetchWires,
  };
}
