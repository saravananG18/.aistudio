import React, { useState, useEffect } from 'react';
import { Trip, TripStatus, Booking } from '../types/index.ts';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { Bus, Clock, MapPin, Users, Calendar, Filter, ArrowRight, ShieldCheck, AlertCircle, Search, Lock } from 'lucide-react';

interface StudentDashboardProps {
  onSelectTrip: (tripId: string) => void;
  onOpenQR: () => void;
  onNavigateMyBookings: () => void;
  onOpenBusMap?: () => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ 
  onSelectTrip, 
  onOpenQR, 
  onNavigateMyBookings,
  onOpenBusMap 
}) => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [recentPreviousBooking, setRecentPreviousBooking] = useState<Booking | null>(null);

  const loadTrips = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [tripsData, myBookingsData] = await Promise.all([
        api.getTrips({
          date: selectedDate,
          status: statusFilter
        }),
        api.getMyBookings().catch(() => ({ bookings: [] }))
      ]);
      setTrips(tripsData.trips);
      
      // Find latest boarded or previous booking
      const previous = myBookingsData.bookings.find(
        b => b.boarding_status === 'BOARDED' || b.trip?.status === 'COMPLETED'
      ) || (myBookingsData.bookings.length > 0 ? myBookingsData.bookings[0] : null);
      setRecentPreviousBooking(previous || null);
    } catch (err) {
      if (!silent) console.error('Failed to load trips:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTrips(false);
    // Real-time background sync: poll every 2.5 seconds so admin status changes (OPEN / CLOSED) reflect immediately
    const pollInterval = setInterval(() => {
      loadTrips(true);
    }, 2500);

    const onFocus = () => loadTrips(true);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', onFocus);
    };
  }, [statusFilter, selectedDate]);

  const getStatusBadge = (status: TripStatus) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
            OPEN FOR BOOKING
          </span>
        );
      case 'NOT YET OPEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            NOT YET OPEN
          </span>
        );
      case 'FULL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            FULL (0 SEATS)
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <Lock className="w-3 h-3 text-rose-600" />
            BOOKING CLOSED
          </span>
        );
      case 'DEPARTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-500 border border-slate-200">
            BUS DEPARTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  // Filter trips by search query (bus number, route name, or any boarding stop name)
  const filteredTrips = trips.filter(trip => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const busMatch = trip.bus?.bus_number.toLowerCase().includes(query) || trip.bus?.bus_name.toLowerCase().includes(query);
    const routeMatch = trip.route?.name.toLowerCase().includes(query);
    const stopsMatch = trip.route?.ordered_stops.some(stop => stop.toLowerCase().includes(query));
    return busMatch || routeMatch || stopsMatch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Welcome Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 mb-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Chennai Institute of Technology — Campus Buses
            </h1>
            <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2.5 py-0.5 rounded-md border border-blue-200/50">
              All Seats ₹0
            </span>
          </div>
          <p className="text-sm text-slate-600 max-w-2xl">
            Welcome, <span className="font-semibold text-slate-900">{user?.name}</span>. Reserve your seat on official Chennai Institute of Technology (CIT Chennai) buses. Route numbers serve as bus numbers.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onOpenBusMap && (
            <button
              onClick={onOpenBusMap}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors shadow-2xs cursor-pointer"
              title="View today's campus parking bay allocation and bus map"
            >
              <MapPin className="w-4 h-4 text-amber-600" />
              <span>Daily Bus Map</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </button>
          )}
          <button
            onClick={onNavigateMyBookings}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
          >
            My Bookings
          </button>
          <button
            onClick={onOpenQR}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-xs"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>My Boarding Pass</span>
          </button>
        </div>
      </div>

      {/* Previous Travel & Boarding Details Ribbon */}
      {recentPreviousBooking && (
        <div className="bg-linear-to-r from-blue-50/80 via-indigo-50/50 to-emerald-50/40 border border-blue-200/80 rounded-2xl p-4 sm:p-5 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-xs shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-900">
                  Previous Travel & Boarding Record:
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {recentPreviousBooking.boarding_status === 'BOARDED' ? '✓ Verified Boarded' : recentPreviousBooking.boarding_status}
                </span>
                <span className="text-[11px] font-mono font-semibold text-blue-700">
                  #{recentPreviousBooking.booking_reference}
                </span>
                {recentPreviousBooking.trip?.travel_date && (
                  <span className="text-[11px] text-slate-500 font-medium">
                    ({recentPreviousBooking.trip.travel_date})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Shuttle: <strong className="text-slate-800">{recentPreviousBooking.trip?.bus?.bus_number}</strong> ({recentPreviousBooking.trip?.bus?.bus_name}) · Seat <strong className="text-slate-800">{recentPreviousBooking.seat_id}</strong> · Route: {recentPreviousBooking.trip?.route?.name}
                {recentPreviousBooking.boarding_event?.boarded_at && (
                  <span className="text-slate-500 ml-1">
                    · Boarded at {new Date(recentPreviousBooking.boarding_event.boarded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} (Driver: {recentPreviousBooking.boarding_event.scanned_by_driver_name || recentPreviousBooking.trip?.driver?.name || 'Verified'})
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onNavigateMyBookings}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-blue-700 bg-white hover:bg-blue-50 border border-blue-200 rounded-xl transition-colors shadow-2xs shrink-0 cursor-pointer"
          >
            <span>View All Boarding Details</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-4 mb-6">
        
        {/* Search Input for Boarding Stop / Bus Number */}
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search boarding stop (e.g. Wimco Nagar, Velachery, Adyar)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-xl overflow-x-auto text-xs font-medium">
            {['ALL', 'OPEN', 'NOT YET OPEN', 'FULL', 'CLOSED', 'DEPARTED'].map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status === 'ALL' ? 'All Buses' : status}
              </button>
            ))}
          </div>

          {/* Date selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Trips Grid */}
      {isLoading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading Chennai Institute of Technology bus schedule...</p>
        </div>
      ) : filteredTrips.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500">
          <Bus className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-base font-semibold text-slate-800 mb-1">No buses match the query or filter</p>
          <p className="text-xs text-slate-500">Try searching for a different boarding stop (e.g. "Porur", "Velachery", "Adyar") or reset filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTrips.map(trip => {
            const isOpen = trip.status === 'OPEN';
            return (
              <div
                key={trip.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top line: Bus Number (Route Number) + Status */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-base text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200/50">
                          {trip.bus?.bus_number}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {trip.bus?.bus_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold mt-1">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span>First Pickup: {trip.departure_time}</span>
                      </div>
                    </div>
                    {getStatusBadge(trip.status)}
                  </div>

                  {/* Route & Ordered Stops with Timings */}
                  <div className="my-4 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                    <div className="font-semibold text-slate-800 mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{trip.route?.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {trip.route?.ordered_stops.length} stops
                      </span>
                    </div>

                    {/* Timeline of key stops */}
                    <div className="space-y-1.5 text-[11px] text-slate-600 max-h-32 overflow-y-auto pr-1">
                      {trip.route?.stop_details && trip.route.stop_details.length > 0 ? (
                        trip.route.stop_details.map((stop, sIdx) => (
                          <div key={sIdx} className="flex justify-between items-center py-0.5 border-b border-slate-200/40 last:border-b-0">
                            <span className="font-medium text-slate-800 truncate mr-2">
                              {sIdx + 1}. {stop.stop_name}
                            </span>
                            <span className="font-mono text-blue-600 shrink-0 font-semibold">
                              {stop.time}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-slate-500">
                          {trip.route?.ordered_stops.join(' → ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seat Capacities Strip */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-100 text-center mb-4">
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Capacity</div>
                      <div className="text-sm font-bold text-slate-900 font-mono tabular-nums">
                        {trip.total_seats}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Booked</div>
                      <div className="text-sm font-bold text-slate-700 font-mono tabular-nums">
                        {trip.booked_seats_count}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 font-medium">Available</div>
                      <div className={`text-sm font-bold font-mono tabular-nums ${
                        (trip.remaining_seats_count || 0) > 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {trip.remaining_seats_count}
                      </div>
                    </div>
                  </div>

                  {/* Parking bay info */}
                  <div className="text-[11px] text-slate-500 mb-3 flex items-center justify-between">
                    <span>CIT Campus Terminal:</span>
                    <span className="font-medium text-slate-700">{trip.parking_bay}</span>
                  </div>

                  {/* Notice if booking is closed by administrator */}
                  {trip.status === 'CLOSED' && (
                    <div className="mb-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-800 flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span>Bookings closed by Transport Admin. Schedule and stops are visible.</span>
                    </div>
                  )}
                </div>

                {/* Action button */}
                <button
                  disabled={!isOpen}
                  onClick={() => onSelectTrip(trip.id)}
                  className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-xs ${
                    isOpen
                      ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                      : 'bg-slate-100 text-slate-500 border border-slate-200 cursor-not-allowed'
                  }`}
                >
                  {!isOpen && <Lock className="w-3.5 h-3.5 text-slate-400" />}
                  <span>
                    {isOpen
                      ? 'Select Seat & Book (₹0)'
                      : trip.status === 'CLOSED'
                      ? 'Booking Closed by Administrator'
                      : trip.status === 'NOT YET OPEN'
                      ? 'Booking Opens Soon'
                      : trip.status === 'FULL'
                      ? 'Bus Is Full'
                      : 'Bus Departed'}
                  </span>
                  {isOpen && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
