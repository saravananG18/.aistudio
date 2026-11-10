import React, { useState, useEffect } from 'react';
import { Trip } from '../types/index.ts';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useGmail } from '../context/GmailContext.tsx';
import { Bus, Clock, MapPin, CheckCircle, AlertCircle, Sparkles, QrCode, Mail, CheckCheck, Loader2 } from 'lucide-react';

interface SeatMapModalProps {
  tripId: string;
  onClose: () => void;
  onBookingSuccess: () => void;
  onOpenQR: () => void;
}

export const SeatMapModal: React.FC<SeatMapModalProps> = ({ tripId, onClose, onBookingSuccess, onOpenQR }) => {
  const { user, qrIdentity } = useAuth();
  const { isConnected, googleUser, connectGmail, sendBookingConfirmation } = useGmail();
  const [tripDetail, setTripDetail] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ status: 'sent' | 'pending' | 'failed' | 'not_connected'; email?: string } | null>(null);
  const [isSendingManualEmail, setIsSendingManualEmail] = useState(false);

  const loadDetails = async () => {
    try {
      setIsLoading(true);
      const data = await api.getTripDetails(tripId);
      setTripDetail(data.trip);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load bus details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
    // Real-time seat updates: poll every 2 seconds while modal is open
    const pollInterval = setInterval(async () => {
      try {
        const data = await api.getTripDetails(tripId);
        setTripDetail(data.trip);

        // If currently selected seat was claimed by another student, clear selection and alert
        if (selectedSeat && data.trip?.seat_map) {
          const seatObj = data.trip.seat_map.find((s: any) => s.seat_id === selectedSeat);
          if (seatObj && seatObj.is_booked) {
            setSelectedSeat(null);
            setShowConfirm(false);
            setErrorMessage(`Seat ${selectedSeat} was just booked by another student.`);
          }
        }
      } catch {
        // ignore background poll errors
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [tripId, selectedSeat]);

  const handleSeatClick = (seatId: string, isBooked: boolean) => {
    if (isBooked || tripDetail?.status !== 'OPEN') return;
    setSelectedSeat(prev => (prev === seatId ? null : seatId));
    setErrorMessage(null);
  };

  const dispatchGmailConfirmation = async (bookingRef: string, seatId: string) => {
    if (!user || !tripDetail) return;
    const recipientEmail = googleUser?.email || user.email;
    const qrToken = qrIdentity?.opaque_qr_identifier || `CIT-QR-${user.student_id_number || user.id}`;

    if (isConnected) {
      setEmailStatus({ status: 'pending', email: recipientEmail });
      try {
        const emailRes = await sendBookingConfirmation({
          studentName: user.name,
          studentEmail: recipientEmail,
          studentIdNumber: user.student_id_number,
          bookingReference: bookingRef,
          seatId: seatId,
          busNumber: tripDetail.bus?.bus_number || 'Bus',
          busName: tripDetail.bus?.bus_name,
          routeName: tripDetail.route?.name || 'CIT Campus Route',
          departureTime: tripDetail.departure_time,
          parkingBay: tripDetail.parking_bay || 'Main Terminal',
          qrIdentifier: qrToken
        });

        if (emailRes.success) {
          setEmailStatus({ status: 'sent', email: recipientEmail });
        } else {
          setEmailStatus({ status: 'failed', email: recipientEmail });
        }
      } catch (err) {
        console.error('Failed to dispatch Gmail:', err);
        setEmailStatus({ status: 'failed', email: recipientEmail });
      }
    } else {
      setEmailStatus({ status: 'not_connected', email: recipientEmail });
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSeat || !tripDetail) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await api.createBooking(tripDetail.id, selectedSeat);
      setConfirmedBooking(res);
      onBookingSuccess();

      // Dispatch real Gmail message with embedded QR code
      await dispatchGmailConfirmation(res.booking.booking_reference, selectedSeat);
    } catch (err: any) {
      setErrorMessage(err.message || 'Seat could not be reserved. It may have just been claimed.');
      // Refresh seat map to reflect updated concurrent claims
      loadDetails();
      setShowConfirm(false);
      setSelectedSeat(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Connect Gmail after booking and send immediately
  const handleConnectAndSend = async () => {
    if (!confirmedBooking) return;
    setIsSendingManualEmail(true);
    try {
      const res = await connectGmail();
      if (res.success) {
        await dispatchGmailConfirmation(confirmedBooking.booking.booking_reference, confirmedBooking.booking.seat_id);
      } else if (!res.cancelled && res.error) {
        setEmailStatus({ status: 'failed', email: user?.email || 'Gmail' });
      }
    } finally {
      setIsSendingManualEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading bus seat map...</p>
        </div>
      </div>
    );
  }

  if (!tripDetail) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/50">
                {tripDetail.bus?.bus_number}
              </span>
              <span className="text-sm font-bold text-slate-900">
                {tripDetail.bus?.bus_name}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{tripDetail.route?.name}</span>
              <span>·</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>Departs at {tripDetail.departure_time}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 text-lg font-bold rounded-lg hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Confirmed State */}
        {confirmedBooking ? (
          <div className="py-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">Booking Confirmed!</h3>
            <p className="text-sm text-slate-600 mb-6">
              Your free seat has been atomically reserved on {tripDetail.bus?.bus_number}.
            </p>

            {/* Gmail Notification Status Card */}
            {emailStatus?.status === 'sent' && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 text-left flex items-start gap-3">
                <CheckCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-emerald-900 text-sm">Pass Sent to Gmail!</div>
                  <p className="mt-0.5 text-emerald-700">
                    Registration confirmation and personal QR boarding pass have been delivered to <strong>{emailStatus.email}</strong>.
                  </p>
                </div>
              </div>
            )}

            {emailStatus?.status === 'pending' && (
              <div className="mb-6 p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-800 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span>Dispatching confirmation pass to Gmail ({emailStatus.email})...</span>
              </div>
            )}

            {emailStatus?.status === 'not_connected' && (
              <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      Send QR Pass & Receipt to your Gmail:
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Connect your Google account to receive the registration pass and QR image in your inbox.
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleConnectAndSend}
                  disabled={isSendingManualEmail}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 shrink-0"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>{isSendingManualEmail ? 'Sending...' : 'Send to Gmail'}</span>
                </button>
              </div>
            )}

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 max-w-md mx-auto text-left space-y-2 mb-6">
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
                <span className="text-slate-500">Booking Reference</span>
                <span className="font-mono font-bold text-blue-600">{confirmedBooking.booking.booking_reference}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
                <span className="text-slate-500">Seat Number</span>
                <span className="font-bold text-slate-900">{confirmedBooking.booking.seat_id}</span>
              </div>
              <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-200">
                <span className="text-slate-500">Bus / Departure</span>
                <span className="font-medium text-slate-800">{tripDetail.bus?.bus_number} · {tripDetail.departure_time}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Total Price</span>
                <span className="font-bold text-emerald-600">₹0 (Free Campus Shuttle)</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">
              Please arrive at <span className="font-semibold text-slate-700">{tripDetail.parking_bay}</span> 10 minutes prior to departure and present your personal QR pass to the driver.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  onClose();
                  onOpenQR();
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
              >
                <QrCode className="w-4 h-4" />
                <span>View My Boarding Pass</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Route Stops Strip with Times */}
            <div className="py-3 px-4 bg-slate-50 rounded-xl border border-slate-200/60 my-4 text-xs">
              <div className="font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                <span>Route Itinerary & Scheduled Pickup Stops:</span>
                <span className="text-[11px] text-slate-500 font-mono">
                  {tripDetail.route?.ordered_stops?.length || 0} stops
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-slate-600 max-h-24 overflow-y-auto pr-1">
                {tripDetail.route?.stop_details && tripDetail.route.stop_details.length > 0 ? (
                  tripDetail.route.stop_details.map((stop: any, idx: number) => (
                    <span key={idx} className="inline-flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                      <span className="font-medium text-slate-800">{stop.stop_name}</span>
                      <span className="text-blue-600 font-semibold font-mono">({stop.time})</span>
                      {idx < tripDetail.route.stop_details.length - 1 && (
                        <span className="text-slate-300 ml-1">→</span>
                      )}
                    </span>
                  ))
                ) : (
                  tripDetail.route?.ordered_stops?.map((stop: string, idx: number) => (
                    <React.Fragment key={idx}>
                      <span className="font-medium text-slate-800">{stop}</span>
                      {idx < (tripDetail.route.ordered_stops?.length || 0) - 1 && (
                        <span className="text-slate-400">→</span>
                      )}
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Bus Status Note if not OPEN */}
            {tripDetail.status !== 'OPEN' && (
              <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <span className="font-semibold">Notice:</span> This trip is currently <strong>{tripDetail.status}</strong>. New seat bookings are temporarily disabled.
              </div>
            )}

            {/* Seat Map Layout */}
            <div className="py-4">
              <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
                <span className="font-medium">Interactive Coach Layout (2x2)</span>
                {/* Seat Legend */}
                <div className="flex items-center gap-4 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded bg-white border border-slate-300" />
                    <span>Available</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded bg-blue-600 border border-blue-600" />
                    <span>Selected</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded bg-slate-200 border border-slate-300 text-slate-400" />
                    <span>Booked</span>
                  </div>
                </div>
              </div>

              {/* Coach Container */}
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 max-w-md mx-auto">
                {/* Front Windshield / Driver Cabin */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-dashed border-slate-300 text-xs text-slate-400">
                  <div className="flex items-center gap-1.5 bg-slate-200/80 px-3 py-1 rounded text-slate-600 font-medium">
                    <Bus className="w-3.5 h-3.5" />
                    <span>Driver's Seat</span>
                  </div>
                  <span className="text-[11px] font-mono tracking-wider">FRONT OF BUS</span>
                  <div className="text-[11px] text-slate-500">Door ↗</div>
                </div>

                {/* 2x2 Grid of Rows */}
                <div className="space-y-2.5">
                  {/* Group seats into rows of 4 (A, B, aisle, C, D) */}
                  {Array.from({ length: Math.ceil((tripDetail.seat_map?.length || 0) / 4) }).map((_, rIdx) => {
                    const rowNumber = rIdx + 1;
                    const seatA = tripDetail.seat_map.find((s: any) => s.seat_id === `${rowNumber}A`);
                    const seatB = tripDetail.seat_map.find((s: any) => s.seat_id === `${rowNumber}B`);
                    const seatC = tripDetail.seat_map.find((s: any) => s.seat_id === `${rowNumber}C`);
                    const seatD = tripDetail.seat_map.find((s: any) => s.seat_id === `${rowNumber}D`);

                    return (
                      <div key={rowNumber} className="flex items-center justify-between">
                        {/* Left pair (A, B) */}
                        <div className="flex items-center gap-2">
                          {[seatA, seatB].map(seat => seat && (
                            <button
                              key={seat.seat_id}
                              disabled={seat.is_booked || tripDetail.status !== 'OPEN'}
                              onClick={() => handleSeatClick(seat.seat_id, seat.is_booked)}
                              className={`w-11 h-11 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                                seat.is_booked
                                  ? 'bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed'
                                  : selectedSeat === seat.seat_id
                                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400 scale-105'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:border-blue-400 hover:bg-blue-50/50'
                              }`}
                            >
                              <span>{seat.seat_id}</span>
                            </button>
                          ))}
                        </div>

                        {/* Aisle */}
                        <div className="text-[10px] font-mono text-slate-300 px-2 select-none">
                          R{rowNumber}
                        </div>

                        {/* Right pair (C, D) */}
                        <div className="flex items-center gap-2">
                          {[seatC, seatD].map(seat => seat && (
                            <button
                              key={seat.seat_id}
                              disabled={seat.is_booked || tripDetail.status !== 'OPEN'}
                              onClick={() => handleSeatClick(seat.seat_id, seat.is_booked)}
                              className={`w-11 h-11 rounded-lg text-xs font-semibold flex flex-col items-center justify-center transition-all ${
                                seat.is_booked
                                  ? 'bg-slate-200 border border-slate-300 text-slate-400 cursor-not-allowed'
                                  : selectedSeat === seat.seat_id
                                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400 scale-105'
                                  : 'bg-white border border-slate-300 text-slate-700 hover:border-blue-400 hover:bg-blue-50/50'
                              }`}
                            >
                              <span>{seat.seat_id}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Booking Summary Bar */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500">Selected Reservation</div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">
                    {selectedSeat ? `Seat ${selectedSeat}` : 'No seat selected'}
                  </span>
                  <span>·</span>
                  <span className="font-bold text-emerald-600 text-sm">₹0 (Free)</span>
                </div>
              </div>

              {showConfirm ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                  >
                    Go Back
                  </button>
                  <button
                    disabled={isSubmitting}
                    onClick={handleConfirmBooking}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Confirming...' : 'Confirm Free Seat?'}
                  </button>
                </div>
              ) : (
                <button
                  disabled={!selectedSeat || tripDetail.status !== 'OPEN'}
                  onClick={() => setShowConfirm(true)}
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Proceed to Confirm
                </button>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
};
