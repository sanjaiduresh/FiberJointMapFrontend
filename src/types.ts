export interface FiberJoint {
  id: string;
  label: string;
  notes: string;
  lat: number;
  lng: number;
  createdAt: string;
}

export interface CreateJointPayload {
  label: string;
  notes: string;
  lat: number;
  lng: number;
}
