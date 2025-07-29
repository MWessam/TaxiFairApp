// firestoreHelpers.js
import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';

export async function saveTrip(tripData) {
  try {
    // No authentication – rely on App Check only
    
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
    // No authentication – rely on App Check only
    
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

 