// debug-client.js - Client-side debug script for analyzeSimilarTrips function
import { analyzeSimilarTrips } from './firestoreHelpers';

// Test data for debugging
const testTripData = {
  from: {
    lat: 30.0444, // Cairo coordinates
    lng: 31.2357,
    governorate: 'Cairo'
  },
  to: {
    lat: 30.0444,
    lng: 31.2357,
    governorate: 'Cairo'
  },
  distance: 10,
  start_time: new Date().toISOString(),
  governorate: 'Cairo'
};

// Debug function to test analyzeSimilarTrips
export async function debugAnalyzeSimilarTrips() {
  console.log('=== CLIENT-SIDE DEBUG: analyzeSimilarTrips ===');
  console.log('Test data:', JSON.stringify(testTripData, null, 2));
  
  try {
    const result = await analyzeSimilarTrips(testTripData);
    
    console.log('=== FUNCTION RESULT ===');
    console.log('Success:', result?.success);
    
    if (result?.success) {
      console.log('Data:', JSON.stringify(result.data, null, 2));
    } else {
      console.log('Error:', result?.error);
    }
    
    return result;
    
  } catch (error) {
    console.error('Client-side test failed:', error);
    return { success: false, error: error.message };
  }
}

// Test with different scenarios
export async function runDebugScenarios() {
  console.log('=== RUNNING DEBUG SCENARIOS ===');
  
  // Scenario 1: Basic test
  console.log('\n--- Scenario 1: Basic test ---');
  await debugAnalyzeSimilarTrips();
  
  // Scenario 2: No coordinates
  console.log('\n--- Scenario 2: No coordinates ---');
  const testDataNoCoords = {
    ...testTripData,
    from: { governorate: 'Cairo' },
    to: { governorate: 'Cairo' }
  };
  await analyzeSimilarTrips(testDataNoCoords);
  
  // Scenario 3: Different distance
  console.log('\n--- Scenario 3: Different distance ---');
  const testDataDiffDistance = {
    ...testTripData,
    distance: 5
  };
  await analyzeSimilarTrips(testDataDiffDistance);
  
  // Scenario 4: No governorate
  console.log('\n--- Scenario 4: No governorate ---');
  const testDataNoGov = {
    ...testTripData,
    governorate: null
  };
  await analyzeSimilarTrips(testDataNoGov);
}

// Export for use in components
export { testTripData }; 