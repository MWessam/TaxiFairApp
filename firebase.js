// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeAuth, getReactNativePersistence, signInAnonymously } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { initializeAppCheck, ReCaptchaV3Provider, getAppCheck } from 'firebase/app-check';
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