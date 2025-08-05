// Kam El Ogra - Firebase Configuration
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { 
  initializeAuth, 
  getReactNativePersistence, 
  signInAnonymously,
  GoogleAuthProvider,
  signInWithCredential,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { initializeAppCheck, ReCaptchaV3Provider, getAppCheck } from 'firebase/app-check';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Firebase configuration from environment (see app.config.js -> extra)
const {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID
} = Constants.expoConfig?.extra ?? {};

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
  measurementId: FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app);

// Initialize Auth with React Native persistence
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Google Sign-In
GoogleSignin.configure({
  webClientId: Constants.expoConfig?.extra?.GOOGLE_CLIENT_ID || "916645906844-lvuvah951bgu6jaqoa4hi5ioovcl4pcu.apps.googleusercontent.com",
  offlineAccess: true,
  hostedDomain: '',
  forceCodeForRefreshToken: true,
  scopes: ['profile', 'email'],
});

// Google Auth Provider
const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');

// Initialize anonymous authentication
export const signInUserAnonymously = async () => {
  try {
    // Check if user is already signed in
    const currentUser = auth.currentUser;
    if (currentUser) {
      return currentUser;
    }
    
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in anonymously:', error);
    // For now, return null to allow the app to work without auth
    console.log('Continuing without authentication...');
    return null;
  }
};

// Automatic Google Sign-In (Silent)
export const signInWithGoogleSilent = async () => {
  try {
    // Check if Google Play Services is available
    await GoogleSignin.hasPlayServices();
    
    // Try to get current user (automatic sign-in)
    const currentUser = await GoogleSignin.getCurrentUser();
    if (currentUser) {
      // User is already signed in, get credentials
      const { idToken } = await GoogleSignin.getTokens();
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      return userCredential.user;
    }
    
    // Try silent sign-in
    const userInfo = await GoogleSignin.signInSilently();
    if (userInfo) {
      const { idToken } = await GoogleSignin.getTokens();
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      return userCredential.user;
    }
    
    return null; // No automatic sign-in available
  } catch (error) {
    console.log('Google automatic sign-in not available:', error.message);
    return null; // Fall back to manual sign-in
  }
};

// Manual Google Sign-In
export const signInWithGoogle = async () => {
  try {
    // Check if Google Play Services is available
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    
    // Check if user is already signed in
    const isSignedIn = await GoogleSignin.isSignedIn();
    if (isSignedIn) {
      // Sign out first to ensure clean state
      await GoogleSignin.signOut();
    }
    
    // Manual sign-in
    const userInfo = await GoogleSignin.signIn();
    if (userInfo) {
      const { idToken } = await GoogleSignin.getTokens();
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      return userCredential.user;
    }
    
    throw new Error('Google sign-in was cancelled or failed');
  } catch (error) {
    console.error('Error signing in with Google:', error);
    
    // Handle specific error types
    if (error.code === 'SIGN_IN_CANCELLED') {
      throw new Error('Sign-in was cancelled by user');
    } else if (error.code === 'PLAY_SERVICES_NOT_AVAILABLE') {
      throw new Error('Google Play Services not available');
    } else if (error.code === 'SIGN_IN_REQUIRED') {
      throw new Error('Sign-in required');
    } else if (error.code === 'INVALID_ACCOUNT') {
      throw new Error('Invalid account');
    } else if (error.code === 'SIGN_IN_FAILED') {
      throw new Error('Sign-in failed - please try again');
    }
    
    throw error;
  }
};

// Sign out function
export const signOutUser = async () => {
  try {
    await signOut(auth);
    // Also sign out from Google Sign-In
    await GoogleSignin.signOut();
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

// Get current user
export const getCurrentUser = () => {
  return auth.currentUser;
};

// Listen to auth state changes
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Initialize Firebase App Check (web / Expo web). For native Expo, further setup may be required.
try {
  if (typeof window !== 'undefined' && !getAppCheck(app)) {
    const siteKey = Constants.expoConfig.extra?.APP_CHECK_SITE_KEY;
    if (siteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true
      });
    } else {
      console.warn('⚠️ APP_CHECK_SITE_KEY not set; App Check not initialized');
    }
  }
} catch (err) {
  console.warn('App Check initialization failed:', err);
}