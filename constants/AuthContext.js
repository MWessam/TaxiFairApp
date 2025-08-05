import React, { createContext, useContext, useState, useEffect } from 'react';
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
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        await AsyncStorage.setItem('authMethod', authMethod || 'google_automatic');
      } else {
        // User is signed out
        setUser(null);
        setIsAuthenticated(false);
        setAuthMethod(null);
        
        // Clear stored user data
        await AsyncStorage.removeItem('user');
        await AsyncStorage.removeItem('authMethod');
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
      const cachedUser = await AsyncStorage.getItem('user');
      const cachedAuthMethod = await AsyncStorage.getItem('authMethod');
      
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
      
      // Provide more specific error messages
      let errorMessage = error.message;
      if (error.message.includes('non recoverable')) {
        errorMessage = 'Google Sign-In is not available. Please check your Google account settings or try again later.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message.includes('cancelled')) {
        errorMessage = 'Sign-in was cancelled.';
      }
      
      return { success: false, error: errorMessage };
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
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('authMethod');
      
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