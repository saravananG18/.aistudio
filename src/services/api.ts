import { 
  User, 
  StudentQRIdentity, 
  Trip, 
  Booking, 
  BoardingVerificationResult, 
  EmailLog, 
  SystemSettings,
  BusIdentificationMap,
  Bus,
  Route,
  DriverAvailability
} from '../types/index.ts';

export const API_BASE = (import.meta.env.VITE_API_BASE_URL?.trim() || '/api').replace(/\/+$/, '');

class ApiService {
  private getHeaders(): HeadersInit {
    const token = localStorage.getItem('cit_booker_token') || '';
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
  }

  // Auth
  async getDemoUsers(): Promise<{ users: User[]; active_qrs: StudentQRIdentity[] }> {
    const res = await fetch(`${API_BASE}/auth/demo-users`);
    if (!res.ok) throw new Error('Failed to load demo users');
    return res.json();
  }

  async getMe(): Promise<{ user: User; qr_identity: StudentQRIdentity | null }> {
    const res = await fetch(`${API_BASE}/auth/me`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to get session');
    return res.json();
  }

  async registerStudent(data: { name: string; email: string; student_id_number?: string; phone?: string }): Promise<{ user: User; qr_identity: StudentQRIdentity; token: string }> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Registration failed');
    return json;
  }

  async login(email: string, role?: string): Promise<{ user: User; qr_identity: StudentQRIdentity | null; token: string }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Login failed');
    return json;
  }

  async verifyEmail(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/auth/verify-email`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return res.json();
  }

  // Trips
  async getTrips(filters?: { date?: string; status?: string; driver_id?: string }): Promise<{ trips: Trip[] }> {
    const params = new URLSearchParams();
    if (filters?.date) params.append('date', filters.date);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.driver_id) params.append('driver_id', filters.driver_id);

    const res = await fetch(`${API_BASE}/trips?${params.toString()}`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load trips');
    return res.json();
  }

  async getTripDetails(id: string): Promise<{ trip: Trip & { seat_map: Array<{ seat_id: string; row: number; column: string; is_booked: boolean }> } }> {
    const res = await fetch(`${API_BASE}/trips/${id}`, { headers: this.getHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load trip');
    return json;
  }

  async updateTripStatus(id: string, data: { status?: string; parking_bay?: string }): Promise<{ trip: Trip }> {
    const res = await fetch(`${API_BASE}/trips/${id}/status`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update trip');
    return json;
  }

  async setTripBookingWindow(id: string, action: 'OPEN' | 'CLOSE'): Promise<{ success: boolean; trip: Trip; message: string }> {
    const res = await fetch(`${API_BASE}/trips/${id}/booking-window`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ action })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update booking window');
    return json;
  }

  async assignTripDriver(tripId: string, driver_id: string): Promise<{ success: boolean; trip: Trip; driver: User; message: string }> {
    const res = await fetch(`${API_BASE}/trips/${tripId}/assign-driver`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ driver_id })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to assign driver');
    return json;
  }

  async getDriverAvailability(date?: string): Promise<{ drivers: DriverAvailability[] }> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    const res = await fetch(`${API_BASE}/admin/drivers/availability?${params.toString()}`, {
      headers: this.getHeaders()
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load driver availability');
    return json;
  }

  // Bookings
  async createBooking(trip_id: string, seat_id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ trip_id, seat_id })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Booking failed');
    return json;
  }

  async getMyBookings(): Promise<{ bookings: Booking[] }> {
    const res = await fetch(`${API_BASE}/bookings/my`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load bookings');
    return res.json();
  }

  async cancelBooking(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/bookings/${id}/cancel`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Cancellation failed');
    return json;
  }

  // Student QR Identity
  async getStudentQR(): Promise<{ qr_identity: StudentQRIdentity; user: User }> {
    const res = await fetch(`${API_BASE}/student/qr`, { headers: this.getHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to fetch QR');
    return json;
  }

  // Boarding Verification
  async verifyBoarding(payload: { trip_id: string; qr_identifier?: string; booking_reference?: string; method?: 'QR' | 'MANUAL' }): Promise<BoardingVerificationResult> {
    const res = await fetch(`${API_BASE}/boarding/verify`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async getTripManifest(tripId: string): Promise<{
    trip: Trip;
    total_passengers: number;
    boarded_passengers: number;
    remaining_passengers: number;
    manifest: Array<{
      booking_id: string;
      booking_reference: string;
      seat_id: string;
      student_name: string;
      student_email?: string;
      student_id_number?: string;
      boarding_status: string;
      boarded_at: string | null;
      method: string | null;
    }>;
  }> {
    const res = await fetch(`${API_BASE}/trips/${tripId}/manifest`, { headers: this.getHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to load manifest');
    return json;
  }

  async sendTripReminders(tripId: string, custom_note?: string): Promise<{
    success: boolean;
    count: number;
    reminders_sent: Array<any>;
    message: string;
  }> {
    const res = await fetch(`${API_BASE}/trips/${tripId}/send-reminders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ custom_note })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to dispatch reminders');
    return json;
  }

  // Admin Tools
  async revokeStudentQR(student_id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/student-qr/revoke`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ student_id })
    });
    return res.json();
  }

  async regenerateStudentQR(student_id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/student-qr/regenerate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ student_id })
    });
    return res.json();
  }

  async getEmailLogs(): Promise<{ logs: EmailLog[] }> {
    const res = await fetch(`${API_BASE}/email-logs`, { headers: this.getHeaders() });
    return res.json();
  }

  async retryEmail(id: string): Promise<any> {
    const res = await fetch(`${API_BASE}/email-logs/${id}/retry`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return res.json();
  }

  async getSettings(): Promise<{ settings: SystemSettings }> {
    const res = await fetch(`${API_BASE}/settings`, { headers: this.getHeaders() });
    return res.json();
  }

  async updateSettings(data: Partial<SystemSettings>): Promise<{ settings: SystemSettings }> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return res.json();
  }

  async resetDemoData(): Promise<any> {
    const res = await fetch(`${API_BASE}/admin/reset-demo`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    return res.json();
  }

  async openAllTrips(): Promise<{ success: boolean; count: number; message: string }> {
    const res = await fetch(`${API_BASE}/admin/trips/open-all`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to open all bus bookings');
    return json;
  }

  async closeAllTrips(): Promise<{ success: boolean; count: number; message: string }> {
    const res = await fetch(`${API_BASE}/admin/trips/close-all`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to close all bus bookings');
    return json;
  }

  async clearAllBookings(): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/admin/bookings/clear-all`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to clear previous bookings');
    return json;
  }

  // Daily Bus Identification Map
  async getBusMap(): Promise<{ bus_map: BusIdentificationMap }> {
    const res = await fetch(`${API_BASE}/bus-map`);
    if (!res.ok) throw new Error('Failed to load bus identification map');
    return res.json();
  }

  async updateBusMap(data: Partial<BusIdentificationMap>): Promise<{ success: boolean; bus_map: BusIdentificationMap }> {
    const res = await fetch(`${API_BASE}/bus-map`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to update bus identification map');
    return json;
  }

  async resetBusMap(): Promise<{ success: boolean; bus_map: BusIdentificationMap }> {
    const res = await fetch(`${API_BASE}/bus-map/reset`, {
      method: 'POST',
      headers: this.getHeaders()
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to reset bus identification map');
    return json;
  }

  // Bus Fleet
  async getBuses(): Promise<{ buses: Bus[] }> {
    const res = await fetch(`${API_BASE}/buses`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load buses');
    return res.json();
  }

  async createBus(data: {
    bus_number: string;
    bus_name?: string;
    capacity?: number;
    route_id?: string;
    new_route_name?: string;
    new_route_stops?: string | string[];
    departure_time?: string;
    parking_bay?: string;
    assigned_driver_id?: string;
  }): Promise<{ success: boolean; bus: Bus; route?: Route; trip?: Trip; message?: string }> {
    const res = await fetch(`${API_BASE}/buses`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to add bus');
    return json;
  }

  // Driver Reminders to Unboarded Passengers
  async sendBoardingReminders(tripId: string, custom_message?: string): Promise<{ success: boolean; sent_count: number; message: string; recipients: Array<any> }> {
    const res = await fetch(`${API_BASE}/trips/${tripId}/send-reminders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ custom_message })
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Failed to dispatch reminders');
    return json;
  }

  // Admin Booking Control: Open / Close Bus Bookings (Alias)
  async setBookingWindow(tripId: string, action: 'OPEN' | 'CLOSE' | 'TOGGLE'): Promise<{ success: boolean; trip: Trip; message: string }> {
    return this.setTripBookingWindow(tripId, action as any);
  }

  // Admin Driver Assignment (Alias)
  async assignDriver(tripId: string, driver_id: string): Promise<{ success: boolean; trip: Trip; driver: User; message: string }> {
    return this.assignTripDriver(tripId, driver_id);
  }
}

export const api = new ApiService();
