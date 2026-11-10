import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, StudentQRIdentity } from '../types/index.ts';
import { api } from '../services/api.ts';

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
  const [demoUsers, setDemoUsers] = useState<User[]>([]);
  const [savedStudent, setSavedStudent] = useState<RegisteredStudentProfile | null>(() => {
    try {
      const stored = localStorage.getItem('cit_registered_student');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const loadDemoUsers = async () => {
    try {
      const data = await api.getDemoUsers();
      setDemoUsers(data.users);
    } catch (err) {
      console.error('Failed to load demo users:', err);
    }
  };

  const refreshUser = async () => {
    const token = localStorage.getItem('cit_booker_token');
    if (!token) {
      setUser(null);
      setQrIdentity(null);
      setIsLoading(false);
      return;
    }
    try {
      const data = await api.getMe();
      setUser(data.user);
      setQrIdentity(data.qr_identity);
    } catch {
      localStorage.removeItem('cit_booker_token');
      setUser(null);
      setQrIdentity(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDemoUsers();
    refreshUser();
  }, []);

  const login = async (email: string, role?: string) => {
    setIsLoading(true);
    try {
      const res = await api.login(email, role);
      localStorage.setItem('cit_booker_token', res.token);
      if (res.user.role === 'student') {
        const profile: RegisteredStudentProfile = {
          email: res.user.email,
          name: res.user.name,
          student_id_number: res.user.student_id_number
        };
        localStorage.setItem('cit_registered_student', JSON.stringify(profile));
        setSavedStudent(profile);
      }
      setUser(res.user);
      setQrIdentity(res.qr_identity);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (data: { name: string; email: string; student_id_number?: string; phone?: string }): Promise<{ is_existing?: boolean }> => {
    setIsLoading(true);
    try {
      const res = await api.registerStudent(data);
      localStorage.setItem('cit_booker_token', res.token);
      const profile: RegisteredStudentProfile = {
        email: res.user.email,
        name: res.user.name,
        student_id_number: res.user.student_id_number
      };
      localStorage.setItem('cit_registered_student', JSON.stringify(profile));
      setSavedStudent(profile);
      setUser(res.user);
      setQrIdentity(res.qr_identity);
      return { is_existing: (res as any).is_existing };
    } finally {
      setIsLoading(false);
    }
  };

  const directAccessStudent = async () => {
    if (!savedStudent) return;
    setIsLoading(true);
    try {
      await login(savedStudent.email, 'student');
    } catch (err: any) {
      console.warn('Direct login failed for saved student, attempting auto-recovery:', err);
      try {
        await register({
          name: savedStudent.name || 'CIT Student',
          email: savedStudent.email,
          student_id_number: savedStudent.student_id_number
        });
      } catch (regErr) {
        console.warn('Student auto-recovery registration failed, falling back to Aarav Sharma:', regErr);
        try {
          await login('aarav.sharma@citchennai.net', 'student');
        } catch (demoErr) {
          clearSavedStudent();
          throw err;
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearSavedStudent = () => {
    localStorage.removeItem('cit_registered_student');
    setSavedStudent(null);
  };

  const logout = () => {
    localStorage.removeItem('cit_booker_token');
    setUser(null);
    setQrIdentity(null);
  };

  const verifyEmail = async () => {
    await api.verifyEmail();
    await refreshUser();
  };

  const switchDemoUser = async (userId: string) => {
    localStorage.setItem('cit_booker_token', userId);
    await refreshUser();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        qrIdentity,
        isLoading,
        demoUsers,
        savedStudent,
        login,
        register,
        directAccessStudent,
        clearSavedStudent,
        logout,
        verifyEmail,
        switchDemoUser,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
