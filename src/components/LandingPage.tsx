import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { GraduationCap, ShieldCheck, Bus, ArrowRight, CheckCircle2, Lock, Sparkles } from 'lucide-react';

interface LandingPageProps {
  onSelectRole: (role: 'student' | 'staff') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSelectRole }) => {
  const { login, register, demoUsers, switchDemoUser, savedStudent, directAccessStudent, clearSavedStudent } = useAuth();
  const [activeModal, setActiveModal] = useState<'student-auth' | 'staff-login' | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Form states
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const handleDirectAccess = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await directAccessStudent();
      setActiveModal(null);
    } catch (err: any) {
      console.error('Direct access failed:', err);
      setError(err?.message || 'Unable to direct access student account. Please sign in or register.');
      setActiveModal('student-auth');
      setAuthMode('login');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessNotice(null);
    setIsSubmitting(true);
    try {
      if (authMode === 'register') {
        if (!name || !email) {
          setError('Full Name and Email are required.');
          setIsSubmitting(false);
          return;
        }
        const res = await register({ name, email, student_id_number: studentId, phone });
        if (res.is_existing) {
          setSuccessNotice('Account already registered! Directly accessing your student account...');
        }
      } else {
        if (!email) {
          setError('Email is required.');
          setIsSubmitting(false);
          return;
        }
        await login(email, 'student');
      }
      setActiveModal(null);
    } catch (err: any) {
      setError(err.message || 'Authentication error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      if (!email) {
        setError('Staff email is required.');
        setIsSubmitting(false);
        return;
      }
      await login(email); // Server validates if role is driver/admin
      setActiveModal(null);
    } catch (err: any) {
      setError(err.message || 'Staff login failed. Check email or permissions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto w-full">
        
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-semibold mb-4">
            <Bus className="w-3.5 h-3.5" />
            <span>Chennai Institute of Technology — Official Campus Transport</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 mb-3 text-balance">
            Welcome to CIT Booker. How would you like to continue?
          </h1>
          <p className="text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Reserve free campus shuttle seats during scheduled booking windows, generate your personal QR identity, and board swiftly with digital verification.
          </p>
        </div>

        {/* Error notification banner if any */}
        {error && !activeModal && (
          <div className="max-w-3xl mx-auto mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Notice:</span>
              <span>{error}</span>
            </div>
            <button 
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 font-bold px-2 py-0.5 rounded"
            >
              ✕
            </button>
          </div>
        )}

        {/* Direct Access Banner for Registered Students */}
        {savedStudent && (
          <div className="max-w-3xl mx-auto mb-8 bg-linear-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-md">
                      Registered Student • Direct Access
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    Welcome back, {savedStudent.name}!
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {savedStudent.student_id_number ? `Roll No: ${savedStudent.student_id_number} • ` : ''}{savedStudent.email}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDirectAccess}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold transition-colors shadow-xs flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <span>{isSubmitting ? 'Accessing...' : 'Direct Access'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={clearSavedStudent}
                  className="px-2.5 py-2.5 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 text-xs font-medium transition-colors"
                  title="Switch to a different student or device"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2 Primary Cards: Student vs Driver/Administrator */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-12">
          
          {/* Student Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-6">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Student</h2>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Explore buses, check routes and reserve your seat. Receive a unique personal QR identity for verified boarding.
              </p>
              <ul className="space-y-2 mb-6 text-xs text-slate-500">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Free seat reservation (₹0 cost)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Interactive 2x2 coach layout selection</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Direct account access without repeating registration</span>
                </li>
              </ul>
            </div>
            {savedStudent ? (
              <div className="space-y-2">
                <button
                  onClick={handleDirectAccess}
                  disabled={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs"
                >
                  <span>Direct Access as {savedStudent.name.split(' ')[0]}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setActiveModal('student-auth');
                    setAuthMode('login');
                    setError(null);
                  }}
                  className="w-full text-center text-xs text-blue-600 hover:underline py-1"
                >
                  Or enter another student account
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setActiveModal('student-auth');
                  setAuthMode('login');
                  setError(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors shadow-xs"
              >
                <span>Continue as Student</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Driver / Administrator Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="w-12 h-12 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Driver / Administrator</h2>
              <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                Manage buses, routes, booking windows and boarding. Protected portal with QR camera scanner and passenger manifests.
              </p>
              <ul className="space-y-2 mb-6 text-xs text-slate-500">
                <li className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-700 shrink-0" />
                  <span>Driver camera-based QR scanner</span>
                </li>
                <li className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-700 shrink-0" />
                  <span>Live passenger attendance manifests</span>
                </li>
                <li className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-700 shrink-0" />
                  <span>Fleet scheduling & booking window controls</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => {
                setActiveModal('staff-login');
                setError(null);
              }}
              className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors shadow-xs"
            >
              <span>Staff Login</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* Demo Persona Quick-Access Bar (For immediate testing) */}
        <div className="bg-slate-100/80 border border-slate-200/80 rounded-xl p-4 max-w-3xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="text-xs font-semibold text-slate-800">
                1-Click Demonstration Accounts:
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => switchDemoUser('usr_student_1')}
                className="px-3 py-1.5 text-xs font-medium bg-white text-slate-800 rounded-lg border border-slate-200 hover:border-blue-400 hover:text-blue-600 shadow-2xs transition-colors"
              >
                Aarav (Student)
              </button>
              <button
                onClick={() => switchDemoUser('usr_driver_1')}
                className="px-3 py-1.5 text-xs font-medium bg-white text-slate-800 rounded-lg border border-slate-200 hover:border-blue-400 hover:text-blue-600 shadow-2xs transition-colors"
              >
                Muthukumar (Driver)
              </button>
              <button
                onClick={() => switchDemoUser('usr_admin_1')}
                className="px-3 py-1.5 text-xs font-medium bg-white text-slate-800 rounded-lg border border-slate-200 hover:border-blue-400 hover:text-blue-600 shadow-2xs transition-colors"
              >
                Dr. Sundaramoorthy (Admin)
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Student Auth Modal */}
      {activeModal === 'student-auth' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900">
                {authMode === 'login' ? 'Student Sign In' : 'Student Registration'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-medium p-1"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            {successNotice && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successNotice}</span>
              </div>
            )}

            {savedStudent && (
              <div className="mb-4 p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-xs">
                <div className="font-semibold text-blue-900 mb-1 flex items-center justify-between">
                  <span>Registered Student Found</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">DIRECT ACCESS</span>
                </div>
                <p className="text-slate-600 text-[11px] mb-2">
                  {savedStudent.name} ({savedStudent.email})
                </p>
                <button
                  type="button"
                  onClick={handleDirectAccess}
                  disabled={isSubmitting}
                  className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>{isSubmitting ? 'Accessing...' : `Direct Access to ${savedStudent.name.split(' ')[0]}'s Account`}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleStudentSubmit} className="space-y-4">
              {authMode === 'register' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aarav Sharma"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Student Roll / ID Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 22CIT042"
                      value={studentId}
                      onChange={e => setStudentId(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. aarav.sharma@citchennai.net"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Demo mode accepts any valid email (or use test student: <code className="text-blue-600">aarav.sharma@citchennai.net</code>).
                </p>
              </div>

              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mobile Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98940 12345"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting
                  ? 'Processing...'
                  : authMode === 'login'
                  ? 'Sign In as Student'
                  : 'Register & Provision QR Pass'}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-slate-200 text-center text-xs text-slate-600">
              {authMode === 'login' ? (
                <span>
                  Don't have an account?{' '}
                  <button
                    onClick={() => {
                      setAuthMode('register');
                      setError(null);
                    }}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Register here
                  </button>
                </span>
              ) : (
                <span>
                  Already registered?{' '}
                  <button
                    onClick={() => {
                      setAuthMode('login');
                      setError(null);
                    }}
                    className="text-blue-600 font-semibold hover:underline"
                  >
                    Sign in
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Staff Login Modal */}
      {activeModal === 'staff-login' && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900">
                Authorized Staff Login
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-medium p-1"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              Restricted to authorized college drivers and transport administrators. Public staff registration is prohibited.
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            <form onSubmit={handleStaffSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Staff Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. driver.muthu@citchennai.net or transport@citchennai.net"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1">
                <span className="font-semibold block text-slate-700">Pre-authorized Staff Accounts:</span>
                <div>• Driver: <code className="text-blue-600">driver.muthu@citchennai.net</code> (Bus 1)</div>
                <div>• Driver: <code className="text-blue-600">driver.selvam@citchennai.net</code> (Bus 53)</div>
                <div>• Admin: <code className="text-blue-600">transport@citchennai.net</code></div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Verifying...' : 'Sign In as Staff'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 mt-8">
        CIT Booker — Campus Bus Booking System · Chennai Institute of Technology (CIT Chennai) · All bookings ₹0
      </footer>
    </div>
  );
};
