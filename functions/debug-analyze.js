// debug-analyze.js - Debug script for analyzeSimilarTrips function
const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Test data for debugging
const testTripData = {
  fromLat: 30.0444, // Cairo coordinates
  fromLng: 31.2357,
  toLat: 30.0444,
  toLng: 31.2357,
  distance: 10,
  startTime: new Date().toISOString(),
  governorate: 'Cairo',
  maxDistance: 5,
  maxTimeDiff: 2,
  maxDistanceDiff: 2
};

// Mock request object for testing
const mockRequest = {
  data: testTripData,
  auth: null,
  ip: '127.0.0.1',
  headers: {
    'user-agent': 'debug-script'
  }
};

// Test the analyzeSimilarTrips function
async function testAnalyzeSimilarTrips() {
  console.log('=== TESTING analyzeSimilarTrips FUNCTION ===');
  console.log('Test data:', JSON.stringify(testTripData, null, 2));
  
  try {
    // Import the function (you'll need to adjust the path)
    const { analyzeSimilarTrips } = require('./index');
    
    // Call the function
    const result = await analyzeSimilarTrips(mockRequest);
    
    console.log('=== FUNCTION RESULT ===');
    console.log('Success:', result.success);
    if (result.success) {
      console.log('Data:', JSON.stringify(result.data, null, 2));
    } else {
      console.log('Error:', result.error);
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Test Firestore query directly
async function testFirestoreQuery() {
  console.log('\n=== TESTING FIRESTORE QUERY DIRECTLY ===');
  
  try {
    const distanceRangeStart = Math.max(0, testTripData.distance - testTripData.maxDistanceDiff);
    const distanceRangeEnd = testTripData.distance + testTripData.maxDistanceDiff;
    
    console.log('Query parameters:', {
      distanceRangeStart,
      distanceRangeEnd,
      governorate: testTripData.governorate
    });
    
    let query = db.collection('trips')
      .where('distance', '>=', distanceRangeStart)
      .where('distance', '<=', distanceRangeEnd)
      .where('fare', '>', 0);
    
    if (testTripData.governorate) {
      query = query.where('governorate', '==', testTripData.governorate);
    }
    
    const snapshot = await query.limit(100).get();
    
    console.log('Query results:', {
      size: snapshot.size,
      empty: snapshot.empty
    });
    
    if (!snapshot.empty) {
      const sampleDocs = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        sampleDocs.push({
          id: doc.id,
          distance: data.distance,
          fare: data.fare,
          from: data.from,
          to: data.to,
          start_time: data.start_time,
          governorate: data.governorate
        });
      });
      
      console.log('Sample documents (first 3):', sampleDocs.slice(0, 3));
    }
    
  } catch (error) {
    console.error('Firestore query test failed:', error);
  }
}

// Check if trips collection exists and has data
async function checkTripsCollection() {
  console.log('\n=== CHECKING TRIPS COLLECTION ===');
  
  try {
    const snapshot = await db.collection('trips').limit(5).get();
    
    console.log('Trips collection status:', {
      exists: !snapshot.empty,
      size: snapshot.size
    });
    
    if (!snapshot.empty) {
      console.log('Sample trip fields:', Object.keys(snapshot.docs[0].data()));
    }
    
  } catch (error) {
    console.error('Error checking trips collection:', error);
  }
}

// Run all tests
async function runAllTests() {
  await checkTripsCollection();
  await testFirestoreQuery();
  await testAnalyzeSimilarTrips();
}

// Export for use in other files
module.exports = {
  testAnalyzeSimilarTrips,
  testFirestoreQuery,
  checkTripsCollection,
  runAllTests
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().then(() => {
    console.log('\n=== ALL TESTS COMPLETED ===');
    process.exit(0);
  }).catch(error => {
    console.error('Tests failed:', error);
    process.exit(1);
  });
} 