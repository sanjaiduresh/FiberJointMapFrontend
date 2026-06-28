import { useState, useEffect } from 'react';
import type { CreateSegmentPayload, Segment, FiberJoint } from '../types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, Loader2, AlertCircle, Edit3, MapIcon, Type, CornerUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface EditConnectionModalProps {
  segment: Segment;
  joints: FiberJoint[];
  onSubmit: (payload: Partial<CreateSegmentPayload>) => Promise<void>;
  onClose: () => void;
  onPickWaypoints: (waypoints: Array<{ lat: number; lng: number }>) => void;
  pendingWaypoints: Array<{ lat: number; lng: number }>;
  waypointsDone: boolean;
  onResetWaypointsDone: () => void;
}

export default function EditConnectionModal({
  segment, joints, onSubmit, onClose,
  onPickWaypoints, pendingWaypoints, waypointsDone, onResetWaypointsDone
}: EditConnectionModalProps) {
  const [cableType, setCableType] = useState<'Single Mode' | 'Multi Mode'>(segment.cableType);
  const [fiberCount, setFiberCount] = useState(segment.fiberCount);
  const [extraLengthMeters, setExtraLengthMeters] = useState<string>(segment.extraLengthMeters?.toString() || '0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const currentWaypoints = waypointsDone ? pendingWaypoints : segment.waypoints;
  const [routeType, setRouteType] = useState<'direct' | 'custom'>(currentWaypoints.length > 0 ? 'custom' : 'direct');

  const fromJoint = joints.find((j) => j.id === segment.fromJointId);
  const toJoint = joints.find((j) => j.id === segment.toJointId);
  
  const suggestedDistance = calcRouteDistance(
    fromJoint, toJoint, routeType === 'direct' ? [] : currentWaypoints
  );

  // If switched to direct, route is empty. If switched to custom and was direct, use currentWaypoints (could be empty or past)
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const extraMeters = parseFloat(extraLengthMeters);
      await onSubmit({
        cableType,
        fiberCount,
        extraLengthMeters: extraMeters >= 0 ? extraMeters : 0,
        waypoints: routeType === 'direct' ? [] : currentWaypoints,
      });
    } catch {
      setError('Failed to update connection');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePickRoute = () => {
    onResetWaypointsDone();
    onPickWaypoints(currentWaypoints);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
              <Edit3 className="size-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle>Edit Connection</DialogTitle>
              <DialogDescription>Update cable type, fibers, or redraw route</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4">
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
                {currentWaypoints.length > 0
                  ? `${currentWaypoints.length} turn${currentWaypoints.length > 1 ? 's' : ''} placed — Click to redraw`
                  : 'Pick Route on Map'}
              </Button>

              {currentWaypoints.length > 0 && (
                <div className="mt-1 space-y-1 max-h-28 overflow-y-auto">
                  {currentWaypoints.map((wp, i) => (
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

          {/* Lengths */}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Auto-calculated Route</Label>
              <div className="h-9 px-3 flex items-center border border-input rounded-md bg-muted text-sm text-muted-foreground">
                ~{suggestedDistance > 0 ? suggestedDistance.toFixed(1) : '0.0'} m
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="conn-extra-length">Extra Wire Length (m)</Label>
              <Input
                id="conn-extra-length"
                type="number"
                min={0}
                step="0.1"
                value={extraLengthMeters}
                onChange={(e) => setExtraLengthMeters(e.target.value)}
                placeholder="e.g. 5.5"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" className="flex-1 cursor-pointer" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1 bg-blue-600 hover:bg-blue-700 cursor-pointer">
              {submitting ? <><Loader2 className="size-4 animate-spin mr-1" />Saving...</> : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
