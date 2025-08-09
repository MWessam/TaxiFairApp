import React, { createContext, useContext, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  signInUserAnonymously, 
  signInWithGoogleSilent,
  signInWithGoogle, 
  signOutUser, 
  getCurrentUser, 
  onAuthStateChange 
} from '../firebase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMethod, setAuthMethod] = useState(null); // 'anonymous', 'google_automatic', 'google_manual', or null

  // Cross-platform storage wrapper: uses AsyncStorage on native, localStorage on web
  const webLocalStorage = typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  const storage = {
    getItem: async (key) => {
      if (Platform.OS === 'web' && webLocalStorage) {
        try {
          return webLocalStorage.getItem(key);
        } catch {
          return null;
        }
      }
      try {
        return await AsyncStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: async (key, value) => {
      if (Platform.OS === 'web' && webLocalStorage) {
        try {
          webLocalStorage.setItem(key, value);
          return;
        } catch {
          return;
        }
      }
      try {
        await AsyncStorage.setItem(key, value);
      } catch {
        // ignore
      }
    },
    removeItem: async (key) => {
      if (Platform.OS === 'web' && webLocalStorage) {
        try {
          webLocalStorage.removeItem(key);
          return;
        } catch {
          return;
        }
      }
      try {
        await AsyncStorage.removeItem(key);
      } catch {
        // ignore
      }
    },
  };

  // Initialize authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChange(async (firebaseUser) => {
      setLoading(true);
      
      if (firebaseUser) {
        // User is signed in
        const userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          isAnonymous: firebaseUser.isAnonymous,
          providerData: firebaseUser.providerData
        };
        
        setUser(userData);
        setIsAuthenticated(true);
        
        // Determine auth method
        if (firebaseUser.isAnonymous) {
          setAuthMethod('anonymous');
        } else if (firebaseUser.providerData.some(provider => provider.providerId === 'google.com')) {
          setAuthMethod('google_automatic'); // Default to automatic for Google auth
        }
        
        // Save user data to AsyncStorage
        await storage.setItem('user', JSON.stringify(userData));
        await storage.setItem('authMethod', authMethod || 'google_automatic');
      } else {
        // User is signed out
        setUser(null);
        setIsAuthenticated(false);
        setAuthMethod(null);
        
        // Clear stored user data
        await storage.removeItem('user');
        await storage.removeItem('authMethod');
      }
      
      setLoading(false);
    });

    // Try automatic Google sign-in on app start
    tryAutomaticSignIn();

    // Load cached user data on app start
    loadCachedUser();

    return unsubscribe;
  }, []);

  const tryAutomaticSignIn = async () => {
    try {
      console.log('Trying automatic Google sign-in...');
      const firebaseUser = await signInWithGoogleSilent();
      if (firebaseUser) {
        console.log('Automatic Google sign-in successful');
        setAuthMethod('google_automatic');
        return { success: true, user: firebaseUser };
      }
      console.log('No automatic sign-in available');
      return { success: false, error: 'No automatic sign-in available' };
    } catch (error) {
      console.log('Automatic sign-in failed:', error.message);
      return { success: false, error: error.message };
    }
  };

  const loadCachedUser = async () => {
    try {
      const cachedUser = await storage.getItem('user');
      const cachedAuthMethod = await storage.getItem('authMethod');
      
      if (cachedUser) {
        const userData = JSON.parse(cachedUser);
        setUser(userData);
        setIsAuthenticated(true);
        setAuthMethod(cachedAuthMethod);
      }
    } catch (error) {
      console.log('Error loading cached user:', error);
    }
  };

  const signInAnonymously = async () => {
    try {
      setLoading(true);
      const firebaseUser = await signInUserAnonymously();
      if (firebaseUser) {
        setAuthMethod('anonymous');
        return { success: true, user: firebaseUser };
      }
      return { success: false, error: 'Failed to sign in anonymously' };
    } catch (error) {
      console.error('Error signing in anonymously:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogleAuth = async () => {
    try {
      setLoading(true);
      const firebaseUser = await signInWithGoogle();
      if (firebaseUser) {
        setAuthMethod('google_manual');
        return { success: true, user: firebaseUser };
      }
      return { success: false, error: 'Failed to sign in with Google' };
    } catch (error) {
      console.error('Error signing in with Google:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await signOutUser();
      setUser(null);
      setIsAuthenticated(false);
      setAuthMethod(null);
      
      // Clear stored data
      await storage.removeItem('user');
      await storage.removeItem('authMethod');
      
      return { success: true };
    } catch (error) {
      console.error('Error signing out:', error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const getUserId = () => {
    return user?.uid || null;
  };

  const isUserAnonymous = () => {
    return user?.isAnonymous || false;
  };

  const isUserGoogleAutomatic = () => {
    return authMethod === 'google_automatic';
  };

  const isUserGoogleManual = () => {
    return authMethod === 'google_manual';
  };

  const isUserGoogle = () => {
    return authMethod === 'google_automatic' || authMethod === 'google_manual';
  };

  const value = {
    user,
    loading,
    isAuthenticated,
    authMethod,
    signInAnonymously,
    signInWithGoogle: signInWithGoogleAuth,
    signOut,
    getUserId,
    isUserAnonymous,
    isUserGoogleAutomatic,
    isUserGoogleManual,
    isUserGoogle
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 