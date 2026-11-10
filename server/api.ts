import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db } from './db.ts';
import { 
  User, 
  StudentQRIdentity, 
  Booking, 
  BoardingEvent, 
  EmailLog, 
  Trip,
  BoardingVerificationResult,
  Bus,
  Route,
  BusIdentificationMap,
  DriverAvailability
} from '../src/types/index.ts';

export const apiRouter = Router();

// Helper: Extract authenticated user from Bearer header or query param
function getAuthUser(req: Request): User | null {
  const authHeader = req.headers.authorization;
  let userId: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    userId = authHeader.substring(7).trim();
  } else if (req.query.user_id) {
    userId = String(req.query.user_id);
  }

  if (!userId) return null;

  const currentDb = db.read();
  const user = currentDb.users.find(u => u.id === userId);
  return user || null;
}

function getEsp32Driver(req: Request): User | null {
  const configuredToken = process.env.ESP32_DEVICE_TOKEN;
  const driverId = process.env.ESP32_DRIVER_ID;
  const authHeader = req.headers.authorization;
  if (!configuredToken || !driverId || !authHeader?.startsWith('Bearer ')) return null;

  const receivedToken = Buffer.from(authHeader.substring(7).trim());
  const expectedToken = Buffer.from(configuredToken);
  if (
    receivedToken.length !== expectedToken.length ||
    !crypto.timingSafeEqual(receivedToken, expectedToken)
  ) {
    return null;
  }

  const driver = db.read().users.find(user => user.id === driverId);
  return driver?.role === 'driver' ? driver : null;
}

// -------------------------------------------------------------
// AUTH & PROFILE ENDPOINTS
// -------------------------------------------------------------

// List demo users for rapid testing
apiRouter.get('/auth/demo-users', (_req: Request, res: Response) => {
  const currentDb = db.read();
  res.json({
    users: currentDb.users,
    active_qrs: currentDb.student_qr_identities.filter(q => q.status === 'ACTIVE')
  });
});

// Get current user profile and active QR pass if student
apiRouter.get('/auth/me', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const currentDb = db.read();
  let qrIdentity: StudentQRIdentity | undefined;

  if (user.role === 'student') {
    qrIdentity = currentDb.student_qr_identities.find(
      q => q.user_id === user.id && q.status === 'ACTIVE'
    );
    if (!qrIdentity) {
      const opaqueToken = `CIT-QR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      qrIdentity = {
        id: `qr_${Date.now()}`,
        user_id: user.id,
        opaque_qr_identifier: opaqueToken,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        revoked_at: null,
        regenerated_at: null
      };
      db.transaction(database => {
        database.student_qr_identities.push(qrIdentity!);
      });
    }
  }

  res.json({
    user,
    qr_identity: qrIdentity || null
  });
});

// Student Registration
apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const { name, email, student_id_number, phone } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  const currentDb = db.read();
  const settings = currentDb.settings;

  // Enforce domain restriction if active
  if (settings.restrict_email_domain) {
    if (!email.toLowerCase().endsWith(settings.allowed_domain.toLowerCase())) {
      return res.status(400).json({ 
        error: `Only verified campus emails ending with ${settings.allowed_domain} are permitted.` 
      });
    }
  }

  // Check existing user - if already registered, allow direct access without re-registering
  const existing = currentDb.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    let qr = currentDb.student_qr_identities.find(q => q.user_id === existing.id && q.status === 'ACTIVE');
    if (!qr) {
      const opaqueToken = `CIT-QR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      qr = {
        id: `qr_${Date.now()}`,
        user_id: existing.id,
        opaque_qr_identifier: opaqueToken,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        revoked_at: null,
        regenerated_at: null
      };
      db.transaction(database => {
        database.student_qr_identities.push(qr!);
      });
    }
    return res.status(200).json({
      user: existing,
      qr_identity: qr,
      token: existing.id,
      is_existing: true,
      message: 'Welcome back! Directly accessed your registered student account.'
    });
  }

  const newUser: User = {
    id: `usr_student_${Date.now()}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role: 'student', // Never allow public role escalation
    is_verified: true, // Demo auto-verification or toggleable
    student_id_number: student_id_number?.trim() || `CIT-${Math.floor(1000 + Math.random() * 9000)}`,
    phone: phone?.trim() || '',
    created_at: new Date().toISOString()
  };

  // Automatically provision opaque QR identity for the registered student
  const opaqueToken = `CIT-QR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  const newQR: StudentQRIdentity = {
    id: `qr_${Date.now()}`,
    user_id: newUser.id,
    opaque_qr_identifier: opaqueToken,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    revoked_at: null,
    regenerated_at: null
  };

  db.transaction(database => {
    database.users.push(newUser);
    database.student_qr_identities.push(newQR);
  });

  res.status(201).json({
    user: newUser,
    qr_identity: newQR,
    token: newUser.id
  });
});

// Student Email Verification Toggle / Action
apiRouter.post('/auth/verify-email', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  db.transaction(database => {
    const target = database.users.find(u => u.id === user.id);
    if (target) {
      target.is_verified = true;
    }
  });

  res.json({ success: true, message: 'Email address verified successfully.' });
});

// Staff / General / Student Sign In
apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, role } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const currentDb = db.read();
  const normalizedEmail = email.toLowerCase().trim();
  let user = currentDb.users.find(u => u.email.toLowerCase().trim() === normalizedEmail);

  if (!user) {
    // Determine if this is a student login (explicit role or student email format)
    const isStudentAttempt = role === 'student' || (!role && !normalizedEmail.includes('driver') && !normalizedEmail.includes('admin') && !normalizedEmail.includes('transport'));

    if (isStudentAttempt) {
      // Auto-provision student profile so user is never locked out on direct access or login
      const localPart = normalizedEmail.split('@')[0];
      const derivedName = localPart
        .split(/[._-]/)
        .filter(Boolean)
        .map((p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ') || 'CIT Student';

      const newUser: User = {
        id: `usr_student_${Date.now()}`,
        name: derivedName,
        email: normalizedEmail,
        role: 'student',
        is_verified: true,
        student_id_number: `CIT-${Math.floor(1000 + Math.random() * 9000)}`,
        phone: '+91 98940 12345',
        created_at: new Date().toISOString()
      };

      const opaqueToken = `CIT-QR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      const newQR: StudentQRIdentity = {
        id: `qr_${Date.now()}`,
        user_id: newUser.id,
        opaque_qr_identifier: opaqueToken,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        revoked_at: null,
        regenerated_at: null
      };

      db.transaction(database => {
        database.users.push(newUser);
        database.student_qr_identities.push(newQR);
      });

      return res.json({
        user: newUser,
        qr_identity: newQR,
        token: newUser.id
      });
    }

    return res.status(404).json({ error: 'No account found with this email address.' });
  }

  if (role && user.role !== role) {
    return res.status(403).json({ error: `This account does not have ${role} privileges.` });
  }

  let qrIdentity: StudentQRIdentity | undefined;
  if (user.role === 'student') {
    qrIdentity = currentDb.student_qr_identities.find(
      q => q.user_id === user.id && q.status === 'ACTIVE'
    );

    // If existing student lacks an active QR identity, provision one seamlessly
    if (!qrIdentity) {
      const opaqueToken = `CIT-QR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
      qrIdentity = {
        id: `qr_${Date.now()}`,
        user_id: user.id,
        opaque_qr_identifier: opaqueToken,
        status: 'ACTIVE',
        created_at: new Date().toISOString(),
        revoked_at: null,
        regenerated_at: null
      };
      db.transaction(database => {
        database.student_qr_identities.push(qrIdentity!);
      });
    }
  }

  res.json({
    user,
    qr_identity: qrIdentity || null,
    token: user.id
  });
});

// -------------------------------------------------------------
// TRIPS & BUSES ENDPOINTS
// -------------------------------------------------------------

// Helper to calculate dynamic status of a trip
function computeTripStatus(trip: Trip, bookedCount: number, capacity: number): Trip['status'] {
  // If explicitly departed or completed, keep that status
  if (trip.status === 'DEPARTED' || trip.status === 'COMPLETED') {
    return trip.status;
  }

  // If administrator explicitly closed bookings, keep CLOSED
  if (trip.status === 'CLOSED') {
    return 'CLOSED';
  }

  const now = new Date().getTime();
  const openTime = new Date(trip.booking_window_opens_at).getTime();
  const closeTime = new Date(trip.booking_window_closes_at).getTime();

  if (now < openTime) {
    return 'NOT YET OPEN';
  }
  if (now > closeTime) {
    return 'CLOSED';
  }
  if (bookedCount >= capacity) {
    return 'FULL';
  }
  return 'OPEN';
}

// Get all trips with joined details
apiRouter.get('/trips', (req: Request, res: Response) => {
  const currentDb = db.read();
  const { date, status, driver_id } = req.query;

  let trips = currentDb.trips;

  // Filter by driver if requested
  if (driver_id) {
    trips = trips.filter(t => t.assigned_driver_id === driver_id);
  }

  // Filter by date if specified
  if (date) {
    trips = trips.filter(t => t.travel_date === date);
  }

  const enrichedTrips = trips.map(t => {
    const bus = currentDb.buses.find(b => b.id === t.bus_id);
    const route = currentDb.routes.find(r => r.id === t.route_id);
    const driver = currentDb.users.find(u => u.id === t.assigned_driver_id);
    
    // Count confirmed bookings
    const activeBookings = currentDb.bookings.filter(
      b => b.trip_id === t.id && b.booking_status === 'CONFIRMED'
    );
    const capacity = bus?.capacity || 32;
    const bookedCount = activeBookings.length;
    const boardedCount = activeBookings.filter(b => b.boarding_status === 'BOARDED').length;
    const pendingCount = activeBookings.filter(b => b.boarding_status === 'NOT BOARDED').length;
    const remainingSeats = Math.max(0, capacity - bookedCount);
    const dynamicStatus = computeTripStatus(t, bookedCount, capacity);

    const passengers = activeBookings.map(b => {
      const student = currentDb.users.find(u => u.id === b.student_id);
      const event = currentDb.boarding_events.find(e => e.booking_id === b.id);
      return {
        booking_id: b.id,
        booking_reference: b.booking_reference,
        student_id: b.student_id,
        student_name: student?.name || 'Student',
        student_email: student?.email || '',
        student_roll: student?.student_id_number || '',
        seat_id: b.seat_id,
        boarding_status: b.boarding_status,
        boarded_at: event?.boarded_at
      };
    });

    return {
      ...t,
      status: dynamicStatus,
      bus,
      route,
      driver,
      total_seats: capacity,
      booked_seats_count: bookedCount,
      boarded_seats_count: boardedCount,
      pending_boarding_count: pendingCount,
      remaining_seats_count: remainingSeats,
      passengers
    };
  });

  // Filter by status if requested
  let filtered = enrichedTrips;
  if (status && status !== 'ALL') {
    filtered = enrichedTrips.filter(t => t.status === status);
  }

  res.json({ trips: filtered });
});

// Get single trip details with complete seat layout map
apiRouter.get('/trips/:id', (req: Request, res: Response) => {
  const currentDb = db.read();
  const trip = currentDb.trips.find(t => t.id === req.params.id);

  if (!trip) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  const bus = currentDb.buses.find(b => b.id === trip.bus_id);
  const route = currentDb.routes.find(r => r.id === trip.route_id);
  const driver = currentDb.users.find(u => u.id === trip.assigned_driver_id);

  const confirmedBookings = currentDb.bookings.filter(
    b => b.trip_id === trip.id && b.booking_status === 'CONFIRMED'
  );

  const capacity = bus?.capacity || 32;
  const bookedSeatIds = confirmedBookings.map(b => b.seat_id);
  const bookedCount = confirmedBookings.length;
  const remainingSeats = Math.max(0, capacity - bookedCount);
  const dynamicStatus = computeTripStatus(trip, bookedCount, capacity);

  // Generate 2x2 layout seats (e.g. 1A, 1B - aisle - 1C, 1D)
  const rows = Math.ceil(capacity / 4);
  const seatMap = [];
  for (let r = 1; r <= rows; r++) {
    const letters = ['A', 'B', 'C', 'D'];
    for (const letter of letters) {
      const seatId = `${r}${letter}`;
      if (seatMap.length < capacity) {
        seatMap.push({
          seat_id: seatId,
          row: r,
          column: letter,
          is_booked: bookedSeatIds.includes(seatId)
        });
      }
    }
  }

  res.json({
    trip: {
      ...trip,
      status: dynamicStatus,
      bus,
      route,
      driver,
      total_seats: capacity,
      booked_seats_count: bookedCount,
      remaining_seats_count: remainingSeats,
      seat_map: seatMap
    }
  });
});

// Update trip status (Boarding, Departed, Completed, Closed, etc.)
apiRouter.patch('/trips/:id/status', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'driver' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Only authorized drivers or administrators can update trip status.' });
  }

  const { status, parking_bay } = req.body;
  const tripId = req.params.id;

  const updated = db.transaction(database => {
    const trip = database.trips.find(t => t.id === tripId);
    if (!trip) return null;

    // Driver can only update their assigned trip
    if (user.role === 'driver' && trip.assigned_driver_id !== user.id) {
      throw new Error('You are not authorized to update trips not assigned to you.');
    }

    if (status) trip.status = status;
    if (parking_bay) trip.parking_bay = parking_bay;

    return trip;
  });

  if (!updated) {
    return res.status(404).json({ error: 'Trip not found' });
  }

  res.json({ success: true, trip: updated });
});

// Admin: Open or Close bus bookings
apiRouter.patch('/trips/:id/booking-window', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required to open or close bus bookings.' });
  }

  let rawAction = req.body.action || (req.body.status ? (req.body.status === 'CLOSED' ? 'CLOSE' : 'OPEN') : '');
  let action = typeof rawAction === 'string' ? rawAction.toUpperCase() : '';
  const tripId = req.params.id;

  try {
    const updated = db.transaction(database => {
      const trip = database.trips.find(t => t.id === tripId);
      if (!trip) throw new Error('Trip not found.');

      if (action === 'TOGGLE') {
        action = trip.status === 'OPEN' ? 'CLOSE' : 'OPEN';
      }

      if (action !== 'OPEN' && action !== 'CLOSE') {
        throw new Error('Action must be OPEN, CLOSE, or TOGGLE.');
      }

      const now = new Date();
      if (action === 'OPEN') {
        trip.status = 'OPEN';
        // Open window from 1 hour ago until 4 hours from now
        trip.booking_window_opens_at = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
        trip.booking_window_closes_at = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
      } else {
        trip.status = 'CLOSED';
        trip.booking_window_closes_at = now.toISOString();
      }

      return trip;
    });

    res.json({ 
      success: true, 
      trip: updated,
      message: action === 'OPEN' ? 'Bus bookings successfully OPENED for students.' : 'Bus bookings successfully CLOSED.'
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to update booking window.' });
  }
});

// Admin: Open all trips for booking in one click
apiRouter.post('/admin/trips/open-all', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  const now = new Date();
  const updatedTrips = db.transaction(database => {
    database.trips.forEach(trip => {
      trip.status = 'OPEN';
      trip.booking_window_opens_at = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      trip.booking_window_closes_at = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
    });
    return database.trips;
  });

  res.json({
    success: true,
    count: updatedTrips.length,
    message: `All ${updatedTrips.length} campus buses are now OPEN for student bookings.`
  });
});

// Admin: Close all trips for booking in one click
apiRouter.post('/admin/trips/close-all', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  const now = new Date();
  const updatedTrips = db.transaction(database => {
    database.trips.forEach(trip => {
      trip.status = 'CLOSED';
      trip.booking_window_closes_at = now.toISOString();
    });
    return database.trips;
  });

  res.json({
    success: true,
    count: updatedTrips.length,
    message: `All ${updatedTrips.length} campus bus bookings have been CLOSED by Administrator.`
  });
});

// Admin: Remove all previous bookings made in past (reset to fresh state)
apiRouter.post('/admin/bookings/clear-all', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  db.transaction(database => {
    database.bookings = [];
    database.boarding_events = [];
    database.email_logs = [];
  });

  res.json({
    success: true,
    message: 'All previous bookings and boarding events have been cleared. All bus seats are now available.'
  });
});

// Admin: Assign driver to trip (enforcing 1 driver associated with only 1 bus/trip per day)
apiRouter.patch('/trips/:id/assign-driver', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required to assign drivers.' });
  }

  const { driver_id } = req.body;
  const tripId = req.params.id;

  if (!driver_id) {
    return res.status(400).json({ error: 'Driver ID is required.' });
  }

  try {
    const updated = db.transaction(database => {
      const trip = database.trips.find(t => t.id === tripId);
      if (!trip) throw new Error('Trip not found.');

      const driver = database.users.find(u => u.id === driver_id && u.role === 'driver');
      if (!driver) throw new Error('Selected user is not a registered campus driver.');

      // Check single driver constraint: Ensure this driver is not assigned to any other bus/trip on this day
      const conflictTrip = database.trips.find(
        t => t.id !== trip.id && t.assigned_driver_id === driver_id && t.travel_date === trip.travel_date
      );

      if (conflictTrip) {
        const conflictBus = database.buses.find(b => b.id === conflictTrip.bus_id);
        throw new Error(
          `Driver ${driver.name} is already associated with ${conflictBus?.bus_number || 'another bus'} today (${trip.travel_date}). Each driver can only be associated with one bus per day.`
        );
      }

      trip.assigned_driver_id = driver_id;
      return { trip, driver };
    });

    res.json({
      success: true,
      trip: updated.trip,
      driver: updated.driver,
      message: `Driver ${updated.driver.name} successfully assigned to this bus trip.`
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Driver assignment failed.' });
  }
});

// Admin: Get Driver availability for date
apiRouter.get('/admin/drivers/availability', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  const date = (req.query.date as string) || new Date().toISOString().split('T')[0];
  const currentDb = db.read();
  const drivers = currentDb.users.filter(u => u.role === 'driver');

  const availability: DriverAvailability[] = drivers.map(d => {
    const assignedTrip = currentDb.trips.find(
      t => t.assigned_driver_id === d.id && t.travel_date === date
    );
    const bus = assignedTrip ? currentDb.buses.find(b => b.id === assignedTrip.bus_id) : undefined;

    return {
      driver: d,
      is_assigned_today: !!assignedTrip,
      assigned_bus_number: bus?.bus_number,
      assigned_bus_name: bus?.bus_name,
      assigned_trip_id: assignedTrip?.id,
      assigned_departure_time: assignedTrip?.departure_time
    };
  });

  res.json({ drivers: availability });
});

// -------------------------------------------------------------
// ATOMIC BOOKING ENDPOINTS
// -------------------------------------------------------------

// Create booking (Atomic seat lock & verification)
apiRouter.post('/bookings', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Please sign in to book a seat.' });
  }

  if (user.role !== 'student') {
    return res.status(403).json({ error: 'Only registered students can reserve seats.' });
  }

  if (!user.is_verified) {
    return res.status(403).json({ error: 'Your email address is unverified. Please verify your email before booking.' });
  }

  const { trip_id, seat_id } = req.body;
  if (!trip_id || !seat_id) {
    return res.status(400).json({ error: 'Trip ID and Seat ID are required.' });
  }

  try {
    const result = db.transaction(database => {
      const trip = database.trips.find(t => t.id === trip_id);
      if (!trip) {
        throw new Error('Trip not found.');
      }

      const bus = database.buses.find(b => b.id === trip.bus_id);
      const capacity = bus?.capacity || 32;

      // Revalidate window and capacity on server
      const confirmedBookingsForTrip = database.bookings.filter(
        b => b.trip_id === trip_id && b.booking_status === 'CONFIRMED'
      );

      const status = computeTripStatus(trip, confirmedBookingsForTrip.length, capacity);
      if (status !== 'OPEN') {
        throw new Error(`This trip is currently ${status}. Bookings are not accepted.`);
      }

      // Check student doesn't already have an active booking for this trip
      const existingStudentBooking = confirmedBookingsForTrip.find(
        b => b.student_id === user.id
      );
      if (existingStudentBooking) {
        throw new Error('You already have an active seat reserved on this bus trip.');
      }

      // ATOMIC SEAT UNIQUENESS CHECK
      const seatAlreadyBooked = confirmedBookingsForTrip.some(
        b => b.seat_id === seat_id
      );
      if (seatAlreadyBooked) {
        throw new Error(`Seat ${seat_id} was just booked by another student. Please select a different seat.`);
      }

      // Generate unique booking reference
      const bookingRef = `CIT-BK-${Math.floor(10000 + Math.random() * 90000)}`;

      const newBooking: Booking = {
        id: `bk_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        booking_reference: bookingRef,
        student_id: user.id,
        trip_id: trip.id,
        seat_id: seat_id,
        booking_status: 'CONFIRMED',
        boarding_status: 'NOT BOARDED',
        created_at: new Date().toISOString(),
        cancelled_at: null
      };

      database.bookings.push(newBooking);

      // Create transactional confirmation email record
      const route = database.routes.find(r => r.id === trip.route_id);
      const emailLog: EmailLog = {
        id: `eml_${Date.now()}`,
        booking_id: newBooking.id,
        recipient_email: user.email,
        recipient_name: user.name,
        subject: `CIT Booker — Your Bus Booking Is Confirmed [${bookingRef}]`,
        body_preview: `Dear ${user.name}, your seat ${seat_id} on bus ${bus?.bus_number || 'College Bus'} for route ${route?.name || 'Campus Transit'} is confirmed for ₹0. Scheduled departure: ${trip.departure_time}. Please present your personal QR pass when boarding.`,
        status: 'SENT',
        sent_at: new Date().toISOString(),
        error_message: null
      };

      database.email_logs.push(emailLog);

      return { booking: newBooking, bus, route, trip };
    });

    res.status(201).json({
      success: true,
      message: 'Seat confirmed successfully for ₹0!',
      booking: result.booking,
      details: {
        bus_number: result.bus?.bus_number,
        route_name: result.route?.name,
        departure_time: result.trip?.departure_time,
        seat_id: result.booking.seat_id
      }
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message || 'Booking failed' });
  }
});

// Get current student's bookings
apiRouter.get('/bookings/my', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const currentDb = db.read();
  const userBookings = currentDb.bookings
    .filter(b => b.student_id === user.id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const enriched = userBookings.map(b => {
    const trip = currentDb.trips.find(t => t.id === b.trip_id);
    const bus = trip ? currentDb.buses.find(bus => bus.id === trip.bus_id) : undefined;
    const route = trip ? currentDb.routes.find(r => r.id === trip.route_id) : undefined;
    const driver = trip ? currentDb.users.find(u => u.id === trip.assigned_driver_id) : undefined;
    const rawBoardingEvent = currentDb.boarding_events.find(e => e.booking_id === b.id);
    const scanningDriver = rawBoardingEvent 
      ? currentDb.users.find(u => u.id === rawBoardingEvent.scanned_by_driver_id) 
      : undefined;
    const boardingEvent = rawBoardingEvent ? {
      ...rawBoardingEvent,
      scanned_by_driver_name: scanningDriver?.name || driver?.name || 'Assigned Driver'
    } : null;

    return {
      ...b,
      boarding_event: boardingEvent,
      trip: trip ? {
        ...trip,
        bus,
        route,
        driver
      } : undefined
    };
  });

  res.json({ bookings: enriched });
});

// Cancel a booking
apiRouter.post('/bookings/:id/cancel', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const bookingId = req.params.id;

  try {
    const updated = db.transaction(database => {
      const booking = database.bookings.find(b => b.id === bookingId);
      if (!booking) {
        throw new Error('Booking not found.');
      }

      // Check ownership
      if (user.role !== 'admin' && booking.student_id !== user.id) {
        throw new Error('You can only cancel your own bookings.');
      }

      if (booking.booking_status === 'CANCELLED') {
        throw new Error('This booking has already been cancelled.');
      }

      if (booking.boarding_status === 'BOARDED') {
        throw new Error('Cannot cancel a booking that has already been boarded.');
      }

      booking.booking_status = 'CANCELLED';
      booking.cancelled_at = new Date().toISOString();

      return booking;
    });

    res.json({
      success: true,
      message: 'Booking cancelled and seat released.',
      booking: updated
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// -------------------------------------------------------------
// STUDENT PERSONAL QR IDENTITY
// -------------------------------------------------------------

apiRouter.get('/student/qr', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const currentDb = db.read();
  const qrIdentity = currentDb.student_qr_identities.find(
    q => q.user_id === user.id && q.status === 'ACTIVE'
  );

  if (!qrIdentity) {
    return res.status(404).json({ 
      error: 'No active QR identity found for this student. Please contact campus transport administration.' 
    });
  }

  res.json({ qr_identity: qrIdentity, user });
});

// -------------------------------------------------------------
// DRIVER BOARDING SCANNER & MANIFEST (CORE FEATURE)
// -------------------------------------------------------------

// Trip passenger manifest
apiRouter.get('/trips/:id/manifest', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'driver' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Unauthorized manifest access.' });
  }

  const tripId = req.params.id;
  const currentDb = db.read();

  const trip = currentDb.trips.find(t => t.id === tripId);
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found.' });
  }

  // Driver authorization
  if (user.role === 'driver' && trip.assigned_driver_id !== user.id) {
    return res.status(403).json({ error: 'You are only authorized to view manifests for your assigned trips.' });
  }

  const confirmedBookings = currentDb.bookings.filter(
    b => b.trip_id === tripId && b.booking_status === 'CONFIRMED'
  );

  const manifest = confirmedBookings.map(b => {
    const student = currentDb.users.find(u => u.id === b.student_id);
    const boardingEvent = currentDb.boarding_events.find(e => e.booking_id === b.id);

    return {
      booking_id: b.id,
      booking_reference: b.booking_reference,
      seat_id: b.seat_id,
      student_name: student?.name || 'Unknown Student',
      student_email: student?.email,
      student_id_number: student?.student_id_number,
      boarding_status: b.boarding_status,
      boarded_at: boardingEvent?.boarded_at || null,
      method: boardingEvent?.method || null
    };
  }).sort((a, b) => a.seat_id.localeCompare(b.seat_id, undefined, { numeric: true }));

  const bus = currentDb.buses.find(b => b.id === trip.bus_id);
  const route = currentDb.routes.find(r => r.id === trip.route_id);
  const boardedCount = manifest.filter(m => m.boarding_status === 'BOARDED').length;

  res.json({
    trip: {
      ...trip,
      bus,
      route
    },
    total_passengers: manifest.length,
    boarded_passengers: boardedCount,
    remaining_passengers: manifest.length - boardedCount,
    manifest
  });
});

// Driver / Admin Endpoint to send reminders to unboarded students
apiRouter.post('/trips/:id/send-reminders', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'driver' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Unauthorized to send boarding reminders.' });
  }

  const tripId = req.params.id;
  const { custom_note } = req.body;

  try {
    const result = db.transaction(database => {
      const trip = database.trips.find(t => t.id === tripId);
      if (!trip) {
        throw new Error('Trip not found.');
      }

      if (user.role === 'driver' && trip.assigned_driver_id !== user.id) {
        throw new Error('You are only authorized to send reminders for your assigned trips.');
      }

      const bus = database.buses.find(b => b.id === trip.bus_id);
      const route = database.routes.find(r => r.id === trip.route_id);

      const confirmedBookings = database.bookings.filter(
        b => b.trip_id === tripId && b.booking_status === 'CONFIRMED'
      );

      const unboardedBookings = confirmedBookings.filter(b => b.boarding_status !== 'BOARDED');

      if (unboardedBookings.length === 0) {
        return {
          count: 0,
          reminders_sent: [],
          message: 'All confirmed passengers have already boarded!'
        };
      }

      const reminders_sent: Array<any> = [];
      const timestamp = new Date().toISOString();

      unboardedBookings.forEach(booking => {
        const student = database.users.find(u => u.id === booking.student_id);
        if (!student) return;

        const reminderLog: any = {
          id: `log_rem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          booking_id: booking.id,
          recipient_email: student.email,
          student_name: student.name,
          email_type: 'UNBOARDED_REMINDER',
          subject: `🚨 BOARDING CALL: ${bus?.bus_number || 'Campus Bus'} Departure at ${trip.departure_time}`,
          body_preview: `Dear ${student.name}, this is an urgent reminder from Driver ${user.name}. Bus ${bus?.bus_number || ''} at ${trip.parking_bay} is preparing to depart at ${trip.departure_time}. Your reserved seat is ${booking.seat_id}. ${custom_note ? 'Note: ' + custom_note : 'Please report to the bus immediately.'}`,
          status: 'SENT',
          sent_at: timestamp,
          retry_count: 0
        };

        database.email_logs.unshift(reminderLog);

        reminders_sent.push({
          booking_id: booking.id,
          seat_id: booking.seat_id,
          student_name: student.name,
          student_email: student.email,
          student_id_number: student.student_id_number,
          sent_at: timestamp
        });
      });

      return {
        count: reminders_sent.length,
        reminders_sent,
        message: `Successfully dispatched departure reminders to ${reminders_sent.length} unboarded passengers.`
      };
    });

    res.json({
      success: true,
      ...result
    });
  } catch (err: any) {
    return res.status(400).json({ error: err.message });
  }
});

// Boarding Verification Endpoint
// Receives: { trip_id, qr_identifier, booking_reference, method }
apiRouter.post('/boarding/verify', (req: Request, res: Response) => {
  const authenticatedUser = getAuthUser(req);
  const esp32Driver = authenticatedUser ? null : getEsp32Driver(req);
  const driverUser = authenticatedUser || esp32Driver;
  if (!driverUser) {
    return res.status(401).json({ 
      success: false, 
      code: 'DRIVER_UNAUTHORIZED', 
      message: 'Authentication required. Please sign in as an authorized driver.' 
    } satisfies BoardingVerificationResult);
  }

  if (driverUser.role !== 'driver' && driverUser.role !== 'admin') {
    return res.status(403).json({ 
      success: false, 
      code: 'DRIVER_UNAUTHORIZED', 
      message: 'Access denied: Only authorized drivers or administrators may verify boarding.' 
    } satisfies BoardingVerificationResult);
  }

  const { trip_id, qr_identifier, booking_reference, method } = req.body;
  if (esp32Driver && (!qr_identifier || booking_reference)) {
    return res.status(400).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'ESP32-CAM requests must include a decoded QR identifier.'
    } satisfies BoardingVerificationResult);
  }

  if (!trip_id) {
    return res.status(400).json({ 
      success: false, 
      code: 'SERVER_ERROR', 
      message: 'Assigned Trip ID is required for verification.' 
    } satisfies BoardingVerificationResult);
  }

  try {
    const verificationResult = db.transaction<BoardingVerificationResult>(database => {
      const trip = database.trips.find(t => t.id === trip_id);
      if (!trip) {
        return {
          success: false,
          code: 'SERVER_ERROR',
          message: 'Specified trip was not found in database.'
        };
      }

      // Step 3: Verify driver is assigned to this trip (admin has override)
      if (driverUser.role === 'driver' && trip.assigned_driver_id !== driverUser.id) {
        return {
          success: false,
          code: 'DRIVER_UNAUTHORIZED',
          message: 'Security error: You are not the assigned driver for this trip.'
        };
      }

      const bus = database.buses.find(b => b.id === trip.bus_id);
      const route = database.routes.find(r => r.id === trip.route_id);

      let targetStudent: User | undefined;
      let targetBooking: Booking | undefined;

      // MODE A: Scanned via Opaque QR Identity Identifier
      if (qr_identifier) {
        const trimmedQR = String(qr_identifier).trim();
        const qrRecord = database.student_qr_identities.find(
          q => q.opaque_qr_identifier === trimmedQR
        );

        if (!qrRecord) {
          return {
            success: false,
            code: 'QR_REVOKED_OR_INVALID',
            message: 'Unrecognized QR identity. QR code is invalid or does not belong to CIT Booker.'
          };
        }

        if (qrRecord.status !== 'ACTIVE') {
          return {
            success: false,
            code: 'QR_REVOKED_OR_INVALID',
            message: 'This student QR identity has been revoked by campus transport administration.'
          };
        }

        targetStudent = database.users.find(u => u.id === qrRecord.user_id);
        if (!targetStudent) {
          return {
            success: false,
            code: 'QR_REVOKED_OR_INVALID',
            message: 'Student account linked to this QR code could not be resolved.'
          };
        }

        // Look for any booking for this student across all trips
        const studentBookings = database.bookings.filter(b => b.student_id === targetStudent!.id);

        // Check if student has a booking for THIS trip
        targetBooking = studentBookings.find(b => b.trip_id === trip.id);

        if (!targetBooking) {
          // Check if student has a booking for another trip today
          const bookingAnotherTrip = studentBookings.find(b => b.booking_status === 'CONFIRMED');
          if (bookingAnotherTrip) {
            const otherTrip = database.trips.find(t => t.id === bookingAnotherTrip.trip_id);
            const otherBus = otherTrip ? database.buses.find(b => b.id === otherTrip.bus_id) : undefined;
            return {
              success: false,
              code: 'WRONG_TRIP',
              message: `Student holds a reservation for another bus (${otherBus?.bus_number || 'Bus ' + otherTrip?.departure_time}), not this trip.`
            };
          }
          return {
            success: false,
            code: 'NO_BOOKING',
            message: `No active reservation found for ${targetStudent.name} on this trip.`
          };
        }
      } 
      // MODE B: Manual Booking Reference Lookup Fallback
      else if (booking_reference) {
        const trimmedRef = String(booking_reference).trim().toUpperCase();
        targetBooking = database.bookings.find(
          b => b.booking_reference.toUpperCase() === trimmedRef
        );

        if (!targetBooking) {
          return {
            success: false,
            code: 'NO_BOOKING',
            message: `No booking found with reference ${trimmedRef}.`
          };
        }

        if (targetBooking.trip_id !== trip.id) {
          return {
            success: false,
            code: 'WRONG_TRIP',
            message: `Booking ${trimmedRef} belongs to a different bus trip.`
          };
        }

        targetStudent = database.users.find(u => u.id === targetBooking!.student_id);
      } else {
        return {
          success: false,
          code: 'SERVER_ERROR',
          message: 'Either QR identifier or booking reference must be provided.'
        };
      }

      // Check if booking was cancelled
      if (targetBooking.booking_status === 'CANCELLED') {
        return {
          success: false,
          code: 'BOOKING_CANCELLED',
          message: `Booking ${targetBooking.booking_reference} was cancelled on ${targetBooking.cancelled_at?.split('T')[0]}.`
        };
      }

      // Check duplicate boarding
      if (targetBooking.boarding_status === 'BOARDED') {
        const existingEvent = database.boarding_events.find(e => e.booking_id === targetBooking!.id);
        const boardedTime = existingEvent ? new Date(existingEvent.boarded_at).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }) : 'Earlier';

        return {
          success: false,
          code: 'ALREADY_BOARDED',
          message: `Passenger ${targetStudent?.name} has already boarded at ${boardedTime}.`,
          passenger: {
            student_name: targetStudent?.name || 'Student',
            student_email: targetStudent?.email,
            student_id_number: targetStudent?.student_id_number,
            booking_reference: targetBooking.booking_reference,
            seat_id: targetBooking.seat_id,
            bus_number: bus?.bus_number || trip.departure_time,
            route_name: route?.name || '',
            departure_time: trip.departure_time,
            boarded_at: existingEvent?.boarded_at || targetBooking.created_at,
            original_boarded_at: boardedTime
          }
        };
      }

      // ATOMICALLY RECORD BOARDING EVENT
      const nowIso = new Date().toISOString();
      targetBooking.boarding_status = 'BOARDED';

      const newBoardingEvent: BoardingEvent = {
        id: `bde_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        booking_id: targetBooking.id,
        student_id: targetStudent?.id || '',
        trip_id: trip.id,
        scanned_by_driver_id: driverUser.id,
        boarded_at: nowIso,
        method: method || (qr_identifier ? 'QR' : 'MANUAL')
      };

      database.boarding_events.push(newBoardingEvent);

      // Record boarding intimation log in audit trail
      if (targetStudent?.email) {
        database.email_logs.push({
          id: `eml_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          booking_id: targetBooking.id,
          recipient_email: targetStudent.email,
          recipient_name: targetStudent.name,
          subject: `CIT Booker — Boarding Confirmed for ${bus?.bus_number || 'Bus'} [${targetBooking.booking_reference}]`,
          body_preview: `Boarding verified for ${targetStudent.name} on ${bus?.bus_number || 'Bus'} (Seat ${targetBooking.seat_id}) by driver ${driverUser.name}.`,
          status: 'SENT',
          sent_at: nowIso,
          error_message: null
        });
      }

      return {
        success: true,
        code: 'VERIFIED',
        message: 'Boarding verified successfully. Passenger permitted to board.',
        passenger: {
          student_name: targetStudent?.name || 'Student',
          student_email: targetStudent?.email,
          student_id_number: targetStudent?.student_id_number,
          booking_reference: targetBooking.booking_reference,
          seat_id: targetBooking.seat_id,
          bus_number: bus?.bus_number || '',
          route_name: route?.name || '',
          departure_time: trip.departure_time,
          boarded_at: nowIso
        }
      };
    });

    if (verificationResult.success) {
      return res.status(200).json(verificationResult);
    } else {
      return res.status(400).json(verificationResult);
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: err.message || 'Internal verification failure.'
    } satisfies BoardingVerificationResult);
  }
});

// -------------------------------------------------------------
// ADMIN MANAGEMENT & AUDIT LOGS
// -------------------------------------------------------------

// Admin QR Management: Revoke or Regenerate
apiRouter.post('/admin/student-qr/revoke', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  const { student_id } = req.body;
  if (!student_id) {
    return res.status(400).json({ error: 'Student ID is required' });
  }

  const updated = db.transaction(database => {
    const qr = database.student_qr_identities.find(
      q => q.user_id === student_id && q.status === 'ACTIVE'
    );
    if (!qr) return null;

    qr.status = 'REVOKED';
    qr.revoked_at = new Date().toISOString();
    return qr;
  });

  if (!updated) {
    return res.status(404).json({ error: 'No active QR found for this student.' });
  }

  res.json({ success: true, message: 'QR Identity revoked.', qr_identity: updated });
});

apiRouter.post('/admin/student-qr/regenerate', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  const { student_id } = req.body;
  if (!student_id) {
    return res.status(400).json({ error: 'Student ID is required' });
  }

  const newQr = db.transaction(database => {
    // Revoke any existing active QR
    const existing = database.student_qr_identities.find(
      q => q.user_id === student_id && q.status === 'ACTIVE'
    );
    if (existing) {
      existing.status = 'REVOKED';
      existing.revoked_at = new Date().toISOString();
    }

    const opaqueToken = `CIT-QR-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
    const generated: StudentQRIdentity = {
      id: `qr_${Date.now()}`,
      user_id: student_id,
      opaque_qr_identifier: opaqueToken,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      revoked_at: null,
      regenerated_at: new Date().toISOString()
    };

    database.student_qr_identities.push(generated);
    return generated;
  });

  res.json({ success: true, message: 'New QR Identity generated successfully.', qr_identity: newQr });
});

// -------------------------------------------------------------
// BUS FLEET & BOARDING TELEMETRY ENDPOINTS
// -------------------------------------------------------------

// Get all buses enriched with route, active trip, booked vs. boarded stats, and passenger manifest
apiRouter.get('/buses', (_req: Request, res: Response) => {
  const currentDb = db.read();
  const todayStr = new Date().toISOString().split('T')[0];

  const enrichedBuses = currentDb.buses.map(bus => {
    // Find active trip for today
    const activeTrip = currentDb.trips.find(t => t.bus_id === bus.id && t.travel_date === todayStr) ||
                       currentDb.trips.find(t => t.bus_id === bus.id);

    const route = activeTrip 
      ? currentDb.routes.find(r => r.id === activeTrip.route_id)
      : currentDb.routes.find(r => r.route_number === bus.route_number || r.id === `route_${bus.bus_number}`);

    // If active trip exists, calculate live booked and boarded statistics
    let bookedCount = 0;
    let boardedCount = 0;
    let pendingCount = 0;
    let passengers: Array<any> = [];

    if (activeTrip) {
      const activeBookings = currentDb.bookings.filter(
        b => b.trip_id === activeTrip.id && b.booking_status === 'CONFIRMED'
      );
      bookedCount = activeBookings.length;
      boardedCount = activeBookings.filter(b => b.boarding_status === 'BOARDED').length;
      pendingCount = activeBookings.filter(b => b.boarding_status === 'NOT BOARDED').length;

      passengers = activeBookings.map(b => {
        const student = currentDb.users.find(u => u.id === b.student_id);
        const event = currentDb.boarding_events.find(e => e.booking_id === b.id);
        return {
          booking_id: b.id,
          booking_reference: b.booking_reference,
          student_id: b.student_id,
          student_name: student?.name || 'Student',
          student_email: student?.email || '',
          student_roll: student?.student_id_number || '',
          seat_id: b.seat_id,
          boarding_status: b.boarding_status,
          boarded_at: event?.boarded_at
        };
      });
    }

    return {
      ...bus,
      route,
      active_trip: activeTrip,
      booked_seats_count: bookedCount,
      boarded_seats_count: boardedCount,
      pending_boarding_count: pendingCount,
      passengers
    };
  });

  res.json({ buses: enrichedBuses });
});

// Admin/Authenticator Fleet: Create Bus with Route and Scheduled Trip
apiRouter.post('/buses', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'admin' && user.role !== 'driver')) {
    return res.status(403).json({ error: 'Authenticator / Administrator access required to add buses.' });
  }

  const { 
    bus_number, 
    bus_name, 
    capacity, 
    route_id, 
    new_route_name, 
    new_route_stops, 
    departure_time, 
    parking_bay, 
    assigned_driver_id 
  } = req.body;

  if (!bus_number) {
    return res.status(400).json({ error: 'Bus number is required.' });
  }

  const result = db.transaction(database => {
    let resolvedRouteId = route_id;

    // If new route details provided, create new route first
    if (!resolvedRouteId && new_route_name) {
      let stops: string[] = [];
      if (Array.isArray(new_route_stops)) {
        stops = new_route_stops;
      } else if (typeof new_route_stops === 'string') {
        stops = new_route_stops.split(',').map(s => s.trim()).filter(Boolean);
      }
      if (stops.length === 0) {
        stops = ['CIT Campus Terminal', 'Campus Main Gate'];
      }

      const cleanNum = parseInt(bus_number.replace(/\D/g, ''), 10) || database.routes.length + 1;
      const createdRoute: Route = {
        id: `route_${cleanNum}_${Date.now()}`,
        route_number: cleanNum,
        name: new_route_name.trim(),
        ordered_stops: stops,
        stop_details: stops.map((s, idx) => ({
          stop_name: s,
          time: idx === 0 ? 'Start' : idx === stops.length - 1 ? 'Campus' : 'En route'
        }))
      };
      database.routes.push(createdRoute);
      resolvedRouteId = createdRoute.id;
    } else if (!resolvedRouteId && database.routes.length > 0) {
      resolvedRouteId = database.routes[0].id;
    }

    const cleanBusNum = parseInt(bus_number.replace(/\D/g, ''), 10) || undefined;
    const newBus: Bus = {
      id: `bus_${Date.now()}`,
      bus_number: bus_number.trim(),
      route_number: cleanBusNum,
      bus_name: bus_name?.trim() || `Bus ${bus_number} Shuttle`,
      capacity: Number(capacity) || 32,
      layout: '2x2',
      is_active: true
    };
    database.buses.push(newBus);

    // Automatically schedule an active trip for today so students can immediately book seats ₹0
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const defaultTime = departure_time || '03:30 PM';
    // Enforce 1-driver-1-bus per day constraint
    let resolvedDriverId = assigned_driver_id;
    if (resolvedDriverId) {
      const conflictTrip = database.trips.find(
        t => t.assigned_driver_id === resolvedDriverId && t.travel_date === todayStr
      );
      if (conflictTrip) {
        const conflictBus = database.buses.find(b => b.id === conflictTrip.bus_id);
        const conflictDriver = database.users.find(u => u.id === resolvedDriverId);
        throw new Error(
          `Driver ${conflictDriver?.name || 'Selected driver'} is already associated with ${conflictBus?.bus_number || 'another bus'} today (${todayStr}). One driver can only be associated with one bus per day.`
        );
      }
    } else {
      // Pick the first available driver not yet assigned today
      const assignedToday = database.trips
        .filter(t => t.travel_date === todayStr)
        .map(t => t.assigned_driver_id);
      const availableDriver = database.users.find(
        u => u.role === 'driver' && !assignedToday.includes(u.id)
      );
      if (!availableDriver) {
        const nextNum = database.users.filter(u => u.role === 'driver').length + 1;
        const autoReserve: User = {
          id: `usr_driver_res_${Date.now()}`,
          name: `Driver Reserve ${nextNum} (Campus Shuttle)`,
          email: `driver.res${nextNum}@citchennai.net`,
          role: 'driver',
          is_verified: true,
          phone: `+91 9840${String(10000 + nextNum).slice(-5)}`,
          created_at: new Date().toISOString()
        };
        database.users.push(autoReserve);
        resolvedDriverId = autoReserve.id;
      } else {
        resolvedDriverId = availableDriver.id;
      }
    }

    const defaultBay = parking_bay || 'Bay 1';
    const newTrip: Trip = {
      id: `trip_${Date.now()}`,
      bus_id: newBus.id,
      route_id: resolvedRouteId,
      assigned_driver_id: resolvedDriverId,
      travel_date: todayStr,
      departure_time: defaultTime,
      departure_time_iso: new Date(now.getTime() + 90 * 60 * 1000).toISOString(),
      booking_window_opens_at: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
      booking_window_closes_at: new Date(now.getTime() + 180 * 60 * 1000).toISOString(),
      status: 'OPEN',
      parking_bay: defaultBay,
      notes: `Newly scheduled bus for ${defaultTime} departure batch. Route number ${cleanBusNum || bus_number} serves as bus number.`
    };
    database.trips.push(newTrip);

    return { bus: newBus, route: database.routes.find(r => r.id === resolvedRouteId), trip: newTrip };
  });

  res.status(201).json({ 
    success: true, 
    bus: result.bus, 
    route: result.route, 
    trip: result.trip,
    message: `Bus ${result.bus.bus_number} added successfully and open for student booking at ${result.trip.departure_time}!` 
  });
});

// Driver Reminder Dispatch: Send Boarding Reminders to Unboarded Passengers
apiRouter.post('/trips/:id/send-reminders', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'driver' && user.role !== 'admin')) {
    return res.status(403).json({ error: 'Only authorized drivers or administrators can dispatch boarding reminders.' });
  }

  const tripId = req.params.id;
  const { custom_message } = req.body;
  const currentDb = db.read();
  const trip = currentDb.trips.find(t => t.id === tripId);
  if (!trip) {
    return res.status(404).json({ error: 'Trip not found.' });
  }

  const bus = currentDb.buses.find(b => b.id === trip.bus_id);
  const route = currentDb.routes.find(r => r.id === trip.route_id);

  // Identify all confirmed bookings that have NOT yet boarded
  const unboardedBookings = currentDb.bookings.filter(
    b => b.trip_id === tripId && b.booking_status === 'CONFIRMED' && b.boarding_status === 'NOT BOARDED'
  );

  if (unboardedBookings.length === 0) {
    return res.json({ 
      success: true, 
      sent_count: 0, 
      message: 'All confirmed passengers have already boarded! No reminders needed.',
      recipients: [] 
    });
  }

  const now = new Date().toISOString();
  const recipients: Array<any> = [];

  db.transaction(database => {
    unboardedBookings.forEach(booking => {
      const student = database.users.find(u => u.id === booking.student_id);
      if (!student || !student.email) return;

      recipients.push({
        student_id: student.id,
        name: student.name,
        email: student.email,
        seat_id: booking.seat_id,
        booking_reference: booking.booking_reference,
        student_roll: student.student_id_number || ''
      });

      const emailSubject = `🚨 CIT Bus Boarding Reminder: Bus ${bus?.bus_number || ''} departing at ${trip.departure_time}`;
      const emailBody = custom_message || 
        `Dear ${student.name},\n\nYour CIT Campus Shuttle (Bus ${bus?.bus_number || ''} - ${route?.name || 'Campus Route'}) scheduled to depart at ${trip.departure_time} from ${trip.parking_bay} is CURRENTLY BOARDING.\n\nYour Reserved Seat: ${booking.seat_id}\nBooking Reference: ${booking.booking_reference}\n\nPlease proceed to the bus parking bay immediately and present your personal QR boarding pass to Driver ${user.name || ''}. The bus departs strictly on schedule.`;

      const emailLog: EmailLog = {
        id: `eml_remind_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        booking_id: booking.id,
        recipient_email: student.email,
        recipient_name: student.name,
        subject: emailSubject,
        body_preview: emailBody.substring(0, 160) + '...',
        status: 'SENT',
        sent_at: now,
        error_message: null
      };

      database.email_logs.push(emailLog);
    });
  });

  res.json({
    success: true,
    sent_count: recipients.length,
    message: `Urgent boarding reminders dispatched to ${recipients.length} unboarded passengers via Gmail intimation!`,
    recipients
  });
});

// Admin Routes: Create Route
apiRouter.post('/routes', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  const { name, ordered_stops } = req.body;
  if (!name || !ordered_stops || !ordered_stops.length) {
    return res.status(400).json({ error: 'Route name and ordered stops are required.' });
  }

  const newRoute = db.transaction(database => {
    const route = {
      id: `route_${Date.now()}`,
      name: name.trim(),
      ordered_stops: Array.isArray(ordered_stops) ? ordered_stops : ordered_stops.split(',').map((s: string) => s.trim())
    };
    database.routes.push(route);
    return route;
  });

  res.status(201).json({ route: newRoute });
});

// Admin Trips: Schedule New Trip
apiRouter.post('/trips', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  const { bus_id, route_id, assigned_driver_id, travel_date, departure_time, window_open_minutes_before, window_close_minutes_before, parking_bay, notes } = req.body;

  if (!bus_id || !route_id || !departure_time) {
    return res.status(400).json({ error: 'Bus, Route, and Departure time are required.' });
  }

  const todayStr = travel_date || new Date().toISOString().split('T')[0];
  const now = new Date();

  // Compute opening/closing ISOs
  const openOffset = (Number(window_open_minutes_before) || 120) * 60 * 1000;
  const closeOffset = (Number(window_close_minutes_before) || 10) * 60 * 1000;

  try {
    const newTrip = db.transaction(database => {
      let resolvedDriverId = assigned_driver_id;
      if (resolvedDriverId) {
        const conflictTrip = database.trips.find(
          t => t.assigned_driver_id === resolvedDriverId && t.travel_date === todayStr
        );
        if (conflictTrip) {
          const conflictBus = database.buses.find(b => b.id === conflictTrip.bus_id);
          const conflictDriver = database.users.find(u => u.id === resolvedDriverId);
          throw new Error(
            `Driver ${conflictDriver?.name || 'Selected driver'} is already associated with ${conflictBus?.bus_number || 'another bus'} on ${todayStr}. A driver can only be associated with one bus per day.`
          );
        }
      } else {
        const assignedToday = database.trips
          .filter(t => t.travel_date === todayStr)
          .map(t => t.assigned_driver_id);
        const availableDriver = database.users.find(
          u => u.role === 'driver' && !assignedToday.includes(u.id)
        );
        if (!availableDriver) {
          const nextNum = database.users.filter(u => u.role === 'driver').length + 1;
          const autoReserve: User = {
            id: `usr_driver_res_${Date.now()}`,
            name: `Driver Reserve ${nextNum} (Campus Shuttle)`,
            email: `driver.res${nextNum}@citchennai.net`,
            role: 'driver',
            is_verified: true,
            phone: `+91 9840${String(10000 + nextNum).slice(-5)}`,
            created_at: new Date().toISOString()
          };
          database.users.push(autoReserve);
          resolvedDriverId = autoReserve.id;
        } else {
          resolvedDriverId = availableDriver.id;
        }
      }

      const trip: Trip = {
        id: `trip_${Date.now()}`,
        bus_id,
        route_id,
        assigned_driver_id: resolvedDriverId,
        travel_date: todayStr,
        departure_time,
        departure_time_iso: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        booking_window_opens_at: new Date(now.getTime() - openOffset).toISOString(),
        booking_window_closes_at: new Date(now.getTime() + 180 * 60 * 1000).toISOString(),
        status: 'OPEN',
        parking_bay: parking_bay || 'Main Transit Bay',
        notes: notes || ''
      };
      database.trips.push(trip);
      return trip;
    });

    res.status(201).json({ trip: newTrip });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to schedule trip.' });
  }
});

// Email delivery logs & retry
apiRouter.get('/email-logs', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  const currentDb = db.read();
  res.json({ logs: currentDb.email_logs });
});

apiRouter.post('/email-logs/:id/retry', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  const logId = req.params.id;
  const updated = db.transaction(database => {
    const log = database.email_logs.find(l => l.id === logId);
    if (log) {
      log.status = 'SENT';
      log.error_message = null;
      log.sent_at = new Date().toISOString();
    }
    return log;
  });

  res.json({ success: true, log: updated });
});

// System Settings
apiRouter.get('/settings', (_req: Request, res: Response) => {
  const currentDb = db.read();
  res.json({ settings: currentDb.settings });
});

apiRouter.patch('/settings', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  const { restrict_email_domain, allowed_domain } = req.body;

  const updated = db.transaction(database => {
    if (typeof restrict_email_domain === 'boolean') {
      database.settings.restrict_email_domain = restrict_email_domain;
    }
    if (allowed_domain) {
      database.settings.allowed_domain = allowed_domain.trim();
    }
    return database.settings;
  });

  res.json({ settings: updated });
});

// Admin Reset Demo Data
apiRouter.post('/admin/reset-demo', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  const fresh = db.resetToSeed();
  res.json({ success: true, message: 'Database reset to initial demo state.' });
});

// -------------------------------------------------------------
// DAILY BUS IDENTIFICATION MAP ENDPOINTS
// -------------------------------------------------------------

const DEFAULT_MAP_IMAGE = '/assets/aistudio/WhatsApp_Image_2026-10-20_at_4.19.25_PM_4a42e03a.jpeg';

// Get today's bus identification map
apiRouter.get('/bus-map', (_req: Request, res: Response) => {
  const currentDb = db.read();
  let busMap = currentDb.bus_map;
  if (!busMap) {
    const todayStr = new Date().toISOString().split('T')[0];
    busMap = {
      id: 'cit_bus_map_today',
      image_url: DEFAULT_MAP_IMAGE,
      title: 'CIT Campus Bus Identification & Parking Bay Allocation Map',
      effective_date: todayStr,
      updated_at: new Date().toISOString(),
      updated_by_name: 'Campus Transport Authenticator',
      updated_by_email: 'transport@citchennai.net',
      notes: 'Official campus parking bay layout and bus identification numbers for today. Reminder: Route numbers are used as bus numbers. Check your allocated parking bay before boarding.',
      version: 1
    };
    db.transaction(database => {
      database.bus_map = busMap;
    });
  }
  res.json({ bus_map: busMap });
});

// Update today's bus identification map (Authenticator / Admin role)
apiRouter.post('/bus-map', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || (user.role !== 'admin' && user.role !== 'driver')) {
    return res.status(403).json({ error: 'Authenticator / Administrator access required to update the daily map.' });
  }

  const { image_url, title, effective_date, notes, updated_by_name } = req.body;

  if (!image_url && !title && !notes && !effective_date) {
    return res.status(400).json({ error: 'At least one field is required.' });
  }

  const updatedMap = db.transaction(database => {
    const prev = database.bus_map || {
      id: 'cit_bus_map_today',
      image_url: DEFAULT_MAP_IMAGE,
      title: 'CIT Campus Bus Identification & Parking Bay Allocation Map',
      effective_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
      updated_by_name: user.name || 'Campus Authenticator',
      updated_by_email: user.email,
      notes: '',
      version: 1
    };

    database.bus_map = {
      ...prev,
      image_url: image_url ? image_url.trim() : prev.image_url,
      title: title ? title.trim() : prev.title,
      effective_date: effective_date ? effective_date.trim() : (prev.effective_date || new Date().toISOString().split('T')[0]),
      notes: notes !== undefined ? notes.trim() : prev.notes,
      updated_at: new Date().toISOString(),
      updated_by_name: updated_by_name?.trim() || user.name || 'Campus Transport Authenticator',
      updated_by_email: user.email,
      version: (prev.version || 1) + 1
    };

    return database.bus_map;
  });

  res.json({ success: true, bus_map: updatedMap });
});

// Reset to default example map
apiRouter.post('/bus-map/reset', (req: Request, res: Response) => {
  const user = getAuthUser(req);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Administrator access required.' });
  }

  const resetMap = db.transaction(database => {
    database.bus_map = {
      id: 'cit_bus_map_today',
      image_url: DEFAULT_MAP_IMAGE,
      title: 'CIT Campus Bus Identification & Parking Bay Allocation Map',
      effective_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
      updated_by_name: 'Campus Transport Authenticator (Transport Office)',
      updated_by_email: 'transport@citchennai.net',
      notes: 'Official campus parking bay layout and bus identification numbers for today. Reminder: Route numbers are used as bus numbers. Check your allocated parking bay before boarding.',
      version: 1
    };
    return database.bus_map;
  });

  res.json({ success: true, bus_map: resetMap });
});
