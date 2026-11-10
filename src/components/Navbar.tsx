import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useGmail } from '../context/GmailContext.tsx';
import { Bus, QrCode, Ticket, UserCheck, Shield, LogOut, RefreshCw, Mail, MapPin } from 'lucide-react';

interface NavbarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onOpenQRModal: () => void;
  onOpenBusMap?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentView, onNavigate, onOpenQRModal, onOpenBusMap }) => {
  const { user, qrIdentity, logout, demoUsers, switchDemoUser } = useAuth();
  const { isConnected, googleUser, connectGmail, isConnecting, connectError, clearConnectError } = useGmail();

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-8">
          
          {/* Zone 1: Single Wordmark Brand */}
          <div className="flex items-center gap-3 shrink-0 cursor-pointer" onClick={() => onNavigate('home')}>
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Bus className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap">
                CIT Booker
              </span>
              <span className="text-[11px] text-slate-500 font-medium -mt-1 hidden sm:block">
                Chennai Institute of Technology
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Links (single-line, clean text) */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {user?.role === 'student' && (
              <>
                <button
                  onClick={() => onNavigate('buses')}
                  className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 ${
                    currentView === 'buses' ? 'text-blue-600 font-semibold' : ''
                  }`}
                >
                  Today's Buses
                </button>
                <button
                  onClick={() => onNavigate('my-bookings')}
                  className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 ${
                    currentView === 'my-bookings' ? 'text-blue-600 font-semibold' : ''
                  }`}
                >
                  My Bookings
                </button>
                <button
                  onClick={onOpenQRModal}
                  className="flex items-center gap-1.5 text-slate-700 hover:text-blue-600 transition-colors whitespace-nowrap shrink-0"
                >
                  <QrCode className="w-4 h-4 text-blue-600" />
                  <span>My Boarding Pass</span>
                </button>
                {onOpenBusMap && (
                  <button
                    onClick={onOpenBusMap}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold border border-amber-200 transition-colors whitespace-nowrap shrink-0 text-xs"
                    title="View Daily Bus Identification Map"
                  >
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    <span>Bus Map</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </button>
                )}
              </>
            )}

            {user?.role === 'driver' && (
              <>
                <button
                  onClick={() => onNavigate('driver-scanner')}
                  className={`flex items-center gap-1.5 hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 ${
                    currentView === 'driver-scanner' ? 'text-blue-600 font-semibold' : ''
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>QR Boarding Scanner</span>
                </button>
                <button
                  onClick={() => onNavigate('driver-manifest')}
                  className={`flex items-center gap-1.5 hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 ${
                    currentView === 'driver-manifest' ? 'text-blue-600 font-semibold' : ''
                  }`}
                >
                  <Ticket className="w-4 h-4" />
                  <span>Passenger Manifest</span>
                </button>
                {onOpenBusMap && (
                  <button
                    onClick={onOpenBusMap}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold border border-amber-200 transition-colors whitespace-nowrap shrink-0 text-xs"
                    title="View Daily Bus Identification Map"
                  >
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    <span>Bus Map</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </button>
                )}
              </>
            )}

            {user?.role === 'admin' && (
              <>
                <button
                  onClick={() => onNavigate('admin-fleet')}
                  className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 ${
                    currentView === 'admin-fleet' ? 'text-blue-600 font-semibold' : ''
                  }`}
                >
                  Bus Fleet
                </button>
                <button
                  onClick={() => onNavigate('admin-trips')}
                  className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 ${
                    currentView === 'admin-trips' ? 'text-blue-600 font-semibold' : ''
                  }`}
                >
                  Routes & Trips
                </button>
                <button
                  onClick={() => onNavigate('admin-bus-map')}
                  className={`flex items-center gap-1 hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 ${
                    currentView === 'admin-bus-map' ? 'text-blue-600 font-semibold' : ''
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Daily Map (Auth)</span>
                </button>
                <button
                  onClick={() => onNavigate('admin-qr-manager')}
                  className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 ${
                    currentView === 'admin-qr-manager' ? 'text-blue-600 font-semibold' : ''
                  }`}
                >
                  QR Security
                </button>
                <button
                  onClick={() => onNavigate('admin-emails')}
                  className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 ${
                    currentView === 'admin-emails' ? 'text-blue-600 font-semibold' : ''
                  }`}
                >
                  Email Logs
                </button>
                <button
                  onClick={() => onNavigate('admin-settings')}
                  className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 ${
                    currentView === 'admin-settings' ? 'text-blue-600 font-semibold' : ''
                  }`}
                >
                  Settings
                </button>
                {onOpenBusMap && (
                  <button
                    onClick={onOpenBusMap}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 font-semibold border border-amber-200 transition-colors whitespace-nowrap shrink-0 text-xs"
                    title="Preview Active Bus Identification Map"
                  >
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    <span>View Map</span>
                  </button>
                )}
              </>
            )}
          </nav>

          {/* Zone 3: Account Controls & Demo Persona Switcher */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-3">
                {/* Gmail Workspace Connection Indicator */}
                {isConnected && googleUser ? (
                  <div 
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800"
                    title={`Gmail notifications active for ${googleUser.email}`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-[11px] hidden xl:inline">Gmail: {googleUser.email}</span>
                    <span className="font-semibold text-[11px] xl:hidden">Gmail Active</span>
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={async () => {
                        await connectGmail();
                      }}
                      disabled={isConnecting}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                      title="Sign in with Google to receive booking QR passes & boarding alerts in Gmail"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      <span>{isConnecting ? 'Connecting...' : 'Connect Gmail'}</span>
                    </button>
                    {connectError && (
                      <div className="absolute right-0 top-full mt-2 w-64 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-[11px] shadow-lg z-50 flex items-start justify-between gap-1">
                        <span>{connectError}</span>
                        <button onClick={clearConnectError} className="font-bold text-rose-600 hover:text-rose-900 ml-1">✕</button>
                      </div>
                    )}
                  </div>
                )}

                {/* Persona Switcher for Quick Verification */}
                <div className="hidden lg:flex items-center gap-1 bg-slate-100 rounded-lg p-1 text-xs">
                  <span className="text-slate-500 px-2 font-medium">Demo Role:</span>
                  {demoUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => switchDemoUser(u.id)}
                      className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                        user.id === u.id
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title={`${u.name} (${u.role})`}
                    >
                      {u.role === 'admin' ? 'Admin' : u.role === 'driver' ? 'Driver' : 'Student'}
                    </button>
                  ))}
                </div>

                {/* User Info */}
                <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-semibold">
                    {user.name.charAt(0)}
                  </div>
                  <div className="hidden sm:flex flex-col text-left">
                    <span className="text-xs font-semibold text-slate-900 truncate max-w-[130px]">
                      {user.name}
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize">
                      {user.role} {user.is_verified ? '· Verified' : '· Unverified'}
                    </span>
                  </div>
                </div>

                {/* Sign out */}
                <button
                  onClick={logout}
                  className="p-2 text-slate-500 hover:text-red-600 transition-colors rounded-lg hover:bg-slate-100"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onNavigate('landing')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap shadow-xs"
                >
                  Choose Role
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
