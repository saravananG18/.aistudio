import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User, StudentQRIdentity } from '../types/index.ts';
import { getSupabase } from '../services/supabase.ts';

export interface RegisteredStudentProfile {
  email: string;
  name: string;
  student_id_number?: string;
}

interface AuthContextType {
  user: User | null;
  qrIdentity: StudentQRIdentity | null;
  isLoading: boolean;
  demoUsers: User[];
  savedStudent: RegisteredStudentProfile | null;
  login: (email: string, role?: string) => Promise<void>;
  register: (data: { name: string; email: string; student_id_number?: string; phone?: string }) => Promise<{ is_existing?: boolean }>;
  directAccessStudent: () => Promise<void>;
  clearSavedStudent: () => void;
  logout: () => void;
  verifyEmail: () => Promise<void>;
  switchDemoUser: (userId: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [qrIdentity, setQrIdentity] = useState<StudentQRIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedStudent, setSavedStudent] = useState<RegisteredStudentProfile | null>(() => {
    try {
      const stored = localStorage.getItem('cit_registered_student');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const refreshUser = useCallback(async () => {
    const client = getSupabase();
    const { data: { user: authUser }, error: authError } = await client.auth.getUser();
    if (authError || !authUser) {
      setUser(null);
      setQrIdentity(null);
      setIsLoading(false);
      return;
    }
    const { data: profile, error } = await client.from('profiles').select('*').eq('auth_user_id', authUser.id).single();
    if (error || !profile) {
      setUser(null);
      setQrIdentity(null);
      setIsLoading(false);
      throw new Error('Your account profile is not ready yet. Confirm your email, then sign in again.');
    }
    setUser(profile as User);
    if (profile.role === 'student') {
      const { data: qr } = await client.from('student_qr_identities').select('*')
        .eq('user_id', profile.id).eq('status', 'ACTIVE').maybeSingle();
      setQrIdentity(qr as StudentQRIdentity | null);
    } else {
      setQrIdentity(null);
    }
    if (profile.role === 'student') {
      const saved = { email: profile.email, name: profile.name, student_id_number: profile.student_id_number };
      localStorage.setItem('cit_registered_student', JSON.stringify(saved));
      setSavedStudent(saved);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let client;
    try {
      client = getSupabase();
    } catch (error) {
      console.error(error);
      setIsLoading(false);
      return;
    }
    refreshUser().catch((error) => console.error('Could not load account profile:', error));
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (session) window.setTimeout(() => refreshUser().catch(console.error), 0);
      else {
        setUser(null);
        setQrIdentity(null);
        setIsLoading(false);
      }
    });
    return () => subscription.unsubscribe();
  }, [refreshUser]);

  const redirectUrl = `${window.location.origin}${import.meta.env.BASE_URL || '/'}`;
  const login = async (email: string) => {
    const { error } = await getSupabase().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: false, emailRedirectTo: redirectUrl }
    });
    if (error) throw error;
  };

  const register = async (data: { name: string; email: string; student_id_number?: string; phone?: string }) => {
    const email = data.email.trim().toLowerCase();
    const { error } = await getSupabase().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectUrl,
        data: { name: data.name.trim(), student_id_number: data.student_id_number?.trim(), phone: data.phone?.trim() }
      }
    });
    if (error) throw error;
    const saved = { email, name: data.name.trim(), student_id_number: data.student_id_number?.trim() };
    localStorage.setItem('cit_registered_student', JSON.stringify(saved));
    setSavedStudent(saved);
    return {};
  };

  const directAccessStudent = async () => {
    if (!savedStudent) return;
    await login(savedStudent.email);
  };

  const clearSavedStudent = () => {
    localStorage.removeItem('cit_registered_student');
    setSavedStudent(null);
  };

  const logout = () => { void getSupabase().auth.signOut(); };
  const verifyEmail = refreshUser;
  const switchDemoUser = async (_userId: string) => {
    throw new Error('Demo sign-in is disabled. Use the secure email sign-in link instead.');
  };

  return (
    <AuthContext.Provider value={{
      user, qrIdentity, isLoading, demoUsers: [], savedStudent, login, register,
      directAccessStudent, clearSavedStudent, logout, verifyEmail, switchDemoUser, refreshUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
