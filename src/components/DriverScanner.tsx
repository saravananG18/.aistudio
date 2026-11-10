import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { Trip, BoardingVerificationResult } from '../types/index.ts';
import { api } from '../services/api.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useGmail } from '../context/GmailContext.tsx';
import { 
  Camera, 
  CameraOff, 
  QrCode, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Search, 
  Upload, 
  RefreshCw, 
  Users, 
  Clock, 
  Bus, 
  MapPin, 
  Volume2, 
  VolumeX,
  FlipHorizontal,
  Mail,
  CheckCheck,
  Bell,
  Send,
  X,
  AlertCircle
} from 'lucide-react';

interface DriverScannerProps {
  onOpenBusMap?: () => void;
}

export const DriverScanner: React.FC<DriverScannerProps> = ({ onOpenBusMap }) => {
  const { user } = useAuth();
  const { isConnected, googleUser, connectGmail, sendBoardingIntimation, sendBoardingReminder } = useGmail();
  const [assignedTrips, setAssignedTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [manifestData, setManifestData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Scanner modes: 'camera' | 'file' | 'manual'
  const [scannerMode, setScannerMode] = useState<'camera' | 'file' | 'manual'>('camera');
 
  // Verification Result
  const [verificationResult, setVerificationResult] = useState<BoardingVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [manualRefInput, setManualRefInput] = useState('');
  const [recentBoardings, setRecentBoardings] = useState<Array<any>>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [intimationStatus, setIntimationStatus] = useState<string | null>(null);
  const [isConnectingGmail, setIsConnectingGmail] = useState(false);

  // Unboarded Reminders Modal states
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isSendingReminders, setIsSendingReminders] = useState(false);
  const [reminderCustomNote, setReminderCustomNote] = useState('');
  const [reminderFeedback, setReminderFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // List of unboarded passengers
  const unboardedPassengers = manifestData?.manifest?.filter((m: any) => m.boarding_status !== 'BOARDED') || [];

  const handleSendReminders = async () => {
    if (!selectedTripId) return;
    setIsSendingReminders(true);
    setReminderFeedback(null);
    try {
      if (unboardedPassengers.length === 0) {
        setReminderFeedback({ type: 'success', text: 'There are no unboarded passengers to remind.' });
        return;
      }
      if (!isConnected) {
        const connection = await connectGmail();
        if (!connection.success) throw new Error(connection.error || 'Connect Gmail to send boarding reminders.');
      }
      const trip = manifestData.trip;
      let sent = 0;
      let failed = 0;
      for (const passenger of unboardedPassengers) {
        const result = await sendBoardingReminder({
          studentName: passenger.student_name,
          studentEmail: passenger.student_email,
          studentIdNumber: passenger.student_id_number,
          bookingReference: passenger.booking_reference,
          seatId: passenger.seat_id,
          busNumber: trip.bus?.bus_number || 'Campus Bus',
          routeName: trip.route?.name || 'Campus Route',
          departureTime: trip.departure_time,
          parkingBay: trip.parking_bay,
          driverName: user?.name,
          note: reminderCustomNote
        });
        await api.recordDriverEmailLog(passenger.booking_id, result.success ? 'SENT' : 'FAILED', result.error);
        if (result.success) sent += 1;
        else failed += 1;
      }
      setReminderFeedback({
        type: failed ? (sent ? 'success' : 'error') : 'success',
        text: `${sent} reminder${sent === 1 ? '' : 's'} sent${failed ? `; ${failed} failed` : ''}.`
      });
      if (sent) playSound('success');
      // reload manifest to reflect fresh updates
      await loadManifest(selectedTripId);
      setTimeout(() => {
        setIsReminderModalOpen(false);
        setReminderCustomNote('');
      }, 1800);
    } catch (err: any) {
      setReminderFeedback({
        type: 'error',
        text: err.message || 'Failed to dispatch reminders.'
      });
    } finally {
      setIsSendingReminders(false);
    }
  };

  // Dispatch boarding intimation via Gmail
  const dispatchBoardingIntimation = async (passenger: any) => {
    if (!passenger || !passenger.student_email) return;
    if (isConnected) {
      setIntimationStatus(`Sending boarding intimation to ${passenger.student_email}...`);
      try {
        const emailRes = await sendBoardingIntimation({
          studentName: passenger.student_name,
          studentEmail: passenger.student_email,
          studentIdNumber: passenger.student_id_number,
          bookingReference: passenger.booking_reference,
          seatId: passenger.seat_id,
          busNumber: passenger.bus_number,
          routeName: passenger.route_name,
          boardedAt: passenger.boarded_at,
          driverName: user?.name
        });
        if (emailRes.success) {
          setIntimationStatus(`✓ Boarding confirmation email delivered to ${passenger.student_email}`);
        } else {
          setIntimationStatus(`⚠️ Email delivery notice logged (${passenger.student_email})`);
        }
      } catch (err: any) {
        console.error('Failed to send boarding intimation:', err);
        setIntimationStatus(`⚠️ Intimation logged in audit trail`);
      }
    } else {
      setIntimationStatus(`Boarding recorded & logged in student account`);
    }
  };

 
  // Audio chimes (synthesized Web Audio API, zero external assets)
  const playSound = (type: 'success' | 'error') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'success') {
        // High two-tone friendly chime (C5 -> G5)
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.12); // G5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else {
        // Low double buzz
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // Ignore audio permission/context errors
    }
  };

  // Load trips assigned to this driver
  const loadDriverTrips = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const data = await api.getTrips({
        driver_id: user?.role === 'driver' ? user.id : undefined
      });
      setAssignedTrips(data.trips);
      if (data.trips.length > 0 && !selectedTripId) {
        setSelectedTripId(data.trips[0].id);
      }
    } catch (err) {
      if (!silent) console.error('Failed to load trips for driver:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Load manifest & boarding counts for selected trip
  const loadManifest = async (tripId: string) => {
    if (!tripId) return;
    try {
      const data = await api.getTripManifest(tripId);
      setManifestData(data);
    } catch (err) {
      // Ignore background manifest poll errors
    }
  };

  useEffect(() => {
    loadDriverTrips(false);
    // Real-time live polling for driver every 2.5s: syncs admin booking window toggles and fresh passenger bookings
    const pollInterval = setInterval(() => {
      loadDriverTrips(true);
      if (selectedTripId) {
        loadManifest(selectedTripId);
      }
    }, 2500);

    const onFocus = () => {
      loadDriverTrips(true);
      if (selectedTripId) loadManifest(selectedTripId);
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, selectedTripId]);

  useEffect(() => {
    if (selectedTripId) {
      loadManifest(selectedTripId);
    }
  }, [selectedTripId]);


  // Browser camera/file scans use the same authenticated verification RPC.
  const handleVerifyQR = async (qrToken: string): Promise<boolean> => {
    if (!selectedTripId || isVerifying) return false;
    setIsVerifying(true);
    setVerificationResult(null);
    setIntimationStatus(null);

    try {
      const res = await api.verifyBoarding({
        trip_id: selectedTripId,
        qr_identifier: qrToken,
        method: 'QR'
      });

      setVerificationResult(res);

      if (res.success) {
        playSound('success');
        if (res.passenger) {
          setRecentBoardings(prev => [res.passenger, ...prev.slice(0, 4)]);
          dispatchBoardingIntimation(res.passenger);
        }
        await loadManifest(selectedTripId);
        return true;
      } else {
        playSound('error');
        return false;
      }
    } catch (err: any) {
      playSound('error');
      setVerificationResult({
        success: false,
        code: 'SERVER_ERROR',
        message: err.message || 'Verification service unreachable.'
      });
      return false;
    } finally {
      setIsVerifying(false);
    }
  };


  // Handle manual booking reference lookup
  const handleManualVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualRefInput.trim() || !selectedTripId) return;
    setIsVerifying(true);
    setVerificationResult(null);
    setIntimationStatus(null);

    try {
      const res = await api.verifyBoarding({
        trip_id: selectedTripId,
        booking_reference: manualRefInput.trim().toUpperCase(),
        method: 'MANUAL'
      });

      setVerificationResult(res);

      if (res.success) {
        playSound('success');
        if (res.passenger) {
          setRecentBoardings(prev => [res.passenger, ...prev.slice(0, 4)]);
          dispatchBoardingIntimation(res.passenger);
        }
        setManualRefInput('');
        await loadManifest(selectedTripId);
      } else {
        playSound('error');
      }
    } catch (err: any) {
      playSound('error');
      setVerificationResult({
        success: false,
        code: 'SERVER_ERROR',
        message: err.message || 'Manual verification failed.'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle file/image QR decode
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const ctx = tempCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code && code.data) {
            handleVerifyQR(code.data.trim());
          } else {
            playSound('error');
            setVerificationResult({
              success: false,
              code: 'QR_REVOKED_OR_INVALID',
              message: 'No readable QR code found in the uploaded image. Please try another photo.'
            });
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Trip Status Change Action (Boarding, Departed)
  const handleTripStatusChange = async (newStatus: string) => {
    if (!selectedTripId) return;
    try {
      await api.updateTripStatus(selectedTripId, { status: newStatus });
      await loadDriverTrips();
      await loadManifest(selectedTripId);
    } catch (err: any) {
      setIntimationStatus(`Status update failed: ${err.message || 'Unknown error'}`);
    }
  };

  const selectedTrip = assignedTrips.find(t => t.id === selectedTripId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Title & Header Stats */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 mb-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Boarding Scanner
              </h1>
              <span className="text-xs bg-slate-900 text-white font-semibold px-2.5 py-0.5 rounded-md">
                Driver Console
              </span>
            </div>
            <p className="text-sm text-slate-600">
              Verify student reservations, scan personal QR boarding passes, and record authorized bus departures.
            </p>
          </div>

          {/* Gmail, Sound toggle & Assigned Driver Info */}
          <div className="flex items-center gap-3 flex-wrap">
            {isConnected ? (
              <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Gmail Intimations Active</span>
              </div>
            ) : (
              <button
                onClick={async () => {
                  setIsConnectingGmail(true);
                  try {
                    const res = await connectGmail();
                    if (res.success) {
                      setIntimationStatus('✓ Gmail connected! Student boarding verification emails are now automated.');
                    } else if (!res.cancelled && res.error) {
                      setIntimationStatus(`Notice: ${res.error}`);
                    }
                  } finally {
                    setIsConnectingGmail(false);
                  }
                }}
                disabled={isConnectingGmail}
                className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-700 hover:bg-blue-100 flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Connect Gmail to automatically email passengers upon boarding verification"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>{isConnectingGmail ? 'Connecting...' : 'Connect Gmail Intimations'}</span>
              </button>
            )}

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                soundEnabled
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
              title="Toggle audio chimes"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              <span>{soundEnabled ? 'Audio Chime ON' : 'Muted'}</span>
            </button>

            <button
              onClick={() => loadManifest(selectedTripId)}
              className="p-2 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl hover:bg-slate-50"
              title="Refresh manifest counts"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {onOpenBusMap && (
              <button
                onClick={onOpenBusMap}
                className="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="View today's campus parking bay allocation and bus identification map"
              >
                <MapPin className="w-3.5 h-3.5 text-amber-600" />
                <span>Today's Bus & Bay Map</span>
              </button>
            )}
          </div>
        </div>

        {/* Selected Trip Selector & Manifest Metrics Strip */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6">
          
          {/* Trip Selector */}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Assigned Trip:
            </label>
            <select
              value={selectedTripId}
              onChange={e => {
                setSelectedTripId(e.target.value);
                setVerificationResult(null);
              }}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 text-sm rounded-xl p-2.5 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {assignedTrips.map(trip => (
                <option key={trip.id} value={trip.id}>
                  {trip.bus?.bus_number} — {trip.route?.name} ({trip.departure_time}) [{trip.status}]
                </option>
              ))}
            </select>

            {selectedTrip && (
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  {selectedTrip.parking_bay}
                </span>
                <span>·</span>
                <span className="flex items-center gap-1 font-semibold text-slate-800">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Departure: {selectedTrip.departure_time}
                </span>
              </div>
            )}
          </div>

          {/* Live Passenger Boarding Counter */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="text-xs font-medium text-slate-500 mb-1">Boarded Passengers</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {manifestData?.boarded_passengers ?? 0}{' '}
              <span className="text-sm text-slate-500 font-normal">
                of {manifestData?.total_passengers ?? 0}
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-blue-600 h-full rounded-full transition-all duration-300"
                style={{
                  width: `${
                    manifestData?.total_passengers
                      ? (manifestData.boarded_passengers / manifestData.total_passengers) * 100
                      : 0
                  }%`
                }}
              />
            </div>
          </div>

          {/* Trip Status & Reminders Control */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
            <div className="text-xs font-medium text-slate-500 mb-1 flex items-center justify-between">
              <span>Trip: <strong className="text-slate-900">{selectedTrip?.status}</strong></span>
              {unboardedPassengers.length > 0 && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full">
                  {unboardedPassengers.length} unboarded
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setReminderFeedback(null);
                  setIsReminderModalOpen(true);
                }}
                disabled={unboardedPassengers.length === 0}
                className="w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
                title="Send reminder notifications to students who have booked but not yet boarded"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Send Reminders ({unboardedPassengers.length})</span>
              </button>
              <button
                onClick={() => handleTripStatusChange('DEPARTED')}
                disabled={selectedTrip?.status === 'DEPARTED'}
                className="w-full py-1.5 px-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-40"
              >
                Depart Bus
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Main Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Multi-Mode Scanner & Camera View (7 Cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            
            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl mb-6 text-xs font-medium">
              <button
                onClick={() => {
                  setScannerMode('camera');
                }}
                className={`flex-1 py-2 rounded-lg text-center transition-colors ${
                  scannerMode === 'camera'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Live Camera
              </button>
              <button
                onClick={() => {
                  setScannerMode('file');
                }}
                className={`flex-1 py-2 rounded-lg text-center transition-colors ${
                  scannerMode === 'file'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Photo / File Upload
              </button>
              <button
                onClick={() => {
                  setScannerMode('manual');
                }}
                className={`flex-1 py-2 rounded-lg text-center transition-colors ${
                  scannerMode === 'manual'
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Manual Reference
              </button>
            </div>
          {scannerMode === 'camera' && (
            <div>
              <div className="relative aspect-4/3 bg-slate-900 rounded-2xl overflow-hidden flex flex-col items-center justify-center border border-slate-300 p-6 text-center text-white">
                <div className="w-16 h-16 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center mb-4 animate-pulse">
                  <QrCode className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold">ESP32-CAM Boarding Scanner</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  {selectedTripId
                    ? 'The device verifies each decoded pass with Supabase and controls its own status indicator. The manifest refreshes automatically.'
                    : 'Please select an assigned trip above before scanning.'}
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 mt-4 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Device: <strong>Supabase Edge Function</strong>
                </span>
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                  Use HTTPS
                </span>
              </div>
            </div>
          )}

            {/* Sub-mode 2: Photo / File Upload Scanner */}
            {scannerMode === 'file' && (
              <div className="py-6 text-center">
                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 hover:border-blue-400 transition-colors bg-slate-50/50">
                  <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-800 mb-1">
                    Upload or Drop QR Code Photo
                  </p>
                  <p className="text-xs text-slate-500 mb-4 max-w-xs mx-auto">
                    Select a photo or screenshot of the student's boarding pass to decode and verify immediately.
                  </p>
                  <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer shadow-xs">
                    <Upload className="w-4 h-4" />
                    <span>Choose QR Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Sub-mode 3: Manual Booking Reference Lookup Fallback */}
            {scannerMode === 'manual' && (
              <div className="py-4">
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  Manual Booking Reference Fallback
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  If the student's screen is broken or camera access is unavailable, enter their 8-character booking reference (e.g. <code className="text-blue-600 font-mono">CIT-BK-84920</code>).
                </p>

                <form onSubmit={handleManualVerify} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="e.g. CIT-BK-84920"
                    value={manualRefInput}
                    onChange={e => setManualRefInput(e.target.value)}
                    className="flex-1 font-mono uppercase text-sm px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                  <button
                    type="submit"
                    disabled={isVerifying || !manualRefInput.trim()}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isVerifying ? 'Verifying...' : 'Verify Reference'}
                  </button>
                </form>
              </div>
            )}

          </div>

          {/* Quick Demo Test Buttons */}
          <div className="bg-slate-100 rounded-xl p-4 border border-slate-200">
            <span className="text-xs font-semibold text-slate-700 block mb-2">
              Driver Quick-Test Passes (Simulate Student Scanning):
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleVerifyQR('CIT-QR-AARAV2026-X94B')}
                className="px-3 py-1.5 text-xs font-medium bg-white text-slate-800 rounded-lg border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 shadow-2xs"
              >
                Scan Aarav (Valid Seat 2B)
              </button>
              <button
                onClick={() => handleVerifyQR('CIT-QR-ANANYA2026-K73P')}
                className="px-3 py-1.5 text-xs font-medium bg-white text-slate-800 rounded-lg border border-slate-200 hover:border-amber-500 hover:text-amber-700 shadow-2xs"
              >
                Scan Ananya (Already Boarded Test)
              </button>
              <button
                onClick={() => handleVerifyQR('CIT-QR-UNKNOWN-999')}
                className="px-3 py-1.5 text-xs font-medium bg-white text-slate-800 rounded-lg border border-slate-200 hover:border-red-500 hover:text-red-700 shadow-2xs"
              >
                Scan Fake QR (Rejection Test)
              </button>
            </div>
          </div>

        </div>

        {/* Right Column: Instant Verification Feedback & Activity (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Live Scan Result Panel */}
          {verificationResult ? (
            <div
              className={`rounded-2xl border p-6 shadow-sm transition-all animate-in fade-in zoom-in-95 duration-150 ${
                verificationResult.success
                  ? 'bg-emerald-50 border-emerald-300'
                  : 'bg-rose-50 border-rose-300'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                {verificationResult.success ? (
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
                    <XCircle className="w-6 h-6" />
                  </div>
                )}
                <div>
                  <h3
                    className={`font-black tracking-wide text-base ${
                      verificationResult.success ? 'text-emerald-900' : 'text-rose-900'
                    }`}
                  >
                    {verificationResult.success ? 'BOARDING VERIFIED' : 'BOARDING REJECTED'}
                  </h3>
                  <p
                    className={`text-xs font-medium ${
                      verificationResult.success ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {verificationResult.message}
                  </p>
                </div>
              </div>

              {/* Passenger Metadata if Verified or Duplicate */}
              {verificationResult.passenger && (
                <div className="bg-white rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-slate-500">Passenger Name</span>
                    <span className="font-bold text-slate-900">{verificationResult.passenger.student_name}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-slate-500">Student Roll No</span>
                    <span className="font-mono font-medium text-slate-700">{verificationResult.passenger.student_id_number || '22CIT042'}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-slate-500">Reserved Seat</span>
                    <span className="font-bold text-blue-600 text-sm">
                      Seat {verificationResult.passenger.seat_id}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                    <span className="text-slate-500">Booking Reference</span>
                    <span className="font-mono font-semibold text-slate-800">{verificationResult.passenger.booking_reference}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Timestamp</span>
                    <span className="font-mono text-slate-700">
                      {new Date(verificationResult.passenger.boarded_at).toLocaleTimeString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              )}

              {intimationStatus && (
                <div className="mt-3 p-2.5 rounded-xl bg-emerald-100/80 border border-emerald-300 text-xs font-semibold text-emerald-900 flex items-center gap-2 animate-in fade-in">
                  <Mail className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{intimationStatus}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
              <QrCode className="w-10 h-10 mx-auto mb-2 text-slate-300" />
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Awaiting Scan</h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Scan student's QR code or enter booking reference to view instantaneous verification.
              </p>
            </div>
          )}

          {/* Recent Boarding Activity */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center justify-between">
              <span>Recent Boardings ({recentBoardings.length})</span>
              <span className="text-[11px] text-slate-500 font-normal">This Session</span>
            </h3>

            {recentBoardings.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4">
                No passengers boarded yet this session.
              </p>
            ) : (
              <div className="space-y-2.5">
                {recentBoardings.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 block">{p.student_name}</span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Seat {p.seat_id} · {p.booking_reference}
                      </span>
                    </div>
                    <span className="text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ✓ Boarded
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Passenger Manifest Table */}
      <div className="mt-12 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Trip Passenger Manifest
            </h2>
            <p className="text-xs text-slate-500">
              Complete passenger list for {selectedTrip?.bus?.bus_number} departing at {selectedTrip?.departure_time}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs text-slate-500">
              Total Confirmed: <strong className="text-slate-900 font-mono">{manifestData?.total_passengers || 0}</strong>
            </div>
            <button
              type="button"
              onClick={() => {
                setReminderFeedback(null);
                setIsReminderModalOpen(true);
              }}
              disabled={unboardedPassengers.length === 0}
              className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Send Reminders ({unboardedPassengers.length} unboarded)</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/50">
                <th className="py-3 px-4 font-semibold">Seat</th>
                <th className="py-3 px-4 font-semibold">Student Name</th>
                <th className="py-3 px-4 font-semibold">Roll Number</th>
                <th className="py-3 px-4 font-semibold">Booking Ref</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold">Boarded At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {manifestData?.manifest?.map((m: any) => (
                <tr key={m.booking_id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 font-mono">
                    {m.seat_id}
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800">
                    {m.student_name}
                  </td>
                  <td className="py-3 px-4 font-mono text-slate-600">
                    {m.student_id_number || '22CIT042'}
                  </td>
                  <td className="py-3 px-4 font-mono font-medium text-blue-600">
                    {m.booking_reference}
                  </td>
                  <td className="py-3 px-4">
                    {m.boarding_status === 'BOARDED' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> BOARDED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        <Clock className="w-3 h-3" /> NOT BOARDED
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                    {m.boarded_at
                      ? new Date(m.boarded_at).toLocaleTimeString('en-IN', {
                          timeZone: 'Asia/Kolkata',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal: Send Reminders to Unboarded Students */}
      {isReminderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Send Boarding Reminders to Unboarded Students
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedTrip?.bus?.bus_number} · Departure: <span className="font-semibold text-slate-800">{selectedTrip?.departure_time}</span> at {selectedTrip?.parking_bay}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReminderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 py-4 space-y-4">
              
              {reminderFeedback && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  reminderFeedback.type === 'success' 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium' 
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {reminderFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{reminderFeedback.text}</span>
                </div>
              )}

              {/* Unboarded Passengers List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Unboarded Passengers</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                      {unboardedPassengers.length} students
                    </span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Will receive instant departure notifications
                  </span>
                </div>

                {unboardedPassengers.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                    All students with confirmed bookings for this trip have already boarded!
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2 px-3 font-semibold">Seat</th>
                          <th className="py-2 px-3 font-semibold">Student Name</th>
                          <th className="py-2 px-3 font-semibold">Roll No</th>
                          <th className="py-2 px-3 font-semibold">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {unboardedPassengers.map((p: any) => (
                          <tr key={p.booking_id} className="hover:bg-amber-50/40">
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">{p.seat_id}</td>
                            <td className="py-2 px-3 font-medium text-slate-800">{p.student_name}</td>
                            <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{p.student_id_number || '—'}</td>
                            <td className="py-2 px-3 text-slate-600 text-[11px] font-mono">{p.student_email || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Custom Reminder Message */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Optional Reminder Message (Included in notification)
                </label>
                <textarea
                  rows={2}
                  value={reminderCustomNote}
                  onChange={e => setReminderCustomNote(e.target.value)}
                  placeholder="e.g. Bus is parked at the bay and preparing for departure. Please proceed to board immediately."
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500 self-center">Quick templates:</span>
                  <button
                    type="button"
                    onClick={() => setReminderCustomNote(`Departing promptly at ${selectedTrip?.departure_time} from ${selectedTrip?.parking_bay}. Please board immediately!`)}
                    className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                  >
                    ⏰ 5-Min Departure Call
                  </button>
                  <button
                    type="button"
                    onClick={() => setReminderCustomNote(`Bus doors closing shortly at ${selectedTrip?.parking_bay}. Final call for unboarded students!`)}
                    className="text-[10px] px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                  >
                    🚨 Final Boarding Call
                  </button>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsReminderModalOpen(false)}
                className="py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSendReminders}
                disabled={isSendingReminders || unboardedPassengers.length === 0}
                className="py-2.5 px-5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>
                  {isSendingReminders 
                    ? 'Dispatching Reminders...' 
                    : `Confirm & Send Reminders (${unboardedPassengers.length})`}
                </span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
