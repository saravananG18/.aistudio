import React, { useState, useEffect } from 'react';
import { Bus, Route, Trip, EmailLog, SystemSettings, BusIdentificationMap, User, DriverAvailability } from '../types/index.ts';
import { api, API_BASE } from '../services/api.ts';
import { appAssetUrl, DEFAULT_BUS_MAP_IMAGE } from '../services/assets.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { 
  ShieldAlert, 
  Bus as BusIcon, 
  Map, 
  Calendar, 
  Users, 
  Mail, 
  Settings, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  AlertTriangle,
  RefreshCw,
  Search,
  MapPin,
  Upload,
  Image as ImageIcon,
  Eye,
  Save,
  Check,
  ChevronDown,
  ChevronUp,
  Bell,
  Zap,
  Clock,
  Send,
  Lock,
  Unlock,
  UserCheck,
  UserPlus
} from 'lucide-react';

interface AdminPortalProps {
  currentView?: string;
  onBusMapUpdated?: (map: BusIdentificationMap) => void;
  onOpenMapModal?: () => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ currentView, onBusMapUpdated, onOpenMapModal }) => {
  const { user, demoUsers } = useAuth();
  const [activeTab, setActiveTab] = useState<'trips' | 'fleet' | 'routes' | 'bus-map' | 'qr-security' | 'emails' | 'settings'>('trips');
  
  // Data states
  const [trips, setTrips] = useState<Trip[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [studentQrs, setStudentQrs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Driver Assignment & Single-Driver-Per-Day Policy states
  const [driverAvailability, setDriverAvailability] = useState<DriverAvailability[]>([]);
  const [allDrivers, setAllDrivers] = useState<User[]>([]);
  const [assigningDriverTrip, setAssigningDriverTrip] = useState<Trip | null>(null);
  const [selectedDriverForAssign, setSelectedDriverForAssign] = useState<string>('');
  const [isUpdatingBookingWindow, setIsUpdatingBookingWindow] = useState<string | null>(null);
  const [isSavingDriver, setIsSavingDriver] = useState<boolean>(false);

  // Daily Bus Identification Map states (Authenticator)
  const [busMap, setBusMap] = useState<BusIdentificationMap | null>(null);
  const [mapImageUrl, setMapImageUrl] = useState<string>(DEFAULT_BUS_MAP_IMAGE);
  const [mapTitle, setMapTitle] = useState<string>('CIT Campus Bus Identification & Parking Bay Allocation Map');
  const [mapDate, setMapDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [mapNotes, setMapNotes] = useState<string>('Official campus parking bay layout and bus identification numbers for today. Reminder: Route numbers are used as bus numbers. Check your allocated parking bay before boarding.');
  const [mapUpdatedBy, setMapUpdatedBy] = useState<string>('Dr. V. Sundaram (Transport Authenticator)');
  const [isPublishingMap, setIsPublishingMap] = useState<boolean>(false);

  // Expandable inspection states for Administrator
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [expandedBusId, setExpandedBusId] = useState<string | null>(null);
  const [tripManifests, setTripManifests] = useState<Record<string, any>>({});
  const [loadingManifestId, setLoadingManifestId] = useState<string | null>(null);
  const [sendingReminderTripId, setSendingReminderTripId] = useState<string | null>(null);

  // Form states for creating new entities
  const [newBusNumber, setNewBusNumber] = useState('');
  const [newBusName, setNewBusName] = useState('');
  const [newBusCapacity, setNewBusCapacity] = useState('32');
  const [newBusRouteOption, setNewBusRouteOption] = useState<'existing' | 'new'>('existing');
  const [newBusSelectedRouteId, setNewBusSelectedRouteId] = useState('');
  const [newBusNewRouteName, setNewBusNewRouteName] = useState('');
  const [newBusNewRouteStops, setNewBusNewRouteStops] = useState('');
  const [newBusDepartureBatch, setNewBusDepartureBatch] = useState<'03:30 PM' | '04:30 PM' | 'BOTH'>('BOTH');
  const [newBusParkingBay, setNewBusParkingBay] = useState('');
  const [newBusAutoSchedule, setNewBusAutoSchedule] = useState(true);

  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteStops, setNewRouteStops] = useState('');

  const [newTripBusId, setNewTripBusId] = useState('');
  const [newTripRouteId, setNewTripRouteId] = useState('');
  const [newTripDriverId, setNewTripDriverId] = useState('');
  const [newTripDeparture, setNewTripDeparture] = useState('03:30 PM');
  const [newTripBay, setNewTripBay] = useState('Bay 1 — Main Gate');

  // Load all admin data
  const loadAll = async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const [tripsRes, demoRes, emailsRes, settingsRes, busMapRes] = await Promise.all([
        api.getTrips(),
        api.getDemoUsers(),
        api.getEmailLogs(),
        api.getSettings(),
        api.getBusMap()
      ]);

      setTrips(tripsRes.trips);
      setStudentQrs(demoRes.active_qrs);
      setEmailLogs(emailsRes.logs);
      setSettings(settingsRes.settings);

      // Fetch driver availability
      try {
        const availRes = await api.getDriverAvailability();
        setDriverAvailability(availRes.drivers);
      } catch (e) {
        if (!silent) console.error('Failed to load driver availability:', e);
      }

      if (busMapRes && busMapRes.bus_map) {
        setBusMap(busMapRes.bus_map);
        setMapImageUrl(busMapRes.bus_map.image_url);
        setMapTitle(busMapRes.bus_map.title);
        setMapDate(busMapRes.bus_map.effective_date);
        setMapNotes(busMapRes.bus_map.notes || '');
        setMapUpdatedBy(busMapRes.bus_map.updated_by_name || 'Transport Authenticator');
      }

      // Extract unique buses and routes from trips/db
      const uniqueBuses: Bus[] = [];
      const uniqueRoutes: Route[] = [];

      tripsRes.trips.forEach(t => {
        if (t.bus && !uniqueBuses.find(b => b.id === t.bus!.id)) uniqueBuses.push(t.bus);
        if (t.route && !uniqueRoutes.find(r => r.id === t.route!.id)) uniqueRoutes.push(t.route);
      });

      setBuses(uniqueBuses);
      setRoutes(uniqueRoutes);

      if (uniqueBuses.length > 0 && !newTripBusId) setNewTripBusId(uniqueBuses[0].id);
      if (uniqueRoutes.length > 0 && !newTripRouteId) setNewTripRouteId(uniqueRoutes[0].id);
      const drivers = demoRes.users.filter(u => u.role === 'driver');
      setAllDrivers(drivers);

      // Pick the first available driver not yet assigned today
      const assignedTodayIds = tripsRes.trips.map(t => t.assigned_driver_id);
      const freeDriver = drivers.find(d => !assignedTodayIds.includes(d.id));
      if (freeDriver && !newTripDriverId) {
        setNewTripDriverId(freeDriver.id);
      } else if (drivers.length > 0 && !newTripDriverId) {
        setNewTripDriverId(drivers[0].id);
      }
    } catch (err) {
      if (!silent) console.error('Failed to load admin data:', err);
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAll(false);
    // Real-time live polling every 3.5s so admin sees live seat bookings and driver updates
    const pollInterval = setInterval(() => {
      loadAll(true);
    }, 3500);

    return () => clearInterval(pollInterval);
  }, []);

  const handleOpenAllBuses = async () => {
    try {
      const res = await api.openAllTrips();
      setFeedback({ type: 'success', text: res.message });
      await loadAll(true);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to open all bus bookings' });
    }
  };

  const handleCloseAllBuses = async () => {
    try {
      const res = await api.closeAllTrips();
      setFeedback({ type: 'success', text: res.message });
      await loadAll(true);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to close all bus bookings' });
    }
  };

  const handleClearAllBookings = async () => {
    if (!window.confirm('Are you sure you want to remove all previous bookings? All bus seats will immediately become available for students.')) {
      return;
    }
    try {
      const res = await api.clearAllBookings();
      setFeedback({ type: 'success', text: res.message });
      await loadAll(true);
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to clear previous bookings' });
    }
  };

  useEffect(() => {
    if (currentView === 'admin-bus-map') {
      setActiveTab('bus-map');
    }
  }, [currentView]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', text: 'Please select a valid image file (JPEG, PNG, WebP).' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string;
      if (dataUrl) {
        setMapImageUrl(dataUrl);
        setFeedback({ type: 'success', text: `Loaded new map file "${file.name}". Click "Publish Today's Updated Map" to deploy it to all students and drivers.` });
      }
    };
    reader.onerror = () => {
      setFeedback({ type: 'error', text: 'Failed to read image file.' });
    };
    reader.readAsDataURL(file);
  };

  const handlePublishBusMap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapImageUrl) {
      setFeedback({ type: 'error', text: 'Please provide or upload a map image.' });
      return;
    }

    setIsPublishingMap(true);
    setFeedback(null);
    try {
      const res = await api.updateBusMap({
        image_url: mapImageUrl,
        title: mapTitle,
        effective_date: mapDate,
        notes: mapNotes,
        updated_by_name: mapUpdatedBy || user?.name || 'Campus Transport Authenticator'
      });

      setBusMap(res.bus_map);
      onBusMapUpdated?.(res.bus_map);
      setFeedback({ 
        type: 'success', 
        text: `Today's Bus Identification Map (v${res.bus_map.version}) successfully published! Every student and driver logging in will now immediately see this map.` 
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to publish bus identification map.' });
    } finally {
      setIsPublishingMap(false);
    }
  };

  const handleResetBusMapToDefault = async () => {
    setIsPublishingMap(true);
    setFeedback(null);
    try {
      const res = await api.resetBusMap();
      setBusMap(res.bus_map);
      setMapImageUrl(res.bus_map.image_url);
      setMapTitle(res.bus_map.title);
      setMapDate(res.bus_map.effective_date);
      setMapNotes(res.bus_map.notes || '');
      setMapUpdatedBy(res.bus_map.updated_by_name);
      onBusMapUpdated?.(res.bus_map);
      setFeedback({ type: 'success', text: 'Reset to default official CIT bus identification map.' });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to reset map.' });
    } finally {
      setIsPublishingMap(false);
    }
  };

  // Handlers
  const toggleExpandTrip = async (tripId: string) => {
    if (expandedTripId === tripId) {
      setExpandedTripId(null);
      return;
    }
    setExpandedTripId(tripId);
    if (!tripManifests[tripId]) {
      setLoadingManifestId(tripId);
      try {
        const manifest = await api.getTripManifest(tripId);
        setTripManifests(prev => ({ ...prev, [tripId]: manifest }));
      } catch (err) {
        console.error('Failed to load trip manifest for admin inspection:', err);
      } finally {
        setLoadingManifestId(null);
      }
    }
  };

  const handleSendAdminTripReminders = async (tripId: string) => {
    setSendingReminderTripId(tripId);
    try {
      const res = await api.sendTripReminders(tripId, 'Campus administration reminder: Bus departure batch is approaching. Please board promptly.');
      setFeedback({ type: 'success', text: res.message || `Dispatched reminders to ${res.count} unboarded passengers.` });
      const manifest = await api.getTripManifest(tripId);
      setTripManifests(prev => ({ ...prev, [tripId]: manifest }));
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to dispatch reminders.' });
    } finally {
      setSendingReminderTripId(null);
    }
  };

  // Admin Access: Open or Close bus bookings
  const handleToggleBookingWindow = async (tripId: string, action: 'OPEN' | 'CLOSE') => {
    setIsUpdatingBookingWindow(tripId);
    try {
      const res = await api.setBookingWindow(tripId, action);
      setFeedback({
        type: 'success',
        text: action === 'OPEN'
          ? 'Bus bookings OPENED successfully. Students can now book seats on this bus!'
          : 'Bus bookings CLOSED successfully. Bookings are now locked for students.'
      });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to update booking window.' });
    } finally {
      setIsUpdatingBookingWindow(null);
    }
  };

  // Admin Access: Driver Assignment Modal & Handlers (Enforces 1 driver 1 bus/trip per day)
  const handleOpenAssignDriverModal = (trip: Trip) => {
    setAssigningDriverTrip(trip);
    setSelectedDriverForAssign(trip.assigned_driver_id || '');
  };

  const handleSaveDriverAssignment = async () => {
    if (!assigningDriverTrip || !selectedDriverForAssign) return;
    setIsSavingDriver(true);
    try {
      const res = await api.assignDriver(assigningDriverTrip.id, selectedDriverForAssign);
      setFeedback({
        type: 'success',
        text: res.message || 'Driver assigned successfully. Single driver per day constraint verified.'
      });
      setAssigningDriverTrip(null);
      await loadAll();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err.message || 'Failed to assign driver. Ensure one driver is not assigned for multiple trips on one day.'
      });
    } finally {
      setIsSavingDriver(false);
    }
  };

  const handleScheduleBothBatches = async (busId?: string, routeId?: string) => {
    const targetBusId = busId || newTripBusId;
    const targetRouteId = routeId || newTripRouteId;
    if (!targetBusId || !targetRouteId) {
      setFeedback({ type: 'error', text: 'Please select a bus and a route first.' });
      return;
    }
    try {
      // Find two distinct available drivers so 1-driver-1-trip per day is strictly preserved
      const freeDrivers = driverAvailability
        .filter(d => !d.is_assigned_today)
        .map(d => d.driver.id);

      const driver1 = newTripDriverId || freeDrivers[0] || undefined;
      // Second driver must be different from driver1!
      const driver2 = freeDrivers.find(id => id !== driver1) || undefined;

      // Schedule 03:30 PM Batch 1
      const res1 = await fetch(`${API_BASE}/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.id}` },
        body: JSON.stringify({
          bus_id: targetBusId,
          route_id: targetRouteId,
          assigned_driver_id: driver1,
          departure_time: '03:30 PM',
          parking_bay: newTripBay || 'Bay 1 — Main Ground'
        })
      });
      const data1 = await res1.json();
      if (!res1.ok) throw new Error(data1.error || 'Failed to schedule 03:30 PM batch');

      // Schedule 04:30 PM Batch 2 with separate driver
      const res2 = await fetch(`${API_BASE}/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.id}` },
        body: JSON.stringify({
          bus_id: targetBusId,
          route_id: targetRouteId,
          assigned_driver_id: driver2,
          departure_time: '04:30 PM',
          parking_bay: newTripBay || 'Bay 1 — Main Ground'
        })
      });
      const data2 = await res2.json();
      if (!res2.ok) throw new Error(data2.error || 'Failed to schedule 04:30 PM batch');

      setFeedback({ 
        type: 'success', 
        text: 'Successfully scheduled both 03:30 PM and 04:30 PM departure batches with dedicated distinct drivers assigned for each trip!' 
      });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Failed to schedule batches.' });
    }
  };

  const handleAddBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBusNumber) return;
    try {
      const payload: any = {
        bus_number: newBusNumber,
        bus_name: newBusName,
        capacity: parseInt(newBusCapacity, 10),
        parking_bay: newBusParkingBay || `Bay ${(buses.length % 10) + 1} — Campus Ground`
      };

      if (newBusRouteOption === 'new' && newBusNewRouteName) {
        payload.new_route_name = newBusNewRouteName;
        payload.new_route_stops = newBusNewRouteStops;
      } else if (newBusSelectedRouteId) {
        payload.route_id = newBusSelectedRouteId;
      }

      const initialTime = newBusDepartureBatch === '04:30 PM' ? '04:30 PM' : '03:30 PM';
      payload.departure_time = initialTime;

      const res = await fetch(`${API_BASE}/buses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.id}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add bus');

      // If Authenticator chose BOTH batches (3:30 PM and 4:30 PM), also schedule the second batch
      if (newBusDepartureBatch === 'BOTH' && data.bus && (data.route || newBusSelectedRouteId)) {
        const resolvedRouteId = data.route?.id || newBusSelectedRouteId;
        await fetch(`${API_BASE}/trips`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.id}` },
          body: JSON.stringify({
            bus_id: data.bus.id,
            route_id: resolvedRouteId,
            assigned_driver_id: newTripDriverId || undefined,
            departure_time: '04:30 PM',
            parking_bay: payload.parking_bay
          })
        });
      }

      setFeedback({ 
        type: 'success', 
        text: `Bus ${newBusNumber} added successfully with route and departure batch(es)! Students and drivers can now view and book seats.` 
      });
      setNewBusNumber('');
      setNewBusName('');
      setNewBusNewRouteName('');
      setNewBusNewRouteStops('');
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleAddRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteName || !newRouteStops) return;
    try {
      const stopsArray = newRouteStops.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch(`${API_BASE}/routes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.id}`
        },
        body: JSON.stringify({
          name: newRouteName,
          ordered_stops: stopsArray
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add route');
      setFeedback({ type: 'success', text: `Route "${newRouteName}" created!` });
      setNewRouteName('');
      setNewRouteStops('');
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleScheduleTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTripBusId || !newTripRouteId || !newTripDeparture) return;
    try {
      const res = await fetch(`${API_BASE}/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user?.id}`
        },
        body: JSON.stringify({
          bus_id: newTripBusId,
          route_id: newTripRouteId,
          assigned_driver_id: newTripDriverId,
          departure_time: newTripDeparture,
          parking_bay: newTripBay
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule trip');
      setFeedback({ type: 'success', text: `New trip scheduled at ${newTripDeparture}!` });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleRevokeQR = async (studentId: string) => {
    try {
      await api.revokeStudentQR(studentId);
      setFeedback({ type: 'success', text: 'Student QR identity has been revoked. Further scans will be blocked.' });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleRegenerateQR = async (studentId: string) => {
    try {
      const res = await api.regenerateStudentQR(studentId);
      setFeedback({ type: 'success', text: `New QR Identity provisioned: ${res.qr_identity.opaque_qr_identifier}` });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleToggleDomainRestriction = async () => {
    if (!settings) return;
    try {
      const updated = await api.updateSettings({
        restrict_email_domain: !settings.restrict_email_domain
      });
      setSettings(updated.settings);
      setFeedback({
        type: 'success',
        text: `Campus email restriction ${!settings.restrict_email_domain ? 'ENABLED (@cit.edu.in enforced)' : 'DISABLED (Flexible Demo Mode)'}`
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleRetryEmail = async (logId: string) => {
    try {
      await api.retryEmail(logId);
      setFeedback({ type: 'success', text: 'Confirmation email resent successfully.' });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  const handleResetDemo = async () => {
    if (!window.confirm('Reset all bookings and trips back to fresh initial demo state?')) return;
    try {
      await api.resetDemoData();
      setFeedback({ type: 'success', text: 'Database reset to initial demo state.' });
      await loadAll();
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      
      {/* Top Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 mb-8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Transport Administration Console
            </h1>
            <span className="text-xs bg-slate-900 text-white font-semibold px-2.5 py-0.5 rounded-md">
              Admin Protected
            </span>
          </div>
          <p className="text-sm text-slate-600">
            Manage campus bus fleet, scheduled trips, booking windows, driver assignments, and student QR identity security.
          </p>
        </div>

        <button
          onClick={handleResetDemo}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl hover:bg-rose-100 transition-colors shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo Data</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium mb-6 border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-200/60 rounded-xl mb-6 text-xs font-medium overflow-x-auto">
        <button
          onClick={() => setActiveTab('trips')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'trips' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Trips & Booking Windows</span>
        </button>
        <button
          onClick={() => setActiveTab('fleet')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'fleet' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BusIcon className="w-4 h-4" />
          <span>Bus Fleet ({buses.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('routes')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'routes' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Map className="w-4 h-4" />
          <span>Routes & Stops</span>
        </button>
        <button
          onClick={() => setActiveTab('bus-map')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'bus-map' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-4 h-4 text-amber-600" />
          <span>Daily Bus Map (Authenticator)</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold">Daily</span>
        </button>
        <button
          onClick={() => setActiveTab('qr-security')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'qr-security' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          <span>QR Identity Security</span>
        </button>
        <button
          onClick={() => setActiveTab('emails')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'emails' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Email Logs ({emailLogs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
            activeTab === 'settings' ? 'bg-white text-slate-900 font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Campus Policies</span>
        </button>
      </div>

      {/* Tab 1: Trips & Schedule */}
      {activeTab === 'trips' && (
        <div className="space-y-8">
          {/* Schedule New Trip Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Schedule Campus Bus Departure Batch</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-500 font-medium">Standard Batches:</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  03:30 PM (Batch 1)
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  04:30 PM (Batch 2)
                </span>
              </div>
            </div>

            <form onSubmit={handleScheduleTrip} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Bus *</label>
                  <select
                    value={newTripBusId}
                    onChange={e => setNewTripBusId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-xs rounded-lg p-2 font-medium"
                  >
                    {buses.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.bus_number} — {b.bus_name} ({b.capacity} seats)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Route *</label>
                  <select
                    value={newTripRouteId}
                    onChange={e => setNewTripRouteId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-xs rounded-lg p-2 font-medium"
                  >
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Departure Batch / Time *</label>
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="e.g. 03:30 PM"
                      value={newTripDeparture}
                      onChange={e => setNewTripDeparture(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 text-xs rounded-lg p-2 font-mono"
                    />
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNewTripDeparture('03:30 PM')}
                        className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                          newTripDeparture === '03:30 PM'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        ⚡ 03:30 PM (Batch 1)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewTripDeparture('04:30 PM')}
                        className={`flex-1 py-1 px-2 rounded-md text-[10px] font-bold transition-colors cursor-pointer ${
                          newTripDeparture === '04:30 PM'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        ⚡ 04:30 PM (Batch 2)
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Assign Driver *</span>
                    <span className="text-[10px] text-blue-600 font-normal">1 bus/day rule</span>
                  </label>
                  <select
                    value={newTripDriverId}
                    onChange={e => setNewTripDriverId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-xs rounded-lg p-2 font-medium"
                  >
                    {allDrivers.map(d => {
                      const avail = driverAvailability.find(a => a.driver.id === d.id);
                      const isAssigned = avail?.is_assigned_today;
                      return (
                        <option 
                          key={d.id} 
                          value={d.id}
                          disabled={isAssigned}
                          className={isAssigned ? 'text-slate-400 bg-slate-100' : 'text-slate-900 font-semibold'}
                        >
                          {isAssigned 
                            ? `⚠️ ${d.name} (Assigned to ${avail?.assigned_bus_number || 'Bus'} today)` 
                            : `✓ ${d.name} (Available today)`}
                        </option>
                      );
                    })}
                  </select>
                  <span className="text-[10px] text-slate-500 block mt-1">
                    Drivers already assigned today are locked out
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Boarding Bay</label>
                  <input
                    type="text"
                    placeholder="e.g. Bay 2 — Main Gate"
                    value={newTripBay}
                    onChange={e => setNewTripBay(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-xs rounded-lg p-2"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <span className="text-[11px] text-slate-500">
                  Tip: Departure batches are displayed to all students for ₹0 seat reservation and drivers for QR verification.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleScheduleBothBatches()}
                    className="py-2 px-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    title="Automatically create both 03:30 PM and 04:30 PM departures for this bus"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>⚡ Schedule Both 3:30 & 4:30 PM Batches</span>
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                  >
                    Schedule Single Trip
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Trips Table with Expandable Booked & Boarded Row */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-5 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    All Scheduled Trips & Live Booking Controls
                  </h3>
                  <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full font-mono font-medium">
                    {trips.length} Campus Buses Scheduled Today
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Click any bus row to inspect passenger manifests in real time. Toggling Open/Close immediately updates all students and drivers.
                </p>
              </div>

              {/* Bulk Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAllBuses}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-colors cursor-pointer shadow-2xs"
                  title="Open all campus bus booking windows for students"
                >
                  <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Open All Buses for Booking</span>
                </button>

                <button
                  type="button"
                  onClick={handleCloseAllBuses}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 rounded-xl transition-colors cursor-pointer shadow-2xs"
                  title="Close all campus bus booking windows"
                >
                  <Lock className="w-3.5 h-3.5 text-rose-600" />
                  <span>Close All Buses</span>
                </button>

                <button
                  type="button"
                  onClick={handleClearAllBookings}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors cursor-pointer shadow-2xs"
                  title="Clear all previous student bookings and make all seats available"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                  <span>Clear Previous Bookings</span>
                </button>
              </div>
            </div>

            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/80">
                  <th className="py-3 px-3 font-semibold">Bus</th>
                  <th className="py-3 px-3 font-semibold">Route</th>
                  <th className="py-3 px-3 font-semibold">Departure</th>
                  <th className="py-3 px-3 font-semibold">Bookings & Status</th>
                  <th className="py-3 px-3 font-semibold">Booked / Capacity</th>
                  <th className="py-3 px-3 font-semibold">Boarded Seats</th>
                  <th className="py-3 px-3 font-semibold">Boarding Progress</th>
                  <th className="py-3 px-3 font-semibold">Assigned Driver</th>
                  <th className="py-3 px-3 font-semibold text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trips.map(t => {
                  const isExpanded = expandedTripId === t.id;
                  const booked = t.booked_seats_count || 0;
                  const boarded = t.boarded_seats_count || 0;
                  const total = t.total_seats || 32;
                  const pending = Math.max(0, booked - boarded);
                  const bookedPercent = Math.round((booked / total) * 100);
                  const boardedPercent = booked > 0 ? Math.round((boarded / booked) * 100) : 0;
                  const manifest = tripManifests[t.id];
                  const isLoadingManifest = loadingManifestId === t.id;
                  const isUpdatingWindow = isUpdatingBookingWindow === t.id;

                  return (
                    <React.Fragment key={t.id}>
                      <tr 
                        onClick={() => toggleExpandTrip(t.id)}
                        className={`hover:bg-blue-50/40 transition-colors cursor-pointer ${
                          isExpanded ? 'bg-blue-50/60 font-medium' : ''
                        }`}
                      >
                        <td className="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
                          <BusIcon className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>{t.bus?.bus_number}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-700 max-w-[180px] truncate" title={t.route?.name}>
                          {t.route?.name}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-blue-600">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] ${
                            t.departure_time.includes('03:30') 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {t.departure_time}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              t.status === 'OPEN'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : t.status === 'CLOSED'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : t.status === 'FULL'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {t.status === 'OPEN' ? 'BOOKING: OPEN' : t.status === 'CLOSED' ? 'BOOKING: CLOSED' : t.status}
                            </span>
                            
                            {/* Administrator Open / Close Access Toggle */}
                            <button
                              type="button"
                              disabled={isUpdatingWindow}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleBookingWindow(t.id, t.status === 'OPEN' ? 'CLOSE' : 'OPEN');
                              }}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer shadow-2xs border ${
                                t.status === 'OPEN'
                                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                              }`}
                              title={t.status === 'OPEN' ? 'Close bookings for this bus' : 'Open bookings for students'}
                            >
                              {t.status === 'OPEN' ? (
                                <>
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>{isUpdatingWindow ? 'Closing...' : 'Close Booking'}</span>
                                </>
                              ) : (
                                <>
                                  <Unlock className="w-2.5 h-2.5" />
                                  <span>{isUpdatingWindow ? 'Opening...' : 'Open Booking'}</span>
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <span className="font-bold text-slate-900">{booked}</span>
                          <span className="text-slate-400"> / {total}</span>
                          <span className="text-[10px] text-slate-500 ml-1">({bookedPercent}%)</span>
                        </td>
                        <td className="py-3 px-3 font-mono">
                          <span className="font-bold text-emerald-700">{boarded}</span>
                          <span className="text-slate-400"> of {booked} booked</span>
                        </td>
                        <td className="py-3 px-3 min-w-[120px]">
                          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                            <div 
                              className="bg-emerald-600 h-full transition-all duration-300"
                              style={{ width: `${booked > 0 ? (boarded / total) * 100 : 0}%` }}
                              title={`${boarded} boarded`}
                            />
                            <div 
                              className="bg-amber-400 h-full transition-all duration-300"
                              style={{ width: `${booked > 0 ? (pending / total) * 100 : 0}%` }}
                              title={`${pending} booked & awaiting boarding`}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                            <span>{boardedPercent}% boarded</span>
                            <span>{pending} pending</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-700 font-medium">
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span className="font-semibold text-slate-900 truncate max-w-[130px]" title={t.driver?.name}>
                                {t.driver?.name ? t.driver.name.split(' (')[0] : 'Unassigned'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAssignDriverModal(t);
                              }}
                              className="text-[10px] text-blue-700 hover:text-blue-900 font-bold bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded border border-blue-200/60 inline-flex items-center gap-1 cursor-pointer"
                              title="Assign driver for this trip (1 driver per bus per day rule)"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                              <span>Assign Driver</span>
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandTrip(t.id);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 p-1.5 rounded-lg hover:bg-blue-100/60 transition-colors"
                          >
                            <span>{isExpanded ? 'Close' : 'Open Bus'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Table Row Showing Booked and Boarded Stats */}
                      {isExpanded && (
                        <tr className="bg-slate-50/95 border-b-2 border-blue-200">
                          <td colSpan={9} className="p-5">
                            <div className="space-y-4">
                              
                              {/* Bus Header & Live Ratios */}
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-slate-900">
                                      {t.bus?.bus_number} — {t.bus?.bus_name}
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">
                                      Departure: {t.departure_time}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      Bay: <strong className="text-slate-800">{t.parking_bay}</strong>
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 mt-0.5">
                                    Route: {t.route?.name}
                                  </p>
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                  {/* Open / Close Booking Fast Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBookingWindow(t.id, t.status === 'OPEN' ? 'CLOSE' : 'OPEN')}
                                    className={`py-1.5 px-3 rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                                      t.status === 'OPEN'
                                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    }`}
                                  >
                                    {t.status === 'OPEN' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                    <span>{t.status === 'OPEN' ? 'Close Bus Bookings' : 'Open Bus Bookings'}</span>
                                  </button>

                                  {/* Assign Driver Fast Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAssignDriverModal(t)}
                                    className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>Assign Driver</span>
                                  </button>

                                  {pending > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => handleSendAdminTripReminders(t.id)}
                                      disabled={sendingReminderTripId === t.id}
                                      className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                      title="Send departure reminder notifications to unboarded students"
                                    >
                                      <Bell className="w-3.5 h-3.5" />
                                      <span>
                                        {sendingReminderTripId === t.id
                                          ? 'Sending...'
                                          : `Send Reminders (${pending} unboarded)`}
                                      </span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => toggleExpandTrip(t.id)}
                                    className="py-1.5 px-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg"
                                  >
                                    Collapse
                                  </button>
                                </div>
                              </div>

                              {/* Policy Status Ribbons: Booking Window & Driver Allocation */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Booking Window Card */}
                                <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                                  t.status === 'OPEN' 
                                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                                    : 'bg-rose-50/80 border-rose-200 text-rose-900'
                                }`}>
                                  <div>
                                    <div className="flex items-center gap-1.5 font-bold text-xs">
                                      {t.status === 'OPEN' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Lock className="w-4 h-4 text-rose-600" />}
                                      <span>Booking Window: {t.status === 'OPEN' ? 'OPEN FOR STUDENTS (₹0)' : 'CLOSED BY ADMINISTRATOR'}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-600 mt-0.5">
                                      {t.status === 'OPEN' 
                                        ? 'Students can select seats on the bus map and book tickets.' 
                                        : 'Seat selection is currently locked for this trip. Click below to open.'}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBookingWindow(t.id, t.status === 'OPEN' ? 'CLOSE' : 'OPEN')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0 ${
                                      t.status === 'OPEN'
                                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                    }`}
                                  >
                                    {t.status === 'OPEN' ? '🔒 Close Now' : '🔓 Open Now'}
                                  </button>
                                </div>

                                {/* Driver Policy Card */}
                                <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/80 text-blue-900 flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-1.5 font-bold text-xs">
                                      <UserCheck className="w-4 h-4 text-blue-600" />
                                      <span>Driver: {t.driver?.name || 'Unassigned'}</span>
                                    </div>
                                    <p className="text-[11px] text-blue-700 mt-0.5">
                                      1-Driver-1-Bus Policy: Driver assigned only to this shuttle for today ({t.travel_date}).
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenAssignDriverModal(t)}
                                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shrink-0"
                                  >
                                    Change Driver
                                  </button>
                                </div>
                              </div>

                              {/* 4 Summary Stat Cards */}
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
                                  <div className="text-[11px] font-medium text-slate-500">Total Seat Capacity</div>
                                  <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                                    {total} <span className="text-xs text-slate-500 font-normal">seats</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">Layout: 2x2 Coach</div>
                                </div>

                                <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-xs">
                                  <div className="text-[11px] font-medium text-blue-700">Seats Booked</div>
                                  <div className="text-xl font-bold font-mono text-blue-900 mt-1">
                                    {booked} <span className="text-xs text-blue-600 font-normal">({bookedPercent}%)</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    {total - booked} vacant seats remaining
                                  </div>
                                </div>

                                <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-xs">
                                  <div className="text-[11px] font-medium text-emerald-700">Passengers Boarded</div>
                                  <div className="text-xl font-bold font-mono text-emerald-800 mt-1">
                                    {boarded} <span className="text-xs text-emerald-600 font-normal">({boardedPercent}%)</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">Verified via QR scanner</div>
                                </div>

                                <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-xs">
                                  <div className="text-[11px] font-medium text-amber-700">Unboarded / Awaiting</div>
                                  <div className="text-xl font-bold font-mono text-amber-900 mt-1">
                                    {pending} <span className="text-xs text-amber-600 font-normal">students</span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    {pending === 0 ? '✓ Complete attendance' : 'Reminders can be sent'}
                                  </div>
                                </div>
                              </div>

                              {/* Detailed Passenger Roster for this Bus */}
                              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                                <div className="py-2.5 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                  <span className="text-xs font-bold text-slate-800">
                                    Passenger Manifest & Boarding Roster ({booked} students)
                                  </span>
                                  <span className="text-[11px] text-slate-500">
                                    Bus {t.bus?.bus_number} · Departure {t.departure_time}
                                  </span>
                                </div>

                                {isLoadingManifest ? (
                                  <div className="p-6 text-center text-xs text-slate-500">
                                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                    <span>Loading live manifest...</span>
                                  </div>
                                ) : (manifest?.manifest || t.passengers || []).length === 0 ? (
                                  <div className="p-6 text-center text-xs text-slate-500">
                                    No students have reserved seats on this bus yet. Bookings are open in the student portal.
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto max-h-64 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-50/70 text-slate-600 border-b border-slate-200 sticky top-0">
                                        <tr>
                                          <th className="py-2 px-3 font-semibold">Seat</th>
                                          <th className="py-2 px-3 font-semibold">Student Name</th>
                                          <th className="py-2 px-3 font-semibold">Roll No</th>
                                          <th className="py-2 px-3 font-semibold">Booking Ref</th>
                                          <th className="py-2 px-3 font-semibold">Boarding Status</th>
                                          <th className="py-2 px-3 font-semibold">Boarded At</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {(manifest?.manifest || t.passengers || []).map((p: any) => (
                                          <tr key={p.booking_id || p.seat_id} className="hover:bg-slate-50/80">
                                            <td className="py-2 px-3 font-mono font-bold text-slate-900">{p.seat_id}</td>
                                            <td className="py-2 px-3 font-medium text-slate-800">{p.student_name}</td>
                                            <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{p.student_id_number || p.student_roll || '—'}</td>
                                            <td className="py-2 px-3 font-mono text-blue-600 font-medium">{p.booking_reference}</td>
                                            <td className="py-2 px-3">
                                              {p.boarding_status === 'BOARDED' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                  <CheckCircle2 className="w-3 h-3" /> BOARDED
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                  <Clock className="w-3 h-3" /> NOT BOARDED
                                                </span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">
                                              {p.boarded_at
                                                ? new Date(p.boarded_at).toLocaleTimeString('en-IN', {
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
                                )}
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Bus Fleet */}
      {activeTab === 'fleet' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-600" />
                  <span>Add Bus with Transit Route to Campus Fleet</span>
                </h3>
                <p className="text-xs text-slate-500">
                  New buses and routes added here automatically deploy to all students for seat booking and drivers for QR boarding verification.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Batch Departures:</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  03:30 PM
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  04:30 PM
                </span>
              </div>
            </div>

            <form onSubmit={handleAddBus} className="space-y-4">
              {/* Bus Details Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bus Number / Reg *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bus 105 or TN 37 CIT 105"
                    value={newBusNumber}
                    onChange={e => setNewBusNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-xs rounded-lg p-2 font-mono font-medium"
                  />
                  <span className="text-[10px] text-slate-500">Route number is used as bus number</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Bus Line Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Vadavalli Express or OMR Shuttle"
                    value={newBusName}
                    onChange={e => setNewBusName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-xs rounded-lg p-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Seat Capacity</label>
                  <select
                    value={newBusCapacity}
                    onChange={e => setNewBusCapacity(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-xs rounded-lg p-2 font-medium"
                  >
                    <option value="24">24 seats (6 rows x 4)</option>
                    <option value="28">28 seats (7 rows x 4)</option>
                    <option value="32">32 seats (8 rows x 4) — Standard</option>
                    <option value="36">36 seats (9 rows x 4)</option>
                    <option value="40">40 seats (10 rows x 4)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Parking Bay</label>
                  <input
                    type="text"
                    placeholder={`e.g. Bay ${(buses.length % 10) + 1} — Campus Ground`}
                    value={newBusParkingBay}
                    onChange={e => setNewBusParkingBay(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 text-xs rounded-lg p-2"
                  />
                </div>
              </div>

              {/* Route Assignment Section */}
              <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    Route Assignment for this Bus:
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="routeOption"
                        checked={newBusRouteOption === 'existing'}
                        onChange={() => setNewBusRouteOption('existing')}
                        className="text-blue-600"
                      />
                      <span>Select Existing Route</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                      <input
                        type="radio"
                        name="routeOption"
                        checked={newBusRouteOption === 'new'}
                        onChange={() => setNewBusRouteOption('new')}
                        className="text-blue-600"
                      />
                      <span>Create New Route</span>
                    </label>
                  </div>
                </div>

                {newBusRouteOption === 'existing' ? (
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Choose Route</label>
                    <select
                      value={newBusSelectedRouteId}
                      onChange={e => setNewBusSelectedRouteId(e.target.value)}
                      className="w-full bg-white border border-slate-300 text-xs rounded-lg p-2 font-medium"
                    >
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.ordered_stops.length} stops)
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">New Route Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Route 105: Siruseri IT Park ⇄ CIT Campus"
                        value={newBusNewRouteName}
                        onChange={e => setNewBusNewRouteName(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-xs rounded-lg p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        Ordered Stops (comma-separated sequence) *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Siruseri IT Park, Navalur, Sholinganallur, Medavakkam, CIT"
                        value={newBusNewRouteStops}
                        onChange={e => setNewBusNewRouteStops(e.target.value)}
                        className="w-full bg-white border border-slate-300 text-xs rounded-lg p-2"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Departure Batch Scheduling Options */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scheduled Departure Timings:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setNewBusDepartureBatch('BOTH')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                        newBusDepartureBatch === 'BOTH'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      <span>Both 03:30 PM & 04:30 PM Batches (Recommended)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBusDepartureBatch('03:30 PM')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        newBusDepartureBatch === '03:30 PM'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      03:30 PM Batch 1 Only
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBusDepartureBatch('04:30 PM')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                        newBusDepartureBatch === '04:30 PM'
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      04:30 PM Batch 2 Only
                    </button>
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full sm:w-auto py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Bus & Deploy to Students & Drivers</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Bus Fleet Grid with Live Booked & Boarded Overview */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Active Campus Fleet ({buses.length} Buses)
              </h4>
              <span className="text-xs text-slate-500">
                Click any bus to inspect scheduled departure batches
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {buses.map(b => {
                const busTrips = trips.filter(t => t.bus_id === b.id || t.bus?.id === b.id);
                const hasBatch1 = busTrips.some(t => t.departure_time.includes('03:30'));
                const hasBatch2 = busTrips.some(t => t.departure_time.includes('04:30'));
                const totalBooked = busTrips.reduce((acc, t) => acc + (t.booked_seats_count || 0), 0);
                const totalBoarded = busTrips.reduce((acc, t) => acc + (t.boarded_seats_count || 0), 0);
                const totalCapacity = busTrips.reduce((acc, t) => acc + (t.total_seats || b.capacity || 32), 0);

                return (
                  <div 
                    key={b.id} 
                    className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-blue-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                            <BusIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-mono font-bold text-sm text-slate-900 block">{b.bus_number}</span>
                            <span className="text-[11px] text-slate-500">{b.bus_name}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                          ACTIVE
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 mb-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <span className="text-[10px] font-medium text-slate-400 block uppercase">Assigned Route</span>
                        <span className="font-medium text-slate-800">
                          {routes.find(r => r.id === b.route_number?.toString() || r.route_number === b.route_number)?.name || 'Campus Transit Route'}
                        </span>
                      </div>

                      {/* Cumulative Booked & Boarded Summary for this Bus */}
                      <div className="grid grid-cols-2 gap-2 mb-3 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Booked Seats</span>
                          <span className="font-mono font-bold text-blue-900">
                            {totalBooked} <span className="text-[10px] font-normal text-slate-500">/ {totalCapacity || b.capacity}</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Boarded</span>
                          <span className="font-mono font-bold text-emerald-700">
                            {totalBoarded} <span className="text-[10px] font-normal text-slate-500">passengers</span>
                          </span>
                        </div>
                      </div>

                      {/* Scheduled Departure Batches */}
                      <div className="space-y-1.5 mb-3">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                          Today's Departure Batches:
                        </span>
                        {busTrips.length === 0 ? (
                          <div className="text-[11px] text-slate-400 italic">No trips scheduled today</div>
                        ) : (
                          busTrips.map(bt => (
                            <div 
                              key={bt.id} 
                              onClick={() => {
                                setActiveTab('trips');
                                toggleExpandTrip(bt.id);
                              }}
                              className="flex items-center justify-between p-2 rounded-lg bg-blue-50/50 hover:bg-blue-100/50 border border-blue-100 transition-colors cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-blue-600" />
                                <span className="font-mono font-bold text-blue-900">{bt.departure_time}</span>
                              </div>
                              <div className="text-[11px] font-mono text-slate-600">
                                <span className="text-blue-700 font-semibold">{bt.booked_seats_count || 0} booked</span> · 
                                <span className="text-emerald-700 font-semibold ml-1">{bt.boarded_seats_count || 0} boarded</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Quick batch buttons if missing */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[11px]">
                      <span className="text-slate-400 font-mono">{b.capacity} seats</span>
                      <div className="flex gap-1">
                        {!hasBatch1 && (
                          <button
                            type="button"
                            onClick={async () => {
                              const routeId = routes.find(r => r.route_number === b.route_number)?.id || routes[0]?.id;
                              if (!routeId) return;
                              await fetch(`${API_BASE}/trips`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.id}` },
                                body: JSON.stringify({
                                  bus_id: b.id,
                                  route_id: routeId,
                                  departure_time: '03:30 PM',
                                  parking_bay: `Bay ${(buses.indexOf(b) % 10) + 1} — Campus Ground`
                                })
                              });
                              setFeedback({ type: 'success', text: `Scheduled 03:30 PM batch for ${b.bus_number}` });
                              await loadAll();
                            }}
                            className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold transition-colors"
                          >
                            + 3:30 PM
                          </button>
                        )}
                        {!hasBatch2 && (
                          <button
                            type="button"
                            onClick={async () => {
                              const routeId = routes.find(r => r.route_number === b.route_number)?.id || routes[0]?.id;
                              if (!routeId) return;
                              await fetch(`${API_BASE}/trips`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.id}` },
                                body: JSON.stringify({
                                  bus_id: b.id,
                                  route_id: routeId,
                                  departure_time: '04:30 PM',
                                  parking_bay: `Bay ${(buses.indexOf(b) % 10) + 1} — Campus Ground`
                                })
                              });
                              setFeedback({ type: 'success', text: `Scheduled 04:30 PM batch for ${b.bus_number}` });
                              await loadAll();
                            }}
                            className="px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold transition-colors"
                          >
                            + 4:30 PM
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Routes & Stops */}
      {activeTab === 'routes' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Create New Transit Route</h3>
            <form onSubmit={handleAddRoute} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Route Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Campus Gate ⇄ Vadavalli Bus Stand"
                  value={newRouteName}
                  onChange={e => setNewRouteName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-xs rounded-lg p-2"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ordered Stops (comma-separated in sequence) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CIT Main Gate, Peelamedu, Gandhipuram, Lawley Road, Vadavalli"
                  value={newRouteStops}
                  onChange={e => setNewRouteStops(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 text-xs rounded-lg p-2"
                />
              </div>
              <button
                type="submit"
                className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                Create Route
              </button>
            </form>
          </div>

          <div className="space-y-3">
            {routes.map(r => (
              <div key={r.id} className="bg-white p-5 rounded-2xl border border-slate-200">
                <h4 className="font-bold text-sm text-slate-900 mb-2">{r.name}</h4>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600">
                  {r.ordered_stops.map((stop, i) => (
                    <React.Fragment key={i}>
                      <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">{stop}</span>
                      {i < r.ordered_stops.length - 1 && <span className="text-slate-400">→</span>}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: QR Security */}
      {activeTab === 'qr-security' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-2">Student QR Identity Registry & Revocation</h3>
          <p className="text-xs text-slate-500 mb-6">
            If a student reports a compromised phone or leaked pass, administrators can immediately revoke their QR identity or provision a new cryptographically opaque token.
          </p>

          <div className="divide-y divide-slate-100">
            {demoUsers.filter(u => u.role === 'student').map(student => {
              const qr = studentQrs.find(q => q.user_id === student.id);
              const isActive = qr && qr.status === 'ACTIVE';

              return (
                <div key={student.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{student.name}</span>
                      <span className="font-mono text-xs text-slate-500">({student.student_id_number || 'ID Pending'})</span>
                      {isActive ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          ACTIVE QR
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                          REVOKED / INACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-mono mt-1">
                      Token: <span className="text-slate-700">{qr?.opaque_qr_identifier || 'None provisioned'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isActive ? (
                      <button
                        onClick={() => handleRevokeQR(student.id)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg text-rose-600 border border-rose-200 hover:bg-rose-50"
                      >
                        Revoke Identity
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRegenerateQR(student.id)}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        Generate New QR
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 5: Email Logs */}
      {activeTab === 'emails' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs overflow-x-auto">
          <h3 className="text-sm font-bold text-slate-900 mb-1">Transactional Booking Confirmation Email Logs</h3>
          <p className="text-xs text-slate-500 mb-4">
            Confirmation emails are automatically dispatched upon atomic seat reservation. Failsafe audit log records recipient, delivery status, and allows manual retry.
          </p>

          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 bg-slate-50">
                <th className="py-2.5 px-3 font-semibold">Recipient</th>
                <th className="py-2.5 px-3 font-semibold">Subject</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold">Sent At</th>
                <th className="py-2.5 px-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {emailLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/50">
                  <td className="py-2.5 px-3 font-medium text-slate-800">
                    <div>{log.recipient_name}</div>
                    <div className="text-[11px] text-slate-500 font-mono">{log.recipient_email}</div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 max-w-xs truncate" title={log.body_preview}>
                    {log.subject}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {log.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                    {new Date(log.sent_at).toLocaleTimeString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => handleRetryEmail(log.id)}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      Resend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab 6: Policies & Settings */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-2xl">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Campus Security & Email Verification Policies</h3>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="font-bold text-xs text-slate-900 block">
                  Enforce Campus Domain Restriction
                </span>
                <span className="text-[11px] text-slate-500">
                  When enabled, only student emails ending in <code className="text-blue-600 font-mono">@citchennai.net</code> will be accepted during registration.
                </span>
              </div>
              <button
                onClick={handleToggleDomainRestriction}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  settings?.restrict_email_domain
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                {settings?.restrict_email_domain ? 'Enforced' : 'Flexible Demo'}
              </button>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-xs text-blue-900 space-y-1">
              <span className="font-bold block">Current Active Timezone:</span>
              <p>Asia/Kolkata (IST). All booking windows and scheduled departure countdowns strictly adhere to college operating hours.</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Daily Bus Identification Map (Authenticator) */}
      {activeTab === 'bus-map' && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    <MapPin className="w-3 h-3 text-amber-600" />
                    Daily Authenticator Console
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Auto-Displayed on Login
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  Campus Bus Identification & Parking Bay Allocation Map
                </h2>
                <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                  This map is automatically displayed to students and drivers each time they log in. As the campus Authenticator, update this map each day to reflect today's parking bay assignments and bus numbers. The official uploaded example remains active in the app until you replace it with a new daily map.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {onOpenMapModal && (
                  <button
                    onClick={onOpenMapModal}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview Student Popup</span>
                  </button>
                )}
                <button
                  onClick={handleResetBusMapToDefault}
                  disabled={isPublishingMap}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors"
                  title="Reset to official default example map"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset to Example</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2-Column: Current Live Map vs Update / Upload Today's Map */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left: Current Active Map Card (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span>Currently Active Map in App</span>
                  </h3>
                  <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live v{busMap?.version || 1}
                  </span>
                </div>

                <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-900 group">
                  <img
                    src={appAssetUrl(busMap?.image_url || DEFAULT_BUS_MAP_IMAGE)}
                    alt="Active Bus Identification Map"
                    className="w-full max-h-72 object-contain bg-slate-900 p-1"
                  />
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {onOpenMapModal && (
                      <button
                        onClick={onOpenMapModal}
                        className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-semibold flex items-center gap-1.5 shadow-md hover:bg-slate-100"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Inspect Full Map</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Metadata List */}
                <div className="mt-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Effective Date:</span>
                    <strong className="text-slate-800">{busMap?.effective_date || mapDate}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Verified By Authenticator:</span>
                    <strong className="text-slate-800">{busMap?.updated_by_name || 'Transport Authenticator'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Last Published:</span>
                    <span className="text-slate-700 font-mono text-[11px]">
                      {busMap?.updated_at ? new Date(busMap.updated_at).toLocaleString() : 'Today'}
                    </span>
                  </div>
                  <div className="pt-1">
                    <span className="text-slate-500 block mb-1">Today's Instructions:</span>
                    <div className="p-2.5 rounded-lg bg-blue-50/80 border border-blue-100 text-blue-900 text-[11px] leading-relaxed">
                      {busMap?.notes || 'No specific parking directives attached for today.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Upload & Publish Today's Map Form (7 cols) */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Upload & Publish Today's Bus Identification Map
                    </h3>
                    <p className="text-xs text-slate-500">
                      Change the daily bus layout or attach fresh photo/diagram for parking bays.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    Daily Authenticator
                  </span>
                </div>

                <form onSubmit={handlePublishBusMap} className="space-y-4">
                  {/* File Upload Box */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Upload New Map Image (from Computer / Mobile)
                    </label>
                    <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-4 text-center bg-slate-50/50 hover:bg-blue-50/30 transition-colors cursor-pointer relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        title="Upload Map Image"
                      />
                      <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-700">
                        Click or drag & drop today's new map image here
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Supports JPEG, PNG, WebP up to 10MB
                      </p>
                    </div>
                  </div>

                  {/* Preset / Default Example Button */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-500">Or use standard example:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setMapImageUrl(DEFAULT_BUS_MAP_IMAGE);
                        setFeedback({ type: 'success', text: 'Loaded official CIT Example Map image.' });
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline"
                    >
                      Use Official CIT Example Layout Image
                    </button>
                  </div>

                  {/* Map Title */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Map Display Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={mapTitle}
                      onChange={e => setMapTitle(e.target.value)}
                      placeholder="e.g. CIT Campus Bus Identification & Parking Bay Allocation Map"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Date & Authenticator Name Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Effective Date (Today) *
                      </label>
                      <input
                        type="date"
                        required
                        value={mapDate}
                        onChange={e => setMapDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Authenticator Name / Designation
                      </label>
                      <input
                        type="text"
                        value={mapUpdatedBy}
                        onChange={e => setMapUpdatedBy(e.target.value)}
                        placeholder="Dr. V. Sundaram (Transport Authenticator)"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Image URL / Source */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Map Image URL / Base64 Source *
                    </label>
                    <input
                      type="text"
                      required
                      value={mapImageUrl.startsWith('data:') ? `[Uploaded Image: ${mapImageUrl.substring(0, 32)}...]` : mapImageUrl}
                      onChange={e => setMapImageUrl(e.target.value)}
                      placeholder="assets/aistudio/... or https://..."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
                    />
                  </div>

                  {/* Authenticator Directives / Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Today's Authenticator Instructions & Parking Bay Directives
                    </label>
                    <textarea
                      rows={3}
                      value={mapNotes}
                      onChange={e => setMapNotes(e.target.value)}
                      placeholder="e.g. Buses 1 to 20 parked at Main Gate Bay; Buses 21-68 at Ground Bay. Route numbers are used as bus numbers. Students must board before 5:00 PM."
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      This directive appears highlighted at the top of the student and driver map viewer.
                    </p>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isPublishingMap}
                      className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isPublishingMap ? 'Deploying to Students & Drivers...' : "Publish Today's Updated Map (Deploy to All)"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Driver Assignment Modal (Strict 1 Driver per Bus/Trip per Day Policy) */}
      {assigningDriverTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-blue-600" />
                  <span>Assign Driver — {assigningDriverTrip.bus?.bus_number}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Route: {assigningDriverTrip.route?.name} · Departure: {assigningDriverTrip.departure_time}
                </p>
              </div>
              <button
                onClick={() => setAssigningDriverTrip(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg hover:bg-slate-200/60 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Policy Info Card */}
            <div className="p-5 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block mb-0.5">Single-Driver-Per-Day Policy (Enforced)</strong>
                  <span>One driver is associated with only one bus in one day. To prevent fatigue and scheduling conflicts, drivers assigned to any other bus or trip today are locked out.</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Select Campus Driver for Today ({assigningDriverTrip.travel_date}):
                </label>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {allDrivers.map(d => {
                    const avail = driverAvailability.find(a => a.driver.id === d.id);
                    const isAssignedToOther = avail?.is_assigned_today && avail?.assigned_trip_id !== assigningDriverTrip.id;
                    const isCurrent = d.id === assigningDriverTrip.assigned_driver_id;
                    const isSelected = selectedDriverForAssign === d.id;

                    return (
                      <label
                        key={d.id}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${
                          isAssignedToOther
                            ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                            : isSelected
                            ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-500 cursor-pointer'
                            : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="driver_assignment"
                            disabled={isAssignedToOther}
                            checked={isSelected}
                            onChange={() => setSelectedDriverForAssign(d.id)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{d.name}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                                  Current
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {d.phone || d.email}
                            </div>
                          </div>
                        </div>

                        <div>
                          {isAssignedToOther ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Busy: {avail?.assigned_bus_number} ({avail?.assigned_departure_time})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              ✓ Available
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setAssigningDriverTrip(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingDriver || !selectedDriverForAssign}
                onClick={handleSaveDriverAssignment}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                {isSavingDriver ? 'Assigning Driver...' : 'Confirm Driver Assignment'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
