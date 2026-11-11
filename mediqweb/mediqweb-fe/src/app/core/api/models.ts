export type UserRole = 'patient' | 'doctor' | 'secretary' | 'admin';

export interface UserProfile {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  mobileNumber: string;
  dateOfBirth: string;
  role: UserRole;
  status: string;
  assignedDoctorId?: string;
  joinedOn?: string;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
  refreshExpiresAt: string;
  profile: UserProfile;
}

export interface Doctor {
  id: string;
  userId: string;
  fullName: string;
  specialty: string;
  specializationId: string;
  licenseNumber: string;
  yearsOfExperience: number;
  feeCentavos: number;
  bio: string;
  building: string;
  floor: string;
  room: string;
  languages: string;
  status: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  startsAt: string;
  durationMinutes: number;
  status: string;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageThread {
  id: string;
  patientId: string;
  doctorId: string;
  subject: string;
  lastMessageAt: string;
  unreadCount: number;
  awaitingAction: boolean;
}

/** One message in a conversation, as returned by the Ktor API. */
export interface Message {
  id: string;
  conversationId: string;
  authorId: string;
  authorRole: string;
  body: string;
  sentAt: string;
  readAt?: string | null;
}

export interface Specialization {
  id: string;
  name: string;
  description?: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  title: string;
  description?: string;
  createdAt: string;
}

export interface Prescription {
  id: string;
  appointmentId: string;
  medicine: string;
  dosage: string;
  frequency: string;
  prescribedAt: string;
}

export interface Invoice {
  id: string;
  patientId: string;
  amount: number;
  status: string;
  dueDate: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface PaymentRequest {
  invoiceId: string;
  amount: number;
  method: string;
}

export interface CreateAppointmentRequest {
  doctorId: string;
  startsAt: string;
  durationMinutes: number;
  reason: string;
}

export interface AppointmentFilter {
  doctorId?: string;
  status?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
