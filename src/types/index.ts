export type UserRole = 'student' | 'driver' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  is_verified: boolean;
  student_id_number?: string;
  phone?: string;
  created_at: string;
}

export interface StudentQRIdentity {
  id: string;
  user_id: string;
  opaque_qr_identifier: string;
  status: 'ACTIVE' | 'REVOKED';
  created_at: string;
  revoked_at: string | null;
  regenerated_at: string | null;
}

export interface BoardingStop {
  stop_name: string;
  time?: string;
}

export interface Bus {
  id: string;
  bus_number: string;
  route_number?: number;
  bus_name: string;
  capacity: number;
  layout: '2x2';
  is_active: boolean;
  route_id?: string;
  route?: Route;
  active_trip?: Trip;
  booked_seats_count?: number;
  boarded_seats_count?: number;
  pending_boarding_count?: number;
  passengers?: Array<{
    booking_id: string;
    student_id: string;
    student_name: string;
    student_email: string;
    student_roll: string;
    seat_id: string;
    boarding_status: BoardingStatus;
    boarded_at?: string;
  }>;
}

export interface Route {
  id: string;
  route_number?: number;
  name: string;
  ordered_stops: string[];
  stop_details?: BoardingStop[];
}

export type TripStatus = 'NOT YET OPEN' | 'OPEN' | 'FULL' | 'CLOSED' | 'DEPARTED' | 'COMPLETED';

export interface Trip {
  id: string;
  bus_id: string;
  route_id: string;
  assigned_driver_id: string;
  travel_date: string; // YYYY-MM-DD
  departure_time: string; // e.g. "03:30 PM" or "04:30 PM"
  departure_time_iso: string;
  booking_window_opens_at: string; // ISO
  booking_window_closes_at: string; // ISO
  status: TripStatus;
  parking_bay: string;
  notes?: string;
  
  // Expanded joins for display
  bus?: Bus;
  route?: Route;
  driver?: User;
  total_seats?: number;
  booked_seats_count?: number;
  boarded_seats_count?: number;
  pending_boarding_count?: number;
  remaining_seats_count?: number;
  passengers?: Array<{
    booking_id: string;
    student_id: string;
    student_name: string;
    student_email: string;
    student_roll: string;
    seat_id: string;
    boarding_status: BoardingStatus;
    boarded_at?: string;
  }>;
}

export type BookingStatus = 'CONFIRMED' | 'CANCELLED';
export type BoardingStatus = 'NOT BOARDED' | 'BOARDED';

export interface Booking {
  id: string;
  booking_reference: string;
  student_id: string;
  trip_id: string;
  seat_id: string;
  booking_status: BookingStatus;
  boarding_status: BoardingStatus;
  created_at: string;
  cancelled_at: string | null;

  // Joined fields
  student?: User;
  trip?: Trip;
  boarding_event?: BoardingEvent | null;
}

export interface DriverAvailability {
  driver: User;
  is_assigned_today: boolean;
  assigned_bus_number?: string;
  assigned_bus_name?: string;
  assigned_trip_id?: string;
  assigned_departure_time?: string;
}

export interface BoardingEvent {
  id: string;
  booking_id: string;
  student_id: string;
  trip_id: string;
  scanned_by_driver_id: string;
  boarded_at: string;
  method: 'QR' | 'MANUAL';
  
  // Joined fields
  student?: User;
  booking?: Booking;
  scanned_by_driver_name?: string;
}

export interface EmailLog {
  id: string;
  booking_id: string;
  recipient_email: string;
  recipient_name: string;
  subject: string;
  body_preview: string;
  status: 'SENT' | 'FAILED';
  sent_at: string;
  error_message: string | null;
}

export interface SystemSettings {
  restrict_email_domain: boolean;
  allowed_domain: string;
  demo_mode: boolean;
}

export interface BoardingVerificationResult {
  success: boolean;
  code: 
    | 'VERIFIED'
    | 'ALREADY_BOARDED'
    | 'NO_BOOKING'
    | 'BOOKING_CANCELLED'
    | 'WRONG_TRIP'
    | 'QR_REVOKED_OR_INVALID'
    | 'DRIVER_UNAUTHORIZED'
    | 'SERVER_ERROR';
  message: string;
  passenger?: {
    student_name: string;
    student_email?: string;
    student_id_number?: string;
    booking_reference: string;
    seat_id: string;
    bus_number: string;
    route_name: string;
    departure_time: string;
    boarded_at: string;
    original_boarded_at?: string;
  };
}

export interface BusIdentificationMap {
  id: string;
  image_url: string;
  title: string;
  effective_date: string;
  updated_at: string;
  updated_by_name: string;
  updated_by_email: string;
  notes?: string;
  version: number;
}
