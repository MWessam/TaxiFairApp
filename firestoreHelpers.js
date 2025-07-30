// firestoreHelpers.js
import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import deviceIdService from './services/deviceIdService';

export async function saveTrip(tripData) {
  try {
    // No authentication – rely on App Check only
    
    // Get device ID for rate limiting
    const deviceId = await deviceIdService.getDeviceId();
    
    // Call the secure Firebase Function
    const submitTrip = httpsCallable(functions, 'submitTrip');
    const result = await submitTrip({
      ...tripData,
      device_id: deviceId
    });
    
    return result.data; // Forward full response { success, status, ... }
  } catch (error) {
    console.error('Error saving trip:', error);
    return { success: false, error: error.message };
  }
}

export async function analyzeSimilarTrips(tripData) {
  try {
    // No authentication – rely on App Check only
    
    // Get device ID for rate limiting
    const deviceId = await deviceIdService.getDeviceId();
    
    // Call the secure Firebase Function
    const analyzeTrips = httpsCallable(functions, 'analyzeSimilarTrips');
    
    const params = {
      fromLat: tripData.from?.lat,
      fromLng: tripData.from?.lng,
      toLat: tripData.to?.lat,
      toLng: tripData.to?.lng,
      distance: tripData.distance,
      startTime: tripData.start_time,
      governorate: tripData.governorate,
      device_id: deviceId
    };

    const result = await analyzeTrips(params);
    return result.data;
  } catch (error) {
    console.error('Error analyzing similar trips:', error);
    return null;
  }
}

 