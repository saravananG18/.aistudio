import React, { lazy, Suspense, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { SeatMapModal } from './components/SeatMapModal.tsx';
import { StudentQRModal } from './components/StudentQRModal.tsx';
import { BusIdentificationMapModal } from './components/BusIdentificationMapModal.tsx';
import { BusIdentificationMap } from './types/index.ts';
import { api } from './services/api.ts';

const LandingPage = lazy(() => import('./components/LandingPage.tsx').then(module => ({ default: module.LandingPage })));
const StudentDashboard = lazy(() => import('./components/StudentDashboard.tsx').then(module => ({ default: module.StudentDashboard })));
const MyBookings = lazy(() => import('./components/MyBookings.tsx').then(module => ({ default: module.MyBookings })));
const DriverScanner = lazy(() => import('./components/DriverScanner.tsx').then(module => ({ default: module.DriverScanner })));
const AdminPortal = lazy(() => import('./components/AdminPortal.tsx').then(module => ({ default: module.AdminPortal })));

function PortalLoading() {
  return (
    <div className="min-h-48 flex items-center justify-center text-sm font-medium text-slate-500" role="status">
      Loading portal...
    </div>
  );
}

function MainApp() {
  const { user, isLoading } = useAuth();
  const [currentView, setCurrentView] = useState<string>('home');
  const [selectedTripIdForBooking, setSelectedTripIdForBooking] = useState<string | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [busMap, setBusMap] = useState<BusIdentificationMap | null>(null);
  const [isBusMapModalOpen, setIsBusMapModalOpen] = useState(false);
  const [autoOpenedBusMap, setAutoOpenedBusMap] = useState(false);

  // Load Bus Identification Map and display on student or driver login
  React.useEffect(() => {
    const fetchMap = async () => {
      try {
        const res = await api.getBusMap();
        setBusMap(res.bus_map);
      } catch (err) {
        console.error('Failed to load bus identification map:', err);
      }
    };
    fetchMap();
  }, []);

  // When student or driver logs in, display the Bus Identification Map
  React.useEffect(() => {
    if (!user) return;
    if (user.role === 'student' || user.role === 'driver') {
      const today = new Date().toISOString().split('T')[0];
      const sessionKey = `cit_bus_map_acknowledged_${user.id}_${today}`;
      const alreadyAcknowledged = sessionStorage.getItem(sessionKey);
      
      if (!alreadyAcknowledged) {
        setIsBusMapModalOpen(true);
        setAutoOpenedBusMap(true);
        sessionStorage.setItem(sessionKey, 'true');
      }
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-semibold text-slate-600">Initializing CIT Booker...</p>
        </div>
      </div>
    );
  }

  // If unauthenticated, show Landing Page with Role Selection
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar
          currentView="landing"
          onNavigate={() => setCurrentView('landing')}
          onOpenQRModal={() => {}}
          onOpenBusMap={() => {
            setIsBusMapModalOpen(true);
            setAutoOpenedBusMap(false);
          }}
        />
        <Suspense fallback={<PortalLoading />}>
          <LandingPage onSelectRole={() => {}} />
        </Suspense>
        <BusIdentificationMapModal
          isOpen={isBusMapModalOpen}
          onClose={() => setIsBusMapModalOpen(false)}
          busMap={busMap}
          role="guest"
          autoOpened={false}
        />
      </div>
    );
  }

  // Role-based routing
  const renderContent = () => {
    // 1. Student Portal
    if (user.role === 'student') {
      if (currentView === 'my-bookings') {
        return (
          <MyBookings
            onBackToBuses={() => setCurrentView('buses')}
            onOpenQR={() => setIsQRModalOpen(true)}
          />
        );
      }
      return (
        <StudentDashboard
          onSelectTrip={(tripId) => setSelectedTripIdForBooking(tripId)}
          onOpenQR={() => setIsQRModalOpen(true)}
          onNavigateMyBookings={() => setCurrentView('my-bookings')}
          onOpenBusMap={() => {
            setIsBusMapModalOpen(true);
            setAutoOpenedBusMap(false);
          }}
        />
      );
    }

    // 2. Driver Portal
    if (user.role === 'driver') {
      return (
        <DriverScanner 
          onOpenBusMap={() => {
            setIsBusMapModalOpen(true);
            setAutoOpenedBusMap(false);
          }}
        />
      );
    }

    // 3. Administrator Portal
    if (user.role === 'admin') {
      return (
        <AdminPortal 
          currentView={currentView}
          onBusMapUpdated={(updated) => setBusMap(updated)}
          onOpenMapModal={() => {
            setIsBusMapModalOpen(true);
            setAutoOpenedBusMap(false);
          }}
        />
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      <Navbar
        currentView={currentView}
        onNavigate={(view) => {
          if (view === 'home' || view === 'buses') {
            setCurrentView(user.role === 'student' ? 'buses' : user.role === 'driver' ? 'driver-scanner' : 'admin-fleet');
          } else {
            setCurrentView(view);
          }
        }}
        onOpenQRModal={() => setIsQRModalOpen(true)}
        onOpenBusMap={() => {
          setIsBusMapModalOpen(true);
          setAutoOpenedBusMap(false);
        }}
      />

      <main className="flex-1">
        <Suspense fallback={<PortalLoading />}>
          {renderContent()}
        </Suspense>
      </main>

      {/* Daily Bus Identification Map Modal (Shown on Student/Driver login or header click) */}
      <BusIdentificationMapModal
        isOpen={isBusMapModalOpen}
        onClose={() => setIsBusMapModalOpen(false)}
        busMap={busMap}
        role={user?.role || 'student'}
        autoOpened={autoOpenedBusMap}
      />

      {/* Seat Selection & Booking Modal */}
      {selectedTripIdForBooking && (
        <SeatMapModal
          tripId={selectedTripIdForBooking}
          onClose={() => setSelectedTripIdForBooking(null)}
          onBookingSuccess={() => {
            // refresh happens inside modal
          }}
          onOpenQR={() => setIsQRModalOpen(true)}
        />
      )}

      {/* Student Personal QR Pass Modal */}
      <StudentQRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
      />
    </div>
  );
}

import { GmailProvider } from './context/GmailContext.tsx';

export default function App() {
  return (
    <AuthProvider>
      <GmailProvider>
        <MainApp />
      </GmailProvider>
    </AuthProvider>
  );
}
