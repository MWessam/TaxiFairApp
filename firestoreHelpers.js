// firestoreHelpers.js
import { functions } from './firebase';
import { httpsCallable } from 'firebase/functions';
import { getCurrentUser } from './firebase';

export async function saveTrip(tripData) {
  try {
    // Get current authenticated user
    const currentUser = getCurrentUser();
    const userId = currentUser?.uid || 'anonymous';
    
    // Call the secure Firebase Function
    const submitTrip = httpsCallable(functions, 'submitTrip');
    const result = await submitTrip({
      ...tripData,
      user_id: userId
    });
    
    return result.data; // Forward full response { success, status, ... }
  } catch (error) {
    console.error('Error saving trip:', error);
    return { success: false, error: error.message };
  }
}

export async function analyzeSimilarTrips(tripData) {
  try {
    // Get current authenticated user
    const currentUser = getCurrentUser();
    const userId = currentUser?.uid || 'anonymous';
    
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
      user_id: userId
    };

    const result = await analyzeTrips(params);
    return result.data;
  } catch (error) {
    console.error('Error analyzing similar trips:', error);
    return null;
  }
}

// Admin role management functions
export async function setUserRole(targetUserId, role) {
  try {
    const setRole = httpsCallable(functions, 'setUserRole');
    const result = await setRole({
      targetUserId,
      role
    });
    
    return result.data;
  } catch (error) {
    console.error('Error setting user role:', error);
    return { success: false, error: error.message };
  }
}

export async function getUserRole(userId = null) {
  try {
    const getRole = httpsCallable(functions, 'getUserRole');
    const result = await getRole({
      userId
    });
    
    return result.data;
  } catch (error) {
    console.error('Error getting user role:', error);
    return { success: false, error: error.message };
  }
}

 