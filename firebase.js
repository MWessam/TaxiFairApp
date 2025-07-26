// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { initializeAuth, getReactNativePersistence, signInAnonymously } from "firebase/auth";
import AsyncStorage from '@react-native-async-storage/async-storage';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCbper0-iKwOENPt0nI5ZyMt7AFmUyDs8M",
  authDomain: "taxifare-7fe53.firebaseapp.com",
  projectId: "taxifare-7fe53",
  storageBucket: "taxifare-7fe53.firebasestorage.app",
  messagingSenderId: "916645906844",
  appId: "1:916645906844:web:dfa3981f2cae5d1404a059",
  measurementId: "G-L16C58LBTF"
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