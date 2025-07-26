// firestoreHelpers.js
import { functions, signInUserAnonymously } from './firebase';
import { httpsCallable } from 'firebase/functions';

export async function saveTrip(tripData) {
  try {
    // Try to authenticate, but continue if it fails
    try {
      await signInUserAnonymously();
    } catch (authError) {
      console.log('Authentication failed, continuing without auth...');
    }
    
    // Call the secure Firebase Function
    const submitTrip = httpsCallable(functions, 'submitTrip');
    const result = await submitTrip(tripData);
    
    if (result.data.success) {
      return true;
    } else {
      console.error('Trip submission failed:', result.data.error);
      return false;
    }
  } catch (error) {
    console.error('Error saving trip:', error);
    return false;
  }
}

export async function analyzeSimilarTrips(tripData) {
  try {
    // Try to authenticate, but continue if it fails
    try {
      await signInUserAnonymously();
    } catch (authError) {
      console.log('Authentication failed, continuing without auth...');
    }
    
    // Call the secure Firebase Function
    const analyzeTrips = httpsCallable(functions, 'analyzeSimilarTrips');
    
    const params = {
      fromLat: tripData.from?.lat,
      fromLng: tripData.from?.lng,
      toLat: tripData.to?.lat,
      toLng: tripData.to?.lng,
      distance: tripData.distance,
      startTime: tripData.start_time,
      governorate: tripData.governorate
    };

    const result = await analyzeTrips(params);
    return result.data;
  } catch (error) {
    console.error('Error analyzing similar trips:', error);
    return null;
  }
}

 