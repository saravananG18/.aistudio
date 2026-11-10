import {
  User, StudentQRIdentity, Trip, Booking, BoardingVerificationResult, EmailLog,
  SystemSettings, BusIdentificationMap, Bus, Route, DriverAvailability
} from '../types/index.ts';
import { getSupabase } from './supabase.ts';
import { DEFAULT_BUS_MAP_IMAGE } from './assets.ts';

const client = () => getSupabase();
const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client().rpc(name, args);
  fail(error);
  return data as T;
}

function enrichTrip(trip: any, metrics?: any, driver?: any): Trip {
  const capacity = trip.bus?.capacity || 32;
  const booked = Number(metrics?.booked || 0);
  const boarded = Number(metrics?.boarded || 0);
  return {
    ...trip,
    driver: driver || undefined,
    total_seats: capacity,
    booked_seats_count: booked,
    boarded_seats_count: boarded,
    pending_boarding_count: Math.max(0, booked - boarded),
    remaining_seats_count: Math.max(0, capacity - booked),
    status: booked >= capacity && trip.status === 'OPEN' ? 'FULL' : trip.status
  } as Trip;
}

class ApiService {
  async getDemoUsers(): Promise<{ users: User[]; active_qrs: StudentQRIdentity[] }> {
    const [profiles, qrs] = await Promise.all([
      client().from('profiles').select('*').order('name'),
      client().from('student_qr_identities').select('*').eq('status', 'ACTIVE')
    ]);
    fail(profiles.error); fail(qrs.error);
    return { users: profiles.data as User[], active_qrs: qrs.data as StudentQRIdentity[] };
  }

  async getMe(): Promise<{ user: User; qr_identity: StudentQRIdentity | null }> {
    const auth = await client().auth.getUser();
    fail(auth.error);
    if (!auth.data.user) throw new Error('Please sign in.');
    const { data: user, error } = await client().from('profiles').select('*').eq('auth_user_id', auth.data.user.id).single();
    fail(error);
    let qr_identity: StudentQRIdentity | null = null;
    if (user.role === 'student') {
      const qr = await client().from('student_qr_identities').select('*').eq('user_id', user.id).eq('status', 'ACTIVE').maybeSingle();
      fail(qr.error);
      qr_identity = qr.data as StudentQRIdentity | null;
    }
    return { user: user as User, qr_identity };
  }

  async registerStudent(data: { name: string; email: string; student_id_number: string; password: string }): Promise<any> {
    const { error } = await client().auth.signUp({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      options: { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL || '/'}`, data: { name: data.name, student_id_number: data.student_id_number } }
    });
    fail(error);
    return { message: 'Account created. Sign in with your email and password.' };
  }

  async login(email: string, password: string): Promise<any> {
    const { error } = await client().auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });
    fail(error);
    return { message: 'Signed in successfully.' };
  }

  async verifyEmail(): Promise<{ success: boolean; message: string }> { return { success: true, message: 'Email verified by Supabase Auth.' }; }

  async getTrips(filters?: { date?: string; status?: string; driver_id?: string }): Promise<{ trips: Trip[] }> {
    let query = client().from('trips').select('*, bus:buses(*), route:routes(*)').order('travel_date').order('departure_time');
    if (filters?.date) query = query.eq('travel_date', filters.date);
    if (filters?.driver_id) query = query.eq('assigned_driver_id', filters.driver_id);
    if (filters?.status && filters.status !== 'ALL') query = query.eq('status', filters.status);
    const { data, error } = await query;
    fail(error);
    const trips = await Promise.all((data || []).map(async (trip: any) => {
      const [metrics, driver] = await Promise.all([
        rpc<any>('public_trip_metrics', { p_trip_id: trip.id }),
        trip.assigned_driver_id ? rpc<any>('public_driver_card', { p_driver_id: trip.assigned_driver_id }) : Promise.resolve(null)
      ]);
      return enrichTrip(trip, metrics, driver);
    }));
    return { trips };
  }

  async getTripDetails(id: string): Promise<{ trip: Trip & { seat_map: Array<{ seat_id: string; row: number; column: string; is_booked: boolean }> } }> {
    const { data, error } = await client().from('trips').select('*, bus:buses(*), route:routes(*)').eq('id', id).single();
    fail(error);
    const [metrics, driver] = await Promise.all([
      rpc<any>('public_trip_metrics', { p_trip_id: id }),
      data.assigned_driver_id ? rpc<any>('public_driver_card', { p_driver_id: data.assigned_driver_id }) : Promise.resolve(null)
    ]);
    const trip = enrichTrip(data, metrics, driver) as any;
    const capacity = trip.bus?.capacity || 32;
    trip.seat_map = Array.from({ length: capacity }, (_, index) => {
      const row = Math.floor(index / 4) + 1;
      const column = ['A', 'B', 'C', 'D'][index % 4];
      const seat_id = `${row}${column}`;
      return { seat_id, row, column, is_booked: (metrics?.occupied_seats || []).includes(seat_id) };
    });
    return { trip };
  }

  async updateTripStatus(id: string, data: { status?: string; parking_bay?: string }): Promise<{ trip: Trip }> {
    const trip = await rpc<Trip>('update_trip_status', { p_trip_id: id, p_status: data.status || null, p_parking_bay: data.parking_bay || null });
    return { trip };
  }
  async setTripBookingWindow(id: string, action: 'OPEN' | 'CLOSE'): Promise<{ success: boolean; trip: Trip; message: string }> {
    const trip = await rpc<Trip>('admin_set_booking_window', { p_trip_id: id, p_action: action });
    return { success: true, trip, message: `Booking window ${action.toLowerCase()}.` };
  }
  async assignTripDriver(tripId: string, driver_id: string): Promise<{ success: boolean; trip: Trip; driver: User; message: string }> {
    const trip = await rpc<Trip>('admin_assign_driver', { p_trip_id: tripId, p_driver_id: driver_id });
    const { data: driver, error } = await client().from('profiles').select('*').eq('id', driver_id).single(); fail(error);
    return { success: true, trip, driver: driver as User, message: 'Driver assigned.' };
  }
  async getDriverAvailability(date?: string): Promise<{ drivers: DriverAvailability[] }> {
    const { data: drivers, error } = await client().from('profiles').select('*').eq('role', 'driver').order('name'); fail(error);
    const { data: trips, error: tripError } = await client().from('trips').select('*, bus:buses(*)').eq('travel_date', date || new Date().toISOString().slice(0, 10)); fail(tripError);
    return { drivers: (drivers || []).map((driver: any) => {
      const trip = (trips || []).find((item: any) => item.assigned_driver_id === driver.id);
      return { driver, is_assigned_today: Boolean(trip), assigned_bus_number: trip?.bus?.bus_number, assigned_bus_name: trip?.bus?.bus_name, assigned_trip_id: trip?.id, assigned_departure_time: trip?.departure_time };
    }) };
  }

  async createBooking(trip_id: string, seat_id: string): Promise<any> { return rpc('create_booking', { p_trip_id: trip_id, p_seat_id: seat_id }); }
  async getMyBookings(): Promise<{ bookings: Booking[] }> {
    const { data, error } = await client().from('bookings').select('*, trip:trips(*, bus:buses(*), route:routes(*)), boarding_event:boarding_events(*)').order('created_at', { ascending: false });
    fail(error);
    const bookings = await Promise.all((data || []).map(async (booking: any) => {
      const trip = booking.trip;
      if (trip?.assigned_driver_id) trip.driver = await rpc<any>('public_driver_card', { p_driver_id: trip.assigned_driver_id });
      return { ...booking, boarding_event: Array.isArray(booking.boarding_event) ? (booking.boarding_event[0] || null) : booking.boarding_event } as Booking;
    }));
    return { bookings };
  }
  async cancelBooking(id: string): Promise<any> { return rpc('cancel_booking', { p_booking_id: id }); }
  async getStudentQR(): Promise<{ qr_identity: StudentQRIdentity; user: User }> {
    const { user, qr_identity } = await this.getMe();
    if (!qr_identity) throw new Error('No active QR pass is assigned to this account.');
    return { qr_identity, user };
  }
  async verifyBoarding(payload: { trip_id: string; qr_identifier?: string; booking_reference?: string; method?: 'QR' | 'MANUAL' }): Promise<BoardingVerificationResult> {
    return rpc('verify_boarding_for_driver', {
      p_trip_id: payload.trip_id, p_qr_identifier: payload.qr_identifier || null,
      p_booking_reference: payload.booking_reference || null, p_method: payload.method || 'QR'
    });
  }
  async getTripManifest(tripId: string): Promise<any> {
    const [manifest, details] = await Promise.all([
      rpc<any>('get_trip_manifest', { p_trip_id: tripId }),
      this.getTripDetails(tripId)
    ]);
    return { ...manifest, trip: details.trip };
  }

  async sendTripReminders(_tripId: string, _custom_note?: string): Promise<any> {
    throw new Error('Email delivery is not configured yet. Connect the Gmail account before sending reminders.');
  }
  async revokeStudentQR(student_id: string): Promise<any> { return rpc('admin_revoke_student_qr', { p_student_id: student_id }); }
  async regenerateStudentQR(student_id: string): Promise<any> { return { qr_identity: await rpc('admin_regenerate_student_qr', { p_student_id: student_id }) }; }
  async getEmailLogs(): Promise<{ logs: EmailLog[] }> { const { data, error } = await client().from('email_logs').select('*').order('sent_at', { ascending: false }); fail(error); return { logs: data as EmailLog[] }; }
  async recordDriverEmailLog(booking_id: string, status: 'SENT' | 'FAILED', error_message?: string): Promise<EmailLog> {
    return rpc('record_driver_email_log', { p_booking_id: booking_id, p_status: status, p_error_message: error_message || null });
  }
  async retryEmail(_id: string): Promise<any> { throw new Error('Email delivery provider is not configured.'); }
  async getSettings(): Promise<{ settings: SystemSettings }> { const { data, error } = await client().from('system_settings').select('*').eq('id', true).single(); fail(error); return { settings: data as SystemSettings }; }
  async updateSettings(data: Partial<SystemSettings>): Promise<{ settings: SystemSettings }> { const { data: settings, error } = await client().from('system_settings').update(data).eq('id', true).select().single(); fail(error); return { settings: settings as SystemSettings }; }
  async resetDemoData(): Promise<any> { await this.clearAllBookings(); return this.openAllTrips(); }
  async openAllTrips(): Promise<any> { const count = await rpc<number>('admin_set_all_booking_windows', { p_open: true }); return { success: true, count, message: `Opened ${count} trips.` }; }
  async closeAllTrips(): Promise<any> { const count = await rpc<number>('admin_set_all_booking_windows', { p_open: false }); return { success: true, count, message: `Closed ${count} trips.` }; }
  async clearAllBookings(): Promise<any> { return rpc('admin_clear_bookings'); }
  async getBusMap(): Promise<{ bus_map: BusIdentificationMap }> { const { data, error } = await client().from('bus_identification_map').select('*').eq('id', true).maybeSingle(); fail(error); if (!data) throw new Error('Bus map is not configured.'); return { bus_map: data as BusIdentificationMap }; }
  async updateBusMap(data: Partial<BusIdentificationMap>): Promise<any> { const { data: bus_map, error } = await client().from('bus_identification_map').upsert({ ...data, id: true, updated_at: new Date().toISOString() }).select().single(); fail(error); return { success: true, bus_map }; }
  async resetBusMap(): Promise<any> {
    const { user } = await this.getMe();
    return this.updateBusMap({ image_url: DEFAULT_BUS_MAP_IMAGE, title: 'CIT Campus Bus Identification & Parking Bay Allocation Map', effective_date: new Date().toISOString().slice(0, 10), updated_by_name: user.name, updated_by_email: user.email, notes: 'Official campus parking bay layout and bus identification numbers for today.' });
  }
  async getBuses(): Promise<{ buses: Bus[] }> { const { data, error } = await client().from('buses').select('*, route:routes(*)').order('bus_number'); fail(error); return { buses: data as Bus[] }; }
  async createBus(data: any): Promise<any> {
    return rpc('admin_create_bus', {
      p_bus_number: data.bus_number, p_bus_name: data.bus_name || data.bus_number,
      p_capacity: data.capacity || 32, p_route_id: data.route_id || null,
      p_departure_time: data.departure_time || '03:30 PM', p_parking_bay: data.parking_bay || '',
      p_assigned_driver_id: data.assigned_driver_id || null,
      p_new_route_name: data.new_route_name || null,
      p_new_route_stops: Array.isArray(data.new_route_stops) ? data.new_route_stops : (data.new_route_stops || '').split(',').map((stop: string) => stop.trim()).filter(Boolean)
    });
  }
  async createRoute(data: { name: string; route_number?: number; ordered_stops: string[] }): Promise<Route> { return rpc('admin_create_route', { p_name: data.name, p_route_number: data.route_number || null, p_stops: data.ordered_stops }); }
  async createTrip(data: any): Promise<Trip> { return rpc('admin_create_trip', { p_bus_id: data.bus_id, p_route_id: data.route_id, p_departure_time: data.departure_time, p_travel_date: data.travel_date || new Date().toISOString().slice(0, 10), p_parking_bay: data.parking_bay || '', p_assigned_driver_id: data.assigned_driver_id || null, p_notes: data.notes || '' }); }
  async sendBoardingReminders(tripId: string, custom_message?: string): Promise<any> { return this.sendTripReminders(tripId, custom_message); }
  async setBookingWindow(tripId: string, action: 'OPEN' | 'CLOSE' | 'TOGGLE'): Promise<any> { return this.setTripBookingWindow(tripId, action === 'TOGGLE' ? 'OPEN' : action); }
  async assignDriver(tripId: string, driver_id: string): Promise<any> { return this.assignTripDriver(tripId, driver_id); }
}

export const api = new ApiService();
