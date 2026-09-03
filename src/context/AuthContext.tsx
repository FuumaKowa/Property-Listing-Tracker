import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';

interface AuthContextType {
  currentUser: User | null;
  userName: string;
  userEmail: string;
  userPhoto?: string;
  token: string | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  setCustomUserName: (name: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [customName, setCustomName] = useState<string>(() => {
    return localStorage.getItem('listing_tracker_user_name') || '';
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const idToken = await user.getIdToken();
          setToken(idToken);

          // Register or sync user to Cloud SQL database
          await fetch('/api/users/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || user.email?.split('@')[0],
              photoUrl: user.photoURL,
            }),
          }).catch((err) => console.warn('User sync background ping:', err));
        } catch (err) {
          console.error('Failed to get user token:', err);
        }
      } else {
        setToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      console.error('Sign-in error:', err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setToken(null);
    } catch (err) {
      console.error('Sign-out error:', err);
    }
  };

  const setCustomUserName = (name: string) => {
    setCustomName(name);
    localStorage.setItem('listing_tracker_user_name', name);
  };

  // Determine current active user name for audits
  const activeUserName = currentUser?.displayName || currentUser?.email?.split('@')[0] || customName || 'Admin User';
  const activeUserEmail = currentUser?.email || 'user@company.com';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userName: activeUserName,
        userEmail: activeUserEmail,
        userPhoto: currentUser?.photoURL || undefined,
        token,
        loading,
        signInWithGoogle,
        signOut,
        setCustomUserName,
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
