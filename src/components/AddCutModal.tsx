// import { useState } from 'react';
// import type { CreateCutPayload, Segment, FiberJoint } from '../types';
// import {
//   Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
// } from '@/components/ui/dialog';
// import { Label } from '@/components/ui/label';
// import { Button } from '@/components/ui/button';
// import { Textarea } from '@/components/ui/textarea';
// import { AlertTriangle, Loader2, AlertCircle } from 'lucide-react';

// interface AddCutModalProps {
//   lat: number;
//   lng: number;
//   segments: Segment[];
//   joints: FiberJoint[];
//   onSubmit: (payload: CreateCutPayload) => Promise<void>;
//   onClose: () => void;
// }

// export default function AddCutModal({ lat, lng, segments, joints, onSubmit, onClose }: AddCutModalProps) {
//   const [severity, setSeverity] = useState<'Low' | 'Medium' | 'High' | 'Critical'>('Medium');
//   const [description, setDescription] = useState('');
//   const [segmentId, setSegmentId] = useState(segments.length > 0 ? segments[0].id : '');
//   const [submitting, setSubmitting] = useState(false);
//   const [error, setError] = useState('');

//   const getJointLabel = (jointId: string) =>
//     joints.find((j) => j.id === jointId)?.label || 'Unknown';

//   const getSegmentLabel = (segment: Segment) =>
//     `${getJointLabel(segment.fromJointId)} → ${getJointLabel(segment.toJointId)} (${segment.cableType}, ${segment.fiberCount} fibers)`;

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!segmentId) { setError('Please select a segment'); return; }
//     setSubmitting(true);
//     setError('');
//     try {
//       await onSubmit({ lat, lng, severity, description: description.trim(), segmentId });
//       onClose();
//     } catch {
//       setError('Failed to mark cut');
//     } finally {
//       setSubmitting(false);
//     }
//   };

//   return (
//     <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
//       <DialogContent className="sm:max-w-md max-h-[90dvh] overflow-y-auto">
//         <DialogHeader>
//           <div className="flex items-center gap-3">
//             <div className="size-10 rounded-lg bg-destructive/20 flex items-center justify-center shrink-0">
//               <AlertTriangle className="size-5 text-destructive" />
//             </div>
//             <div>
//               <DialogTitle>Mark Cable Cut</DialogTitle>
//               <DialogDescription>Report a fiber fault</DialogDescription>
//             </div>
//           </div>
//         </DialogHeader>

//         <form onSubmit={handleSubmit} className="grid gap-4">
//           {/* Coordinates */}
//           <div className="grid grid-cols-2 gap-3">
//             <div className="grid gap-1.5">
//               <Label>Latitude</Label>
//               <div className="h-8 px-2.5 flex items-center bg-muted border border-input rounded-lg text-sm text-muted-foreground font-mono">
//                 {lat.toFixed(6)}
//               </div>
//             </div>
//             <div className="grid gap-1.5">
//               <Label>Longitude</Label>
//               <div className="h-8 px-2.5 flex items-center bg-muted border border-input rounded-lg text-sm text-muted-foreground font-mono">
//                 {lng.toFixed(6)}
//               </div>
//             </div>
//           </div>

//           {/* Segment selector */}
//           <div className="grid gap-1.5">
//             <Label htmlFor="cut-segment">Affected Segment <span className="text-destructive">*</span></Label>
//             {segments.length === 0 ? (
//               <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
//                 No segments exist yet. Create a connection between two joints first.
//               </p>
//             ) : (
//               <select
//                 id="cut-segment"
//                 value={segmentId}
//                 onChange={(e) => setSegmentId(e.target.value)}
//                 className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
//               >
//                 {segments.map((seg) => (
//                   <option key={seg.id} value={seg.id}>
//                     {getSegmentLabel(seg)}
//                   </option>
//                 ))}
//               </select>
//             )}
//           </div>

//           {/* Severity */}
//           <div className="grid gap-1.5">
//             <Label htmlFor="cut-severity">Severity <span className="text-destructive">*</span></Label>
//             <select
//               id="cut-severity"
//               value={severity}
//               onChange={(e) => setSeverity(e.target.value as typeof severity)}
//               className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
//             >
//               <option value="Low">🟡 Low</option>
//               <option value="Medium">🟠 Medium</option>
//               <option value="High">🔴 High</option>
//               <option value="Critical">🚨 Critical</option>
//             </select>
//           </div>

//           {/* Description */}
//           <div className="grid gap-1.5">
//             <Label htmlFor="cut-description">Description</Label>
//             <Textarea
//               id="cut-description"
//               value={description}
//               onChange={(e) => setDescription(e.target.value)}
//               placeholder="Describe the cut/fault..."
//               rows={3}
//             />
//           </div>

//           {error && (
//             <div className="flex items-center gap-2 text-destructive text-sm bg-destructive/10 rounded-lg px-3 py-2">
//               <AlertCircle className="size-4 shrink-0" />
//               {error}
//             </div>
//           )}

//           <div className="flex gap-3 pt-1">
//             <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
//               Cancel
//             </Button>
//             <Button type="submit" variant="destructive" disabled={submitting || segments.length === 0} className="flex-1">
//               {submitting ? <><Loader2 className="size-4 animate-spin" />Saving...</> : 'Mark Cut'}
//             </Button>
//           </div>
//         </form>
//       </DialogContent>
//     </Dialog>
//   );
// }
