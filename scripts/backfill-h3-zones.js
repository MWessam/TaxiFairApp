// H3 Zone Backfill Script - Client Side
// Run this to update existing trips with H3 zones

// Load environment variables if .env file exists
try {
  require('dotenv').config();
} catch (error) {
  // dotenv not installed, continue without it
}

const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');
const { getAuth, signInAnonymously, signInWithEmailAndPassword } = require('firebase/auth');
const h3 = require('h3-js');

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

// Configure
const H3_RESOLUTION = parseInt(process.env.H3_RESOLUTION || '7', 10);

function computeH3Zone(lat, lng, resolution = H3_RESOLUTION) {
  try {
    return h3.latLngToCell(lat, lng, resolution);
  } catch (_err) {
    return null;
  }
}

// Authentication helper function
async function authenticateUser() {
  try {
    // Try anonymous authentication first
          const testEmail = process.env.TEST_EMAIL || 'test@example.com';
      const testPassword = process.env.TEST_PASSWORD || 'testpassword123';
      console.log(testEmail, testPassword);
    const userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
    return userCredential.user;
  } catch (error) {
    // if (error.code === 'auth/admin-restricted-operation') {
    //   console.log('Anonymous auth not enabled. Please enable it in Firebase Console:');
    //   console.log('1. Go to Firebase Console → Authentication → Sign-in method');
    //   console.log('2. Enable "Anonymous" provider');
    //   console.log('3. Or use email/password authentication below\n');
      
    //   // Alternative: Use email/password if you have test credentials

      
    //   console.log(`Attempting email/password authentication with: ${testEmail}`);
    //   try {

    //   } catch (emailError) {
    //     console.log('Email/password auth failed. Please either:');
    //     console.log('1. Enable Anonymous authentication in Firebase Console, OR');
    //     console.log('2. Create a test user and set TEST_EMAIL and TEST_PASSWORD environment variables');
    //     throw emailError;
    //   }
    // }
    throw error;
  }
}

async function backfillH3Zones() {
  console.log('🔄 Starting H3 Zone Backfill\n');

  try {
    // 1. Authenticate user
    console.log('1. Authenticating...');
    const user = await authenticateUser();
    console.log(`✅ Authenticated as: ${user.uid}\n`);

    // 2. Check if user is admin (required for backfill)
    console.log('2. Checking user role...');
    // const getUserRole = httpsCallable(functions, 'getUserRole');
    // const roleResult = await getUserRole({ userId: user.uid });
    
    // if (!roleResult.data.success) {
    //   throw new Error(`Failed to get user role: ${roleResult.data.error}`);
    // }
    
    // if (!roleResult.data.isAdmin) {
    //   console.log('❌ User is not an admin. Creating admin role...');
      
    //   // Try to create admin role (this will only work if you have admin privileges)
    //   const setUserRole = httpsCallable(functions, 'setUserRole');
    //   const adminResult = await setUserRole({
    //     targetUserId: user.uid,
    //     role: 'admin'
    //   });
      
    //   if (!adminResult.data.success) {
    //     throw new Error(`Failed to create admin role: ${adminResult.data.error}`);
    //   }
      
    //   console.log('✅ Admin role created successfully\n');
    // } else {
    //   console.log('✅ User is already an admin\n');
    // }

    // 3. Start the backfill process
    console.log('3. Starting H3 zone backfill...');
    const backfillH3Zones = httpsCallable(functions, 'backfillH3Zones');
    
    // Configure backfill parameters
    const backfillParams = {
      batchSize: 100,    // Process 100 trips per batch
      maxBatches: 50     // Process up to 50 batches (5000 trips total)
    };
    
    console.log(`   Batch size: ${backfillParams.batchSize}`);
    console.log(`   Max batches: ${backfillParams.maxBatches}`);
    console.log(`   H3 Resolution: ${H3_RESOLUTION}\n`);
    
    console.log('⏳ Starting backfill (this may take several minutes)...\n');
    
    const result = await backfillH3Zones(backfillParams);
    
    if (result.data.success) {
      console.log('✅ H3 zone backfill completed successfully!');
      console.log(`   Total processed: ${result.data.data.totalProcessed}`);
      console.log(`   Total updated: ${result.data.data.totalUpdated}`);
      console.log(`   Total skipped: ${result.data.data.totalSkipped}`);
      console.log(`   Batches processed: ${result.data.data.batchesProcessed}`);
      console.log(`   H3 Resolution used: ${result.data.data.h3Resolution}\n`);
      
      if (result.data.data.totalUpdated > 0) {
        console.log('🎉 Successfully updated existing trips with H3 zones!');
        console.log('   Your similarity queries should now work with the new H3-based zones.');
      } else {
        console.log('ℹ️  No trips needed updating. All trips already have H3 zones.');
      }
    } else {
      throw new Error(`Backfill failed: ${result.data.error}`);
    }

  } catch (error) {
    console.error('❌ Backfill failed:', error);
    
    if (error.message.includes('Only admins can perform H3 zone backfill')) {
      console.log('\n💡 To fix this:');
      console.log('   1. Go to Firebase Console → Firestore Database');
      console.log('   2. Find a user document in the "users" collection');
      console.log('   3. Set their "role" field to "admin"');
      console.log('   4. Or run this script with an existing admin user');
    }
  }
}

// Helper function to test H3 zone computation
function testH3Zones() {
  console.log('🧪 Testing H3 Zone Computation\n');
  
  const testCases = [
    { lat: 31.04, lng: 31.37, name: 'Mansoura Center' },
    { lat: 30.05, lng: 31.25, name: 'Cairo' },
    { lat: 31.20, lng: 29.95, name: 'Alexandria' },
    { lat: 26.82, lng: 30.80, name: 'Assiut' },
    { lat: 27.18, lng: 31.18, name: 'Sohag' }
  ];
  
  console.log(`Using H3 Resolution: ${H3_RESOLUTION}\n`);
  
  testCases.forEach(coord => {
    const h3Zone = computeH3Zone(coord.lat, coord.lng);
    const h3Boundary = h3.cellToBoundary(h3Zone);
    const h3Center = h3.cellToLatLng(h3Zone);
    
    console.log(`${coord.name}:`);
    console.log(`  Coordinates: ${coord.lat}, ${coord.lng}`);
    console.log(`  H3 Zone: ${h3Zone}`);
    console.log(`  H3 Center: ${h3Center[0].toFixed(4)}, ${h3Center[1].toFixed(4)}`);
    console.log(`  Boundary Points: ${h3Boundary.length} points`);
    console.log('');
  });
}

// Helper function to show H3 resolution info
function showH3ResolutionInfo() {
  console.log('📊 H3 Resolution Information\n');
  
  const resolutions = [5, 6, 7, 8, 9];
  
  resolutions.forEach(res => {
    const avgHexArea = h3.getHexagonAreaAvg(res, 'km2');
    const avgHexEdgeLength = h3.getHexagonEdgeLengthAvg(res, 'km');
    
    console.log(`Resolution ${res}:`);
    console.log(`  Average Hexagon Area: ${avgHexArea.toFixed(2)} km²`);
    console.log(`  Average Edge Length: ${avgHexEdgeLength.toFixed(2)} km`);
    console.log(`  Recommended for: ${getResolutionDescription(res)}`);
    console.log('');
  });
}

function getResolutionDescription(resolution) {
  const descriptions = {
    5: 'Large neighborhoods, districts',
    6: 'Medium neighborhoods',
    7: 'Small neighborhoods, streets (RECOMMENDED)',
    8: 'Street blocks, small areas',
    9: 'Individual buildings, very precise'
  };
  return descriptions[resolution] || 'Unknown';
}

// Run backfill
async function runBackfill() {
  console.log('🚀 Starting H3 Zone Backfill Process\n');
  
  showH3ResolutionInfo();
  testH3Zones();
  await backfillH3Zones();
  
  console.log('✨ Backfill process completed!');
}

// Export for use in other scripts
module.exports = {
  backfillH3Zones,
  testH3Zones,
  showH3ResolutionInfo,
  runBackfill
};

// Run if this file is executed directly
if (require.main === module) {
  runBackfill().catch(console.error);
}


