// === Approval Status ===
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PENDING_EDIT' | 'PENDING_DELETE';

// === Role Types ===
export type UserRole = 'ADMIN' | 'OWNER' | 'EMPLOYEE';

// === Joint Types ===
export type JointType = 'Base' | 'Main' | 'Sub' | 'Splice';

export interface JointPhoto {
  url: string;
  publicId: string;
  uploadedAt: string;
}

export interface FiberJoint {
  id: string;
  label: string;
  notes: string;
  jointType: JointType;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  icon?: string;
  lat: number;
  lng: number;
  organizationId: string;
  createdBy: { userId: string; userName: string };
  approvalStatus: ApprovalStatus;
  pendingEdits?: Partial<FiberJoint>;
  photos: JointPhoto[];
  createdAt: string;
}

export interface CreateJointPayload {
  label: string;
  notes: string;
  jointType: JointType;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  icon?: string;
  lat: number;
  lng: number;
  pendingPhotos?: File[];
}

// === Segment Types ===
export interface Segment {
  id: string;
  fromJointId: string;
  toJointId: string;
  waypoints: Array<{ lat: number; lng: number }>;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  lengthMeters: number;
  extraLengthMeters?: number;
  organizationId: string;
  createdBy: { userId: string; userName: string };
  approvalStatus: ApprovalStatus;
  pendingEdits?: Partial<Segment>;
  createdAt: string;
}

export interface CreateSegmentPayload {
  fromJointId: string;
  toJointId: string;
  waypoints: Array<{ lat: number; lng: number }>;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  lengthMeters?: number;
  extraLengthMeters?: number;
}

export interface SpliceJointPayload {
  segmentId: string;
  label: string;
  notes: string;
  jointType: JointType;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  lat: number;
  lng: number;
  pendingPhotos?: File[];
}

// === Auth Types ===
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  role: UserRole;
  organizationName: string;
}

// === Team Member Types ===
export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}