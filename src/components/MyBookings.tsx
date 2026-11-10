import React, { useState, useEffect, useMemo } from 'react';
import { Booking } from '../types/index.ts';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useGmail } from '../context/GmailContext.tsx';
import { 
  Bus, 
  Clock, 
  MapPin, 
  QrCode, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  Mail, 
  Loader2,
  Calendar,
  FileText,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Ticket
} from 'lucide-react';

interface MyBookingsProps {
  onBackToBuses: () => void;
  onOpenQR: () => void;
}

export const MyBookings: React.FC<MyBookingsProps> = ({ onBackToBuses, onOpenQR }) => {
  const { user, qrIdentity } = useAuth();
  const { isConnected, googleUser, connectGmail, sendBookingConfirmation } = useGmail();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Tab filter: 'all' | 'active' | 'previous'
  const [selectedTab, setSelectedTab] = useState<'all' | 'active' | 'previous'>('all');
  // Selected booking for detailed boarding certificate modal
  const [selectedReceiptBooking, setSelectedReceiptBooking] = useState<Booking | null>(null);
  // Expanded boarding details card
  const [expandedDetailsId, setExpandedDetailsId] = useState<string | null>(null);

  const loadBookings = async () => {
    try {
      setIsLoading(true);
      const data = await api.getMyBookings();
      setBookings(data.bookings);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  // Classify bookings into active/upcoming vs previous/completed
  const { activeBookings, previousBookings, boardedCount } = useMemo(() => {
    const active: Booking[] = [];
    const previous: Booking[] = [];
    let boarded = 0;

    bookings.forEach(b => {
      const isBoarded = b.boarding_status === 'BOARDED';
      const isCancelled = b.booking_status === 'CANCELLED';
      const tripDate = b.trip?.travel_date || '';
      const isPastDate = tripDate && tripDate < todayStr;
      const isTripCompleted = b.trip?.status === 'COMPLETED' || b.trip?.status === 'DEPARTED';

      if (isBoarded) boarded++;

      // Previous if boarded, cancelled, past date, or trip completed
      if (isBoarded || isCancelled || isPastDate || isTripCompleted) {
        previous.push(b);
      } else {
        active.push(b);
      }
    });

    return { activeBookings: active, previousBookings: previous, boardedCount: boarded };
  }, [bookings, todayStr]);

  const displayedBookings = useMemo(() => {
    if (selectedTab === 'active') return activeBookings;
    if (selectedTab === 'previous') return previousBookings;
    return bookings;
  }, [selectedTab, activeBookings, previousBookings, bookings]);

  const handleCancelBooking = async (bookingId: string) => {
    setCancellingId(bookingId);
    setFeedbackMessage(null);
    try {
      await api.cancelBooking(bookingId);
      setFeedbackMessage({ type: 'success', text: 'Booking cancelled and seat released back to bus inventory.' });
      setConfirmCancelId(null);
      await loadBookings();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Cancellation failed.' });
    } finally {
      setCancellingId(null);
    }
  };

  const handleResendGmail = async (booking: Booking) => {
    if (!user || !booking.trip) return;
    setResendingId(booking.id);
    setFeedbackMessage(null);
    try {
      if (!isConnected) {
        const conn = await connectGmail();
        if (!conn.success) {
          if (!conn.cancelled && conn.error) {
            setFeedbackMessage({
              type: 'error',
              text: 'Google connection: ' + conn.error
            });
          }
          setResendingId(null);
          return;
        }
      }
      const recipientEmail = googleUser?.email || user.email;
      const qrToken = qrIdentity?.opaque_qr_identifier || `CIT-QR-${user.student_id_number || user.id}`;

      const res = await sendBookingConfirmation({
        studentName: user.name,
        studentEmail: recipientEmail,
        studentIdNumber: user.student_id_number,
        bookingReference: booking.booking_reference,
        seatId: booking.seat_id,
        busNumber: booking.trip.bus?.bus_number || 'Bus',
        busName: booking.trip.bus?.bus_name,
        routeName: booking.trip.route?.name || 'CIT Campus Route',
        departureTime: booking.trip.departure_time,
        parkingBay: booking.trip.parking_bay || 'Main Terminal',
        qrIdentifier: qrToken
      });

      if (res.success) {
        setFeedbackMessage({ 
          type: 'success', 
          text: `Booking confirmation pass with personal QR code successfully sent to Gmail (${recipientEmail})!` 
        });
      } else {
        setFeedbackMessage({ 
          type: 'error', 
          text: res.error || 'Failed to dispatch Gmail message. Please verify Google permissions.' 
        });
      }
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: err.message || 'Error sending to Gmail' });
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Breadcrumb & Action */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBackToBuses}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Today's Buses</span>
        </button>
        <button
          onClick={onOpenQR}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200/50 cursor-pointer"
        >
          <QrCode className="w-4 h-4" />
          <span>Open My Boarding Pass</span>
        </button>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          My Bus Bookings & Boarding Details
        </h1>
        <p className="text-sm text-slate-600">
          Review your scheduled campus shuttle seat reservations, previous travel records, and official driver boarding verifications.
        </p>
      </div>

      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-medium mb-6 border ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {feedbackMessage.text}
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500">Total Bookings</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {bookings.length}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">All time on CIT portal</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
          <div className="text-[11px] font-semibold text-emerald-700">Boarded & Verified</div>
          <div className="text-2xl font-bold font-mono text-emerald-800 mt-1">
            {boardedCount}
          </div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Scanned by drivers</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-xs">
          <div className="text-[11px] font-semibold text-blue-700">Active Upcoming</div>
          <div className="text-2xl font-bold font-mono text-blue-800 mt-1">
            {activeBookings.length}
          </div>
          <div className="text-[10px] text-blue-600 mt-0.5">Ready for departure</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-[11px] font-semibold text-slate-500">Attendance Rate</div>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {bookings.length > 0 ? Math.round((boardedCount / bookings.length) * 100) : 100}%
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Verified campus journeys</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/60 rounded-xl overflow-x-auto text-xs font-semibold mb-6 w-fit">
        <button
          onClick={() => setSelectedTab('all')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
            selectedTab === 'all'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          All Bookings ({bookings.length})
        </button>
        <button
          onClick={() => setSelectedTab('active')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
            selectedTab === 'active'
              ? 'bg-white text-blue-700 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Active & Upcoming ({activeBookings.length})
        </button>
        <button
          onClick={() => setSelectedTab('previous')}
          className={`px-3.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
            selectedTab === 'previous'
              ? 'bg-white text-slate-900 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Previous Bookings & Boarding Details ({previousBookings.length})
        </button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-600">Loading your reservations and boarding details...</p>
        </div>
      ) : displayedBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Bus className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {selectedTab === 'previous' ? 'No Previous Travel History' : selectedTab === 'active' ? 'No Active Reservations' : 'No Bookings Found'}
          </h3>
          <p className="text-xs text-slate-500 mb-6 max-w-md mx-auto">
            {selectedTab === 'previous' 
              ? 'Once you complete your campus shuttle journeys and board via QR scanner, your verified boarding timestamps and travel details will be archived here.'
              : 'You do not have any upcoming shuttle reservations for today. Explore today’s campus departures to reserve your free seat.'}
          </p>
          <button
            onClick={onBackToBuses}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
          >
            Explore Today's Buses
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedBookings.map(booking => {
            const isConfirmed = booking.booking_status === 'CONFIRMED';
            const isBoarded = booking.boarding_status === 'BOARDED';
            const isExpanded = expandedDetailsId === booking.id;
            const tripDate = booking.trip?.travel_date;
            const isPast = tripDate && tripDate < todayStr;
            const event = booking.boarding_event;

            return (
              <div
                key={booking.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all overflow-hidden"
              >
                <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                  {/* Left: Booking & Journey Details */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono font-bold text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200/50">
                        {booking.booking_reference}
                      </span>
                      
                      {tripDate && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          <span>{tripDate === todayStr ? 'Today' : tripDate}</span>
                        </span>
                      )}

                      <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        Seat {booking.seat_id}
                      </span>
                      
                      <span className="text-xs font-semibold text-slate-800">
                        {booking.trip?.bus?.bus_number} ({booking.trip?.bus?.bus_name})
                      </span>

                      {/* Booking Status Badge */}
                      {isConfirmed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> CONFIRMED (₹0)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                          <XCircle className="w-3 h-3" /> CANCELLED
                        </span>
                      )}

                      {/* Boarding Status Badge */}
                      {isConfirmed && (
                        isBoarded ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>BOARDED & VERIFIED</span>
                          </span>
                        ) : isPast ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                            <Clock className="w-3.5 h-3.5" />
                            <span>NOT BOARDED (PAST)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>AWAITING BOARDING</span>
                          </span>
                        )
                      )}
                    </div>

                    {/* Route & Departure Times */}
                    <div className="text-xs text-slate-700 flex flex-wrap items-center gap-2 font-medium">
                      <div className="flex items-center gap-1 text-slate-800">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{booking.trip?.route?.name || 'CIT Campus Route'}</span>
                      </div>
                      <span className="text-slate-300">·</span>
                      <span className="font-semibold text-blue-700 font-mono">
                        Departure: {booking.trip?.departure_time}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-600">
                        Terminal: <strong className="text-slate-800">{booking.trip?.parking_bay || 'Main Transit Bay'}</strong>
                      </span>
                    </div>

                    {/* Booking timestamp & Driver */}
                    <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-2">
                      <span>
                        Reserved: {new Date(booking.created_at).toLocaleDateString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {booking.trip?.driver && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1 text-slate-700">
                            <UserCheck className="w-3 h-3 text-slate-400" />
                            <span>Driver: <strong>{booking.trip.driver.name}</strong></span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* View Boarding Details / Receipt Toggle */}
                    <button
                      type="button"
                      onClick={() => setExpandedDetailsId(isExpanded ? null : booking.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      <span>{isExpanded ? 'Hide Boarding Details' : 'Boarding Details'}</span>
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {/* Certificate Receipt Trigger */}
                    {isBoarded && (
                      <button
                        type="button"
                        onClick={() => setSelectedReceiptBooking(booking)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 shadow-2xs transition-colors cursor-pointer"
                        title="View official digital boarding pass receipt"
                      >
                        <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Boarding Pass Receipt</span>
                      </button>
                    )}

                    {isConfirmed && !isBoarded && !isPast && (
                      <>
                        {confirmCancelId === booking.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setConfirmCancelId(null)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
                            >
                              Keep Seat
                            </button>
                            <button
                              disabled={cancellingId === booking.id}
                              onClick={() => handleCancelBooking(booking.id)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-700 text-white shadow-2xs cursor-pointer"
                            >
                              {cancellingId === booking.id ? 'Releasing...' : 'Yes, Cancel'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmCancelId(booking.id)}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            Cancel Seat
                          </button>
                        )}

                        <button
                          onClick={() => handleResendGmail(booking)}
                          disabled={resendingId === booking.id}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                          title="Send booking registration pass & QR image to your Gmail"
                        >
                          {resendingId === booking.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          ) : (
                            <Mail className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{resendingId === booking.id ? 'Sending...' : 'Email QR Pass'}</span>
                        </button>

                        <button
                          onClick={onOpenQR}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>Show Boarding Pass</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expandable Boarding Details Panel */}
                {isExpanded && (
                  <div className="bg-slate-50/90 border-t border-slate-200 p-5 space-y-4 text-xs animate-in fade-in duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <span className="font-bold text-slate-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span>Comprehensive Boarding & Journey Manifest Details</span>
                      </span>
                      <span className="font-mono text-slate-500 text-[11px]">
                        Ref #{booking.booking_reference}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Boarding Status Card */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                          Official Boarding Status
                        </span>
                        {isBoarded ? (
                          <div className="flex items-center gap-1.5 text-emerald-700 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Verified Boarded</span>
                          </div>
                        ) : isPast ? (
                          <div className="flex items-center gap-1.5 text-slate-600 font-bold">
                            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                            <span>Did Not Board (Absent)</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-700 font-bold">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Awaiting Boarding at Bay</span>
                          </div>
                        )}
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {isBoarded ? 'Attendance confirmed by driver' : 'Pass active for scan'}
                        </span>
                      </div>

                      {/* Boarding Timestamp Card */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                          Boarding Verification Time
                        </span>
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {event?.boarded_at
                            ? new Date(event.boarded_at).toLocaleTimeString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              }) + ' (IST)'
                            : isBoarded
                            ? 'Prior departure'
                            : 'Pending verification'}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          {event?.boarded_at
                            ? new Date(event.boarded_at).toLocaleDateString('en-IN', {
                                timeZone: 'Asia/Kolkata',
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })
                            : 'Logged on physical scan'}
                        </span>
                      </div>

                      {/* Verification Method Card */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                          Verification Method
                        </span>
                        <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                          <QrCode className="w-3.5 h-3.5 text-blue-600" />
                          <span>{event?.method === 'MANUAL' ? 'Driver Manual PIN' : 'Personal QR Pass'}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block font-mono">
                          Token: {qrIdentity?.opaque_qr_identifier ? qrIdentity.opaque_qr_identifier.substring(0, 16) + '...' : 'CIT-QR-ENCRYPTED'}
                        </span>
                      </div>

                      {/* Verified By Driver Card */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
                        <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                          Verified By Driver
                        </span>
                        <div className="font-semibold text-slate-900 truncate" title={event?.scanned_by_driver_name || booking.trip?.driver?.name}>
                          {event?.scanned_by_driver_name || booking.trip?.driver?.name || 'CIT Shuttle Driver'}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Bus {booking.trip?.bus?.bus_number} Operator
                        </span>
                      </div>
                    </div>

                    {/* Route Stops Sequence */}
                    {booking.trip?.route?.ordered_stops && (
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                        <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                          Route Transit Sequence:
                        </span>
                        <div className="flex flex-wrap items-center gap-1 text-[11px] text-slate-700">
                          {booking.trip.route.ordered_stops.map((stop, sIdx) => (
                            <React.Fragment key={sIdx}>
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium">
                                {stop}
                              </span>
                              {sIdx < (booking.trip?.route?.ordered_stops?.length || 0) - 1 && (
                                <span className="text-slate-300">→</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>
      )}

      {/* Official Boarding Verification Receipt Modal */}
      {selectedReceiptBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Header */}
            <div className="p-6 bg-linear-to-r from-blue-700 to-indigo-800 text-white relative">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-bold tracking-wider uppercase text-blue-200 block mb-0.5">
                    Chennai Institute of Technology
                  </span>
                  <h3 className="text-base font-bold text-white">
                    Official Boarding Receipt & Pass
                  </h3>
                  <p className="text-xs text-blue-100 mt-0.5">
                    Transport Bureau · Verified Journey Record
                  </p>
                </div>
                <button
                  onClick={() => setSelectedReceiptBooking(null)}
                  className="text-white/80 hover:text-white text-sm font-bold p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Verified Badge */}
              <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-100 border border-emerald-400/40">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>BOARDING VERIFIED & RECORDED</span>
              </div>
            </div>

            {/* Receipt Body */}
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-500 block text-[11px]">Passenger Name:</span>
                  <strong className="text-slate-900">{user?.name}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Student Roll No:</span>
                  <strong className="text-slate-900 font-mono">{user?.student_id_number || '22CIT042'}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-100">
                <div>
                  <span className="text-slate-500 block text-[11px]">Booking Reference:</span>
                  <strong className="text-blue-600 font-mono text-sm">{selectedReceiptBooking.booking_reference}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Reserved Seat:</span>
                  <strong className="text-slate-900 font-mono text-sm">Seat {selectedReceiptBooking.seat_id}</strong>
                </div>
              </div>

              <div className="space-y-2 pb-3 border-b border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Bus & Fleet:</span>
                  <strong className="text-slate-800">
                    {selectedReceiptBooking.trip?.bus?.bus_number} ({selectedReceiptBooking.trip?.bus?.bus_name})
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Route:</span>
                  <span className="text-slate-800 font-medium text-right max-w-[220px] truncate">
                    {selectedReceiptBooking.trip?.route?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Scheduled Departure:</span>
                  <strong className="text-blue-600 font-mono">{selectedReceiptBooking.trip?.departure_time}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Parking Bay:</span>
                  <strong className="text-slate-800">{selectedReceiptBooking.trip?.parking_bay || 'Bay 1'}</strong>
                </div>
              </div>

              {/* Boarding Verification Audit Trail */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Audit Verification Details</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Boarding Method:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedReceiptBooking.boarding_event?.method === 'MANUAL' ? 'Driver Manual PIN' : 'Personal Dynamic QR Scan'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Verified By:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedReceiptBooking.boarding_event?.scanned_by_driver_name || selectedReceiptBooking.trip?.driver?.name || 'Muthukumar P.'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Recorded At:</span>
                  <span className="font-mono text-slate-800">
                    {selectedReceiptBooking.boarding_event?.boarded_at
                      ? new Date(selectedReceiptBooking.boarding_event.boarded_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                      : 'Verified on Boarding'}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedReceiptBooking(null)}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors cursor-pointer"
              >
                Close Receipt
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
