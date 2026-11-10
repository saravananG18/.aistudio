import React, { createContext, useContext, useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { 
  initGmailAuth, 
  signInWithGoogleForGmail, 
  signOutGmail, 
  getCachedAccessToken,
  sendBookingConfirmationGmail,
  sendBoardingIntimationGmail,
  GoogleAuthResult
} from '../services/gmail.ts';

export type ConnectGmailResult = GoogleAuthResult;

interface GmailContextType {
  googleUser: FirebaseUser | null;
  isConnected: boolean;
  isConnecting: boolean;
  connectError: string | null;
  clearConnectError: () => void;
  connectGmail: () => Promise<ConnectGmailResult>;
  disconnectGmail: () => Promise<void>;
  sendBookingConfirmation: typeof sendBookingConfirmationGmail;
  sendBoardingIntimation: typeof sendBoardingIntimationGmail;
}

const GmailContext = createContext<GmailContextType | undefined>(undefined);

export const GmailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initGmailAuth(
      (user, _token) => {
        setGoogleUser(user);
        setConnectError(null);
      },
      () => {
        setGoogleUser(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const clearConnectError = () => {
    setConnectError(null);
  };

  const connectGmail = async (): Promise<ConnectGmailResult> => {
    setIsConnecting(true);
    setConnectError(null);
    try {
      const res = await signInWithGoogleForGmail();
      if (res.success && res.user) {
        setGoogleUser(res.user);
        setConnectError(null);
        return res;
      }
      if (res.cancelled) {
        // User closed or dismissed popup intentionally - no error state needed
        return res;
      }
      if (res.error) {
        setConnectError(res.error);
        return res;
      }
      return { success: false, error: 'Connection was not completed.' };
    } catch (err: any) {
      const msg = err?.message || 'Failed to connect Google Workspace Gmail';
      setConnectError(msg);
      return { success: false, error: msg };
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectGmail = async () => {
    await signOutGmail();
    setGoogleUser(null);
    setConnectError(null);
  };

  const isConnected = !!googleUser && !!getCachedAccessToken();

  return (
    <GmailContext.Provider
      value={{
        googleUser,
        isConnected,
        isConnecting,
        connectError,
        clearConnectError,
        connectGmail,
        disconnectGmail,
        sendBookingConfirmation: sendBookingConfirmationGmail,
        sendBoardingIntimation: sendBoardingIntimationGmail
      }}
    >
      {children}
    </GmailContext.Provider>
  );
};

export const useGmail = () => {
  const context = useContext(GmailContext);
  if (!context) {
    throw new Error('useGmail must be used within a GmailProvider');
  }
  return context;
};
