// === Joint Types ===
export interface FiberJoint {
  id: string;
  label: string;
  notes: string;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  lat: number;
  lng: number;
  createdBy: { userId: string; userName: string };
  createdAt: string;
}

export interface CreateJointPayload {
  label: string;
  notes: string;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  lat: number;
  lng: number;
}

// === Cut Types ===
export interface Cut {
  id: string;
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

export interface CreateCutPayload {
  lat: number;
  lng: number;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  segmentId: string;
}

// === Segment Types ===
export interface Segment {
  id: string;
  fromJointId: string;
  toJointId: string;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  lengthMeters: number;
  createdBy: { userId: string; userName: string };
  createdAt: string;
}

export interface CreateSegmentPayload {
  fromJointId: string;
  toJointId: string;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
}

// === Auth Types ===
export interface AuthUser {
  id: string;
  email: string;
  name: string;
}
