// Test script for enhanced validation features
// Run this in Node.js environment with Firebase SDK

// Load environment variables if .env file exists
try {
  require('dotenv').config();
} catch (error) {
  // dotenv not installed, continue without it
}

const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getAuth, signInAnonymously, signInWithEmailAndPassword } = require('firebase/auth');

// Firebase config (replace with your actual config)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
const auth = getAuth(app);

// Test data
const testTripData = {
  fare: 25,
  distance: 5.2,
  duration: 15,
  passenger_count: 1,
  from: {
    lat: 31.04,
    lng: 31.37,
    name: 'Test Location 1'
  },
  to: {
    lat: 31.05,
    lng: 31.38,
    name: 'Test Location 2'
  },
  start_time: new Date().toISOString(),
  governorate: 'Dakahlia'
};

// Authentication helper function
async function authenticateUser() {
  try {
    // Try anonymous authentication first
    console.log('Attempting anonymous authentication...');
    const userCredential = await signInAnonymously(auth);
    return userCredential.user;
  } catch (error) {
    if (error.code === 'auth/admin-restricted-operation') {
      console.log('Anonymous auth not enabled. Please enable it in Firebase Console:');
      console.log('1. Go to Firebase Console → Authentication → Sign-in method');
      console.log('2. Enable "Anonymous" provider');
      console.log('3. Or use email/password authentication below\n');
      
      // Alternative: Use email/password if you have test credentials
      const testEmail = process.env.TEST_EMAIL || 'test@example.com';
      const testPassword = process.env.TEST_PASSWORD || 'testpassword123';
      
      console.log(`Attempting email/password authentication with: ${testEmail}`);
      try {
        const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
        return userCredential.user;
      } catch (emailError) {
        console.log('Email/password auth failed. Please either:');
        console.log('1. Enable Anonymous authentication in Firebase Console, OR');
        console.log('2. Create a test user and set TEST_EMAIL and TEST_PASSWORD environment variables');
        throw emailError;
      }
    }
    throw error;
  }
}

async function testEnhancedValidation() {
  console.log('🧪 Testing Enhanced Validation Features\n');

  try {
    // 1. Test authentication
    console.log('1. Testing authentication...');
    const user = await authenticateUser();
    console.log(`✅ Authenticated as: ${user.uid}\n`);

    // 2. Test trip submission
    console.log('2. Testing trip submission...');
    const submitTrip = httpsCallable(functions, 'submitTrip');
    const result = await submitTrip({
      ...testTripData,
      user_id: user.uid
    });
    
    if (result.data.success) {
      console.log(`✅ Trip submitted successfully`);
      console.log(`   Trip ID: ${result.data.trip_id}`);
      console.log(`   Status: ${result.data.status}`);
      console.log(`   Is Admin: ${result.data.is_admin}\n`);
    } else {
      console.log(`❌ Trip submission failed: ${result.data.error}\n`);
    }

    // 3. Test duplicate trip detection
    console.log('3. Testing duplicate trip detection...');
    try {
      const duplicateResult = await submitTrip({
        ...testTripData,
        user_id: user.uid
      });
      
      if (duplicateResult.data.success) {
        console.log('❌ Duplicate trip was allowed (should be blocked)\n');
      } else {
        console.log(`✅ Duplicate trip blocked: ${duplicateResult.data.error}\n`);
      }
    } catch (error) {
      console.log(`✅ Duplicate trip blocked: ${error.message}\n`);
    }

    // 4. Test rate limiting
    console.log('4. Testing rate limiting...');
    const rateLimitPromises = [];
    for (let i = 0; i < 6; i++) {
      rateLimitPromises.push(
        submitTrip({
          ...testTripData,
          start_time: new Date(Date.now() + i * 60000).toISOString(), // 1 minute apart
          user_id: user.uid
        }).catch(error => ({ error: error.message }))
      );
    }
    
    const rateLimitResults = await Promise.all(rateLimitPromises);
    const successfulSubmissions = rateLimitResults.filter(r => r.data?.success).length;
    const blockedSubmissions = rateLimitResults.filter(r => r.error || !r.data?.success).length;
    
    console.log(`   Successful submissions: ${successfulSubmissions}`);
    console.log(`   Blocked submissions: ${blockedSubmissions}`);
    console.log(`   Expected: 5 successful, 1 blocked (hourly limit)\n`);

    // 5. Test admin role functionality
    console.log('5. Testing admin role functionality...');
    const getUserRole = httpsCallable(functions, 'getUserRole');
    const roleResult = await getUserRole({ userId: user.uid });
    
    if (roleResult.data.success) {
      console.log(`   Current role: ${roleResult.data.role}`);
      console.log(`   Is admin: ${roleResult.data.isAdmin}\n`);
    } else {
      console.log(`❌ Failed to get user role: ${roleResult.data.error}\n`);
    }

    // 6. Test trip analysis
    console.log('6. Testing trip analysis...');
    const analyzeTrips = httpsCallable(functions, 'analyzeSimilarTrips');
    const analysisResult = await analyzeTrips({
      fromLat: 31.04,
      fromLng: 31.37,
      toLat: 31.05,
      toLng: 31.38,
      distance: 5.2,
      startTime: new Date().toISOString(),
      governorate: 'Dakahlia',
      user_id: user.uid
    });
    
    if (analysisResult.data.success) {
      console.log(`✅ Analysis completed successfully`);
      console.log(`   Similar trips found: ${analysisResult.data.data.similarTripsCount}`);
      console.log(`   Average fare: ${analysisResult.data.data.averageFare}\n`);
    } else {
      console.log(`❌ Analysis failed: ${analysisResult.data.error}\n`);
    }

    console.log('🎉 Enhanced validation testing completed!\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Helper function to create admin user (for testing)
async function createAdminUser(targetUserId) {
  try {
    console.log(`🔧 Creating admin user: ${targetUserId}`);
    const setUserRole = httpsCallable(functions, 'setUserRole');
    const result = await setUserRole({
      targetUserId,
      role: 'admin'
    });
    
    if (result.data.success) {
      console.log(`✅ Admin user created: ${result.data.message}`);
    } else {
      console.log(`❌ Failed to create admin: ${result.data.error}`);
    }
  } catch (error) {
    console.error(`❌ Error creating admin: ${error.message}`);
  }
}

// Helper function to test admin bypass
async function testAdminBypass() {
  console.log('👑 Testing admin bypass functionality...\n');
  
  try {
    // Create an admin user
    const adminUser = await authenticateUser(); // Re-use authenticateUser
    await createAdminUser(adminUser.uid);
    
    // Test multiple rapid submissions (should bypass rate limiting)
    console.log('Testing admin bypass of rate limiting...');
    const adminPromises = [];
    for (let i = 0; i < 10; i++) {
      adminPromises.push(
        httpsCallable(functions, 'submitTrip')({
          ...testTripData,
          start_time: new Date(Date.now() + i * 1000).toISOString(), // 1 second apart
          user_id: adminUser.uid
        })
      );
    }
    
    const adminResults = await Promise.all(adminPromises);
    const successfulAdminSubmissions = adminResults.filter(r => r.data?.success).length;
    
    console.log(`   Admin submissions: ${successfulAdminSubmissions}/10`);
    console.log(`   Expected: 10/10 (admin bypass)\n`);
    
  } catch (error) {
    console.error('❌ Admin bypass test failed:', error);
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting Enhanced Validation Tests\n');
  
  await testEnhancedValidation();
  await testAdminBypass();
  
  console.log('✨ All tests completed!');
}

// Export for use in other scripts
module.exports = {
  testEnhancedValidation,
  testAdminBypass,
  runAllTests
};

// Run if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
} 