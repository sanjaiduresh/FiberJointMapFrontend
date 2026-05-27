// === Approval Status ===
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// === Role Types ===
export type UserRole = 'ADMIN' | 'OWNER' | 'EMPLOYEE';

// === Joint Types ===
export type JointType = 'Base' | 'Main' | 'Sub' | 'Splice';

export interface FiberJoint {
  id: string;
  label: string;
  notes: string;
  jointType: JointType;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  lat: number;
  lng: number;
  createdBy: { userId: string; userName: string };
  approvalStatus: ApprovalStatus;
  createdAt: string;
}

export interface CreateJointPayload {
  label: string;
  notes: string;
  jointType: JointType;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  lat: number;
  lng: number;
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
  createdBy: { userId: string; userName: string };
  approvalStatus: ApprovalStatus;
  createdAt: string;
}

export interface CreateSegmentPayload {
  fromJointId: string;
  toJointId: string;
  waypoints: Array<{ lat: number; lng: number }>;
  cableType: 'Single Mode' | 'Multi Mode';
  fiberCount: number;
  lengthMeters?: number;
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