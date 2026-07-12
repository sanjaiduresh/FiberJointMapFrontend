import { useState } from 'react';
import type { CreateSegmentPayload, FiberJoint, Wire } from '../types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link, Loader2, AlertCircle, MapIcon, AlertTriangle, Type, CornerUpRight, Check, ChevronsUpDown, Cable, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AddConnectionModalProps {
  joints: FiberJoint[];
  wires: Wire[];
  isEditing?: boolean;
  onSubmit: (payload: CreateSegmentPayload) => Promise<void>;
  onClose: () => void;
  onPickWaypoints: (state: { fromJointId: string; toJointId: string; cableType: 'Single Mode' | 'Multi Mode'; fiberCount: number; extraLengthMeters: string; wireId: string }) => void;
  pendingWaypoints: Array<{ lat: number; lng: number }>;
  waypointsDone: boolean;
  onResetWaypointsDone: () => void;
  pendingConnection?: { fromJointId: string; toJointId: string; cableType: 'Single Mode' | 'Multi Mode'; fiberCount: number; extraLengthMeters: string; wireId?: string } | null;
  onManageWires: () => void;
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
  joints, wires, isEditing, onSubmit, onClose,
  onPickWaypoints, pendingWaypoints, onResetWaypointsDone, pendingConnection,
  onManageWires,
}: AddConnectionModalProps) {
  const [fromJointId, setFromJointId] = useState(pendingConnection?.fromJointId || (joints.length > 0 ? joints[0].id : ''));
  const [toJointId, setToJointId] = useState(pendingConnection?.toJointId || (joints.length > 1 ? joints[1].id : ''));
  const [cableType, setCableType] = useState<'Single Mode' | 'Multi Mode'>(pendingConnection?.cableType || 'Single Mode');
  const [fiberCount, setFiberCount] = useState(pendingConnection?.fiberCount || 12);
  const [extraLengthMeters, setExtraLengthMeters] = useState<string>(pendingConnection?.extraLengthMeters || '');
  const [wireId, setWireId] = useState<string>(pendingConnection?.wireId || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [routeType, setRouteType] = useState<'direct' | 'custom'>(pendingWaypoints.length > 0 ? 'custom' : 'direct');
  
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

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
      const extraMeters = parseFloat(extraLengthMeters);
      await onSubmit({
        fromJointId, toJointId, waypoints: routeType === 'direct' ? [] : pendingWaypoints, cableType, fiberCount,
        extraLengthMeters: extraMeters > 0 ? extraMeters : undefined,
        wireId: wireId && wireId !== 'none' ? wireId : undefined,
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
    onPickWaypoints({ fromJointId, toJointId, cableType, fiberCount, extraLengthMeters, wireId });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={`size-10 rounded-lg ${isEditing ? 'bg-blue-500/15' : 'bg-purple-500/15'} flex items-center justify-center shrink-0`}>
              <Link className={`size-5 ${isEditing ? 'text-blue-600' : 'text-purple-600'}`} />
            </div>
            <div>
              <DialogTitle>{isEditing ? 'Edit Connection' : 'Add Connection'}</DialogTitle>
              <DialogDescription>{isEditing ? 'Recreate the connection with updated settings' : 'Connect two fiber joints with route'}</DialogDescription>
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
                <Popover open={fromOpen} onOpenChange={setFromOpen}>
                  <PopoverTrigger render={
                    <Button
                      id="conn-from"
                      variant="outline"
                      role="combobox"
                      aria-expanded={fromOpen}
                      className="justify-between font-normal"
                    >
                      {fromJoint ? (
                        <span className="truncate">
                          {fromJoint.label} ({fromJoint.cableType}, {fromJoint.fiberCount} fibers)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Select from joint...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  } />
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search joint..." />
                      <CommandList>
                        <CommandEmpty>No joint found.</CommandEmpty>
                        <CommandGroup>
                          {joints.map((j) => (
                            <CommandItem
                              key={j.id}
                              value={`${j.label} ${j.id}`}
                              onSelect={() => {
                                setFromJointId(j.id);
                                setFromOpen(false);
                              }}
                            >
                              <span className="truncate flex-1">{j.label} ({j.cableType}, {j.fiberCount} fibers)</span>
                              <Check
                                className={cn(
                                  "ml-2 h-4 w-4 shrink-0",
                                  fromJointId === j.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* To Joint */}
              <div className="grid gap-1.5">
                <Label htmlFor="conn-to">To Joint <span className="text-destructive">*</span></Label>
                <Popover open={toOpen} onOpenChange={setToOpen}>
                  <PopoverTrigger render={
                    <Button
                      id="conn-to"
                      variant="outline"
                      role="combobox"
                      aria-expanded={toOpen}
                      className="justify-between font-normal"
                    >
                      {toJoint ? (
                        <span className="truncate">
                          {toJoint.label} ({toJoint.cableType}, {toJoint.fiberCount} fibers)
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Select to joint...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  } />
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search joint..." />
                      <CommandList>
                        <CommandEmpty>No joint found.</CommandEmpty>
                        <CommandGroup>
                          {joints.map((j) => (
                            <CommandItem
                              key={j.id}
                              value={`${j.label} ${j.id}`}
                              onSelect={() => {
                                setToJointId(j.id);
                                setToOpen(false);
                              }}
                            >
                              <span className="truncate flex-1">{j.label} ({j.cableType}, {j.fiberCount} fibers)</span>
                              <Check
                                className={cn(
                                  "ml-2 h-4 w-4 shrink-0",
                                  toJointId === j.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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

              {/* Wire Selection */}
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="conn-wire">Wire Type</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={onManageWires}
                    className="text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-5 px-1.5 gap-1"
                  >
                    <Settings2 className="size-3" />
                    Manage
                  </Button>
                </div>
                {wires.length === 0 ? (
                  <div className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2.5 flex items-center gap-2">
                    <Cable className="size-3.5 shrink-0" />
                    <span>No wires created yet.</span>
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      onClick={onManageWires}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 h-auto p-0 underline"
                    >
                      Create one
                    </Button>
                  </div>
                ) : (
                  <Select value={wireId} onValueChange={(v) => setWireId(v || '')}>
                    <SelectTrigger id="conn-wire">
                      <SelectValue placeholder="Select wire (optional)">
                        {wireId && wireId !== 'none' ? (
                          <span className="flex items-center gap-2">
                            <span
                              className="size-3 rounded-full shrink-0 ring-1 ring-black/10"
                              style={{ backgroundColor: wires.find(w => w.id === wireId)?.color || '#888' }}
                            />
                            {wires.find(w => w.id === wireId)?.name || 'Unknown'}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span className="size-3 rounded-full shrink-0 bg-blue-500 ring-1 ring-black/10" />
                            No wire (default blue)
                          </span>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="flex items-center gap-2">
                          <span className="size-3 rounded-full shrink-0 bg-blue-500 ring-1 ring-black/10" />
                          No wire (default blue)
                        </span>
                      </SelectItem>
                      {wires.map((w) => (
                        <SelectItem key={w.id} value={w.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="size-3 rounded-full shrink-0 ring-1 ring-black/10"
                              style={{ backgroundColor: w.color }}
                            />
                            {w.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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

              {/* Lengths */}
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label>Auto-calculated Route Length</Label>
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
              {submitting ? <><Loader2 className="size-4 animate-spin" />{isEditing ? 'Saving...' : 'Connecting...'}</> : isEditing ? 'Save Changes' : 'Create Connection'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
