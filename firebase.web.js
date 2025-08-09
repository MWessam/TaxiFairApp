// Web-specific Firebase setup that avoids React Native-only APIs
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import {
  getAuth,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import Constants from 'expo-constants';
import { initializeAppCheck, ReCaptchaV3Provider, getAppCheck } from 'firebase/app-check';

// Read config from Expo extra (same as native file)
const {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
  FIREBASE_MEASUREMENT_ID,
} = Constants.expoConfig?.extra ?? {};

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
  measurementId: FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase (web)
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const auth = getAuth(app);
// Persist sessions like regular websites
setPersistence(auth, browserLocalPersistence).catch((e) => {
  console.warn('Failed to set web auth persistence:', e);
});

// Anonymous auth for web
export const signInUserAnonymously = async () => {
  try {
    const currentUser = auth.currentUser;
    if (currentUser) {
      return currentUser;
    }
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    console.error('Error signing in anonymously (web):', error);
    return null;
  }
};

// No-op Google sign-in on web for now (use expo-auth-session if needed later)
export const signInWithGoogleSilent = async () => {
  // Firebase will restore the session if present; just return current user
  return auth.currentUser ?? null;
};

export const signInWithGoogle = async () => {
  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    const credential = await signInWithPopup(auth, provider);
    return credential.user;
  } catch (error) {
    console.error('Firebase web Google sign-in failed:', error);
    throw error;
  }
};

export const signOutUser = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error('Error signing out (web):', error);
    throw error;
  }
};

export const getCurrentUser = () => auth.currentUser;

export const onAuthStateChange = (callback) => onAuthStateChanged(auth, callback);

// Firebase App Check (web)
try {
  if (typeof window !== 'undefined' && !getAppCheck(app)) {
    const siteKey = Constants.expoConfig?.extra?.APP_CHECK_SITE_KEY;
    if (siteKey) {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(siteKey),
        isTokenAutoRefreshEnabled: true,
      });
    } else {
      console.warn('APP_CHECK_SITE_KEY not set; App Check not initialized (web)');
    }
  }
} catch (err) {
  console.warn('App Check initialization failed (web):', err);
}


