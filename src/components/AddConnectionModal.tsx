import { useState } from 'react';
import type { CreateSegmentPayload, FiberJoint } from '../types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, Loader2, AlertCircle, MapIcon, AlertTriangle, Ruler, Type, CornerUpRight } from 'lucide-react';

interface AddConnectionModalProps {
  joints: FiberJoint[];
  onSubmit: (payload: CreateSegmentPayload) => Promise<void>;
  onClose: () => void;
  onPickWaypoints: (state: { fromJointId: string; toJointId: string; cableType: 'Single Mode' | 'Multi Mode'; fiberCount: number; lengthMeters: string }) => void;
  pendingWaypoints: Array<{ lat: number; lng: number }>;
  waypointsDone: boolean;
  onResetWaypointsDone: () => void;
  pendingConnection?: { fromJointId: string; toJointId: string; cableType: 'Single Mode' | 'Multi Mode'; fiberCount: number; lengthMeters: string } | null;
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcRouteDistance(
  fromJoint: FiberJoint | undefined,
  toJoint: FiberJoint | undefined,
  waypoints: Array<{ lat: number; lng: number }>,
): number {
  if (!fromJoint || !toJoint) return 0;
  const points = [{ lat: fromJoint.lat, lng: fromJoint.lng }, ...waypoints, { lat: toJoint.lat, lng: toJoint.lng }];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += haversineMeters(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng);
  }
  return Math.round(total * 100) / 100;
}

export default function AddConnectionModal({
  joints, onSubmit, onClose,
  onPickWaypoints, pendingWaypoints, waypointsDone: _waypointsDone, onResetWaypointsDone, pendingConnection,
}: AddConnectionModalProps) {
  const [fromJointId, setFromJointId] = useState(pendingConnection?.fromJointId || (joints.length > 0 ? joints[0].id : ''));
  const [toJointId, setToJointId] = useState(pendingConnection?.toJointId || (joints.length > 1 ? joints[1].id : ''));
  const [cableType, setCableType] = useState<'Single Mode' | 'Multi Mode'>(pendingConnection?.cableType || 'Single Mode');
  const [fiberCount, setFiberCount] = useState(pendingConnection?.fiberCount || 12);
  const [lengthMeters, setLengthMeters] = useState<string>(pendingConnection?.lengthMeters || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [routeType, setRouteType] = useState<'direct' | 'custom'>(pendingWaypoints.length > 0 ? 'custom' : 'direct');

  const fromJoint = joints.find((j) => j.id === fromJointId);
  const toJoint = joints.find((j) => j.id === toJointId);
  const suggestedDistance = calcRouteDistance(fromJoint, toJoint, pendingWaypoints);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromJointId || !toJointId) { setError('Please select both joints'); return; }
    if (fromJointId === toJointId) { setError('Cannot connect a joint to itself'); return; }
    setSubmitting(true);
    setError('');
    try {
      const meters = parseFloat(lengthMeters);
      await onSubmit({
        fromJointId, toJointId, waypoints: routeType === 'direct' ? [] : pendingWaypoints, cableType, fiberCount,
        lengthMeters: meters > 0 ? meters : undefined,
      });
      onClose();
    } catch {
      setError('Failed to create connection');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickRoute = () => {
    if (!fromJointId || !toJointId) { setError('Please select both joints first'); return; }
    if (fromJointId === toJointId) { setError('Cannot connect a joint to itself'); return; }
    onResetWaypointsDone();
    onPickWaypoints({ fromJointId, toJointId, cableType, fiberCount, lengthMeters });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
              <Link className="size-5 text-purple-600" />
            </div>
            <div>
              <DialogTitle>Add Connection</DialogTitle>
              <DialogDescription>Connect two fiber joints with route</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {joints.length < 2 ? (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 flex gap-2 items-start">
              <AlertTriangle className="size-4 shrink-0 text-amber-600" />
              <p>You need at least 2 joints to create a connection. Add joints to the map first.</p>
            </div>
          ) : (
            <>
              {/* From Joint */}
              <div className="grid gap-1.5">
                <Label htmlFor="conn-from">From Joint <span className="text-destructive">*</span></Label>
                <Select value={fromJointId} onValueChange={(v) => setFromJointId(v || '')}>
                  <SelectTrigger id="conn-from">
                    {fromJoint ? (
                      <span className="flex-1 text-left truncate">
                        {fromJoint.label} ({fromJoint.cableType}, {fromJoint.fiberCount} fibers)
                      </span>
                    ) : (
                      <SelectValue placeholder="Select from joint" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {joints.map((j) => (
                      <SelectItem key={j.id} value={j.id} label={j.label}>
                        {j.label} ({j.cableType}, {j.fiberCount} fibers)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* To Joint */}
              <div className="grid gap-1.5">
                <Label htmlFor="conn-to">To Joint <span className="text-destructive">*</span></Label>
                <Select value={toJointId} onValueChange={(v) => setToJointId(v || '')}>
                  <SelectTrigger id="conn-to">
                    {toJoint ? (
                      <span className="flex-1 text-left truncate">
                        {toJoint.label} ({toJoint.cableType}, {toJoint.fiberCount} fibers)
                      </span>
                    ) : (
                      <SelectValue placeholder="Select to joint" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {joints.map((j) => (
                      <SelectItem key={j.id} value={j.id} label={j.label}>
                        {j.label} ({j.cableType}, {j.fiberCount} fibers)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Cable Type + Fiber Count */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="conn-cable">Cable Type</Label>
                  <Select value={cableType} onValueChange={(v) => setCableType(v as 'Single Mode' | 'Multi Mode')}>
                    <SelectTrigger id="conn-cable">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Single Mode">Single Mode</SelectItem>
                      <SelectItem value="Multi Mode">Multi Mode</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="conn-fibers">Fiber Count</Label>
                  <Input
                    id="conn-fibers"
                    type="number"
                    min={1}
                    value={fiberCount}
                    onChange={(e) => setFiberCount(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              {/* Route Type */}
              <div className="grid gap-2">
                <Label>Route Type</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={routeType === 'direct' ? 'default' : 'outline'}
                    className="flex-1 h-12 flex flex-col justify-center items-center gap-1 bg-card hover:bg-muted"
                    onClick={() => setRouteType('direct')}
                    style={routeType === 'direct' ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } : {}}
                  >
                    <Type className="size-4" />
                    <span className="text-[10px] font-medium">Direct Line</span>
                  </Button>
                  <Button
                    type="button"
                    variant={routeType === 'custom' ? 'default' : 'outline'}
                    className="flex-1 h-12 flex flex-col justify-center items-center gap-1 bg-card hover:bg-muted"
                    onClick={() => setRouteType('custom')}
                    style={routeType === 'custom' ? { backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' } : {}}
                  >
                    <CornerUpRight className="size-4" />
                    <span className="text-[10px] font-medium">Custom Route</span>
                  </Button>
                </div>
              </div>

              {/* Pick Route on Map (Only if Custom Route) */}
              {routeType === 'custom' && (
                <div className="grid gap-1.5 p-3 rounded-lg border border-purple-200 bg-purple-50/50">
                  <Label className="text-purple-800">Custom Route (Turns/Waypoints)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePickRoute}
                    className="w-full justify-center gap-2 border-purple-300 text-purple-700 hover:bg-purple-100 hover:text-purple-800"
                  >
                    <MapIcon className="size-4" />
                    {pendingWaypoints.length > 0
                      ? `${pendingWaypoints.length} turn${pendingWaypoints.length > 1 ? 's' : ''} placed — Click to re-pick`
                      : 'Pick Route on Map'}
                  </Button>

                  {pendingWaypoints.length > 0 && (
                    <div className="mt-1 space-y-1 max-h-28 overflow-y-auto">
                      {pendingWaypoints.map((wp, i) => (
                        <div key={i} className="flex items-center gap-2 px-2 py-1 bg-muted rounded-lg">
                          <Badge variant="secondary" className="size-5 justify-center text-[10px] p-0 shrink-0">
                            {i + 1}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground font-mono flex-1">
                            {wp.lat.toFixed(6)}, {wp.lng.toFixed(6)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Length */}
              <div className="grid gap-1.5">
                <Label htmlFor="conn-length">Cable Length (meters)</Label>
                <Input
                  id="conn-length"
                  type="number"
                  min={0}
                  step="0.01"
                  value={lengthMeters}
                  onChange={(e) => setLengthMeters(e.target.value)}
                  placeholder={suggestedDistance > 0 ? `Auto: ~${suggestedDistance.toFixed(1)}m` : 'Enter cable length'}
                />
                {suggestedDistance > 0 && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Ruler className="size-3" /> Auto-calculated: ~{suggestedDistance.toFixed(1)}m
                    {!lengthMeters && ' (will be used if left empty)'}
                  </p>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || joints.length < 2} className="flex-1">
              {submitting ? <><Loader2 className="size-4 animate-spin" />Connecting...</> : 'Create Connection'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
