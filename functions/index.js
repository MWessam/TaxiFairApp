const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { tripSchema } = require('./schema');
const h3 = require('h3-js');

const H3_RESOLUTION = parseInt(process.env.H3_RESOLUTION || '7', 10);

// H3 zone helper (resolution from env, defaults to 7)
function computeH3Zone(lat, lng, resolution = H3_RESOLUTION) {
  try {
    return h3.latLngToCell(lat, lng, resolution);
  } catch (_err) {
    return null;
  }
}

// Vertex AI will be loaded when needed
function getVertexAIClient() {
  // For now, return null since we're not using Vertex AI yet
  return null;
}

admin.initializeApp();

const db = admin.firestore();

// Bot protection and rate limiting (Firestore-backed)
const MAX_SUBMISSIONS_PER_HOUR = 5;  // Updated: 5 trips per hour per user
const MAX_SUBMISSIONS_PER_DAY = 20;  // Updated: 20 trips per day per user
const OFFICIAL_TARIFF_BASE_FARE = 9;
const OFFICIAL_TARIFF_PER_KM = 2;
const OFFICIAL_TARIFF_MIN_PERCENT_MODIFIER = 0.15;
const OFFICIAL_TARIFF_MAX_PERCENT_MODIFIER = 1.0;

// New constants for trip validation
const DUPLICATE_TRIP_TIME_WINDOW = 30 * 60 * 1000; // 30 minutes in milliseconds
const SAME_ZONE_DESTINATION_WINDOW = 30 * 60 * 1000; // 30 minutes for same zone trips

// Zone management is now handled by zone-manager.js

// Egyptian holidays (you can expand this)
const EGYPTIAN_HOLIDAYS = [
  '2024-01-07', // Coptic Christmas
  '2024-04-10', // Eid al-Fitr (approximate)
  '2024-06-17', // Eid al-Adha (approximate)
  '2024-07-23', // Revolution Day
  '2024-09-27', // Prophet's Birthday (approximate)
  '2024-10-06', // Armed Forces Day
  // Add more holidays as needed
];

// --- Helper function for IQR Calculation ---
// This function calculates the Interquartile Range (IQR) to identify statistical outliers.
const calculateIQR = (arr) => {
    // We need at least 4 data points to calculate quartiles meaningfully.
    if (arr.length < 4) return null;

    const sortedArr = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sortedArr.length / 2);

    // Split the array into two halves to find Q1 and Q3
    const q1Arr = sortedArr.slice(0, mid);
    const q3Arr = sortedArr.length % 2 === 0 ? sortedArr.slice(mid) : sortedArr.slice(mid + 1);

    // Helper to find the median of an array
    const getMedian = (a) => {
        const m = Math.floor(a.length / 2);
        return a.length % 2 === 0 ? (a[m - 1] + a[m]) / 2 : a[m];
    };

    const q1 = getMedian(q1Arr);
    const q3 = getMedian(q3Arr);
    const iqr = q3 - q1;

    // The standard formula for outlier detection using IQR
    return {
        q1,
        q3,
        iqr,
        lowerBound: q1 - 1.5 * iqr,
        upperBound: q3 + 1.5 * iqr,
    };
};
// Zone determination is handled by H3 hex indexing

// Function to extract ML features from trip data
function extractMLFeatures(tripData) {
  const features = {};
  
  // Extract time features
  if (tripData.start_time) {
    // Use Cairo timezone when available for consistent local features
    try {
      const fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Cairo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      const parts = fmt.formatToParts(new Date(tripData.start_time));
      const get = (type) => Number(parts.find(p => p.type === type)?.value);
      const year = get('year');
      const month = get('month');
      const day = get('day');
      const hour = get('hour');
      // Build a Cairo-local date string for features
      features.time_of_day = hour; // 0-23
      // Day of week in Cairo timezone
      const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Africa/Cairo' }).format(new Date(tripData.start_time));
      const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      features.day_of_week = weekdayMap[weekday] ?? 0;
      features.date = `${year.toString().padStart(4,'0')}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
      features.month = month;
      features.day_of_month = day;
    } catch {
      const startDate = new Date(tripData.start_time);
      features.time_of_day = startDate.getHours();
      features.day_of_week = startDate.getDay();
      features.date = startDate.toISOString().split('T')[0];
      features.month = startDate.getMonth() + 1;
      features.day_of_month = startDate.getDate();
    }
  }
  
  // Extract speed feature
  if (tripData.distance && tripData.duration) {
    features.speed_kmh = (tripData.distance / tripData.duration) * 60;
  }
  
  // Extract zone features using H3
  if (tripData.from?.lat && tripData.from?.lng) {
    features.from_zone = computeH3Zone(tripData.from.lat, tripData.from.lng);
  }
  if (tripData.to?.lat && tripData.to?.lng) {
    features.to_zone = computeH3Zone(tripData.to.lat, tripData.to.lng);
  }
  
  return features;
}

// Validate trip data feasibility
function validateTripFeasibility(tripData) {
  const errors = [];
  
  // Basic fare validation
  if (!tripData.fare || tripData.fare <= 0) {
    errors.push('Fare must be greater than 0');
  }
  if (tripData.fare > 1000) {
    errors.push('Fare seems too high (max 1000 EGP)');
  }
  
  // Distance validation
  if (!tripData.distance || tripData.distance <= 0) {
    errors.push('Distance must be greater than 0');
  }
  if (tripData.distance > 100) {
    errors.push('Distance seems too high (max 100 km)');
  }
  
  // Duration validation
  if (tripData.duration) {
    if (tripData.duration <= 0) {
      errors.push('Duration must be greater than 0');
    }
    if (tripData.duration > 300) { // 5 hours max
      errors.push('Duration seems too long (max 5 hours)');
    }
  }
  
  // Passenger count validation
  if (tripData.passenger_count) {
    if (tripData.passenger_count <= 0 || tripData.passenger_count > 10) {
      errors.push('Invalid passenger count (1-10)');
    }
  }
  
  // Location validation for Egypt bounds (global app, Egypt only data)
  if (tripData.from && tripData.from.lat && tripData.from.lng) {
    if (tripData.from.lat < 22 || tripData.from.lat > 32 ||
        tripData.from.lng < 25 || tripData.from.lng > 37) {
      errors.push('Start location must be within Egypt');
    }
  }
  if (tripData.to && tripData.to.lat && tripData.to.lng) {
    if (tripData.to.lat < 22 || tripData.to.lat > 32 ||
        tripData.to.lng < 25 || tripData.to.lng > 37) {
      errors.push('End location must be within Egypt');
    }
  }
  
  // Speed validation (if both distance and duration provided)
  if (tripData.distance && tripData.duration) {
    const speedKmH = (tripData.distance / tripData.duration) * 60;
    if (speedKmH > 120) {
      errors.push('Average speed seems unrealistic (>120 km/h)');
    }
    if (speedKmH < 5) {
      errors.push('Average speed seems too slow (<5 km/h)');
    }
  }
  
  // Fare per km validation
  if (tripData.fare && tripData.distance) {
    const farePerKm = tripData.fare / tripData.distance;
    if (farePerKm > 50) {
      errors.push('Fare per kilometer seems too high (>50 EGP/km)');
    }
    if (farePerKm < 0.5) {
      errors.push('Fare per kilometer seems too low (<0.5 EGP/km)');
    }
  }
  
  return errors;
}

// Helper function to calculate distance between two points
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Check if user has admin role
async function isAdminUser(userId) {
  if (!userId) return false;
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) return false;
    
    const userData = userDoc.data();
    return userData.role === 'admin';
  } catch (error) {
    console.error('Error checking admin role:', error);
    return false;
  }
}

// Check for duplicate trips (same date, time, from/to locations)
async function checkDuplicateTrip(tripData, userId) {
  if (!userId || !tripData.start_time || !tripData.from || !tripData.to) {
    return false; // Cannot check without required data
  }
  
  try {
    const startTime = new Date(tripData.start_time);
    const tripDate = startTime.toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Query for trips with same date, from, and to locations
    const snapshot = await db.collection('trips')
      .where('user_id', '==', userId)
      .where('date', '==', tripDate)
      .where('from_zone', '==', tripData.from_zone)
      .where('to_zone', '==', tripData.to_zone)
      .get();
    
    if (snapshot.empty) return false;
    
    // Check if any trip is within the time window
    for (const doc of snapshot.docs) {
      const existingTrip = doc.data();
      if (existingTrip.start_time) {
        const existingStartTime = new Date(existingTrip.start_time);
        const timeDiff = Math.abs(startTime.getTime() - existingStartTime.getTime());
        
        if (timeDiff <= DUPLICATE_TRIP_TIME_WINDOW) {
          return true; // Duplicate found
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking duplicate trip:', error);
    return false; // Allow trip if check fails
  }
}

// Check for same zone to same destination within time window
async function checkSameZoneDestination(tripData, userId) {
  if (!userId || !tripData.start_time || !tripData.from_zone || !tripData.to_zone) {
    return false; // Cannot check without required data
  }
  
  // Only check if from and to zones are the same
  if (tripData.from_zone !== tripData.to_zone) {
    return false;
  }
  
  try {
    const startTime = new Date(tripData.start_time);
    const thirtyMinutesAgo = new Date(startTime.getTime() - SAME_ZONE_DESTINATION_WINDOW);
    
    // Query for recent trips from same zone to same destination
    const snapshot = await db.collection('trips')
      .where('start_time', '>=', thirtyMinutesAgo.toISOString())
      .where('user_id', '==', userId)
      .where('from_zone', '==', tripData.from_zone)
      .where('to_zone', '==', tripData.to_zone)
      .get();
    
    return !snapshot.empty; // Return true if any recent trips found
  } catch (error) {
    console.error('Error checking same zone destination:', error);
    return false; // Allow trip if check fails
  }
}

// Get latest trip end time for a user (with caching)
async function getLatestTripEndTime(userId) {
  if (!userId) return null;
  
  try {
    // Check cache first
    const cacheKey = `latest_trip_end_${userId}`;
    const cacheDoc = await db.collection('trip_cache').doc(cacheKey).get();
    
    if (cacheDoc.exists) {
      const cacheData = cacheDoc.data();
      const cacheTime = cacheData.timestamp.toMillis();
      const now = Date.now();
      
      // Cache is valid for 1 hour
      if (now - cacheTime < 60 * 60 * 1000) {
        return cacheData.latest_end_time ? new Date(cacheData.latest_end_time) : null;
      }
    }
    
    // Query for latest trip
    const snapshot = await db.collection('trips')
      .where('user_id', '==', userId)
      .orderBy('start_time', 'desc')
      .limit(1)
      .get();
    
    if (snapshot.empty) {
      // Cache null result
      await db.collection('trip_cache').doc(cacheKey).set({
        latest_end_time: null,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      return null;
    }
    
    const latestTrip = snapshot.docs[0].data();
    let latestEndTime = null;
    
    if (latestTrip.start_time && latestTrip.duration) {
      const startTime = new Date(latestTrip.start_time);
      latestEndTime = new Date(startTime.getTime() + latestTrip.duration * 60 * 1000);
    }
    
    // Cache the result
    await db.collection('trip_cache').doc(cacheKey).set({
      latest_end_time: latestEndTime ? latestEndTime.toISOString() : null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return latestEndTime;
  } catch (error) {
    console.error('Error getting latest trip end time:', error);
    return null; // Allow trip if check fails
  }
}

// Validate trip time feasibility
async function validateTripTimeFeasibility(tripData, userId) {
  if (!userId || !tripData.start_time) {
    return { valid: true }; // Cannot validate without required data
  }
  
  try {
    const startTime = new Date(tripData.start_time);
    const latestEndTime = await getLatestTripEndTime(userId);
    
    if (!latestEndTime) {
      return { valid: true }; // No previous trips
    }
    
    // Check if new trip starts before latest trip ends
    if (startTime < latestEndTime) {
      return {
        valid: false,
        error: `Trip conflicts with existing trip. Latest trip ends at ${latestEndTime.toLocaleString()}`,
        latest_end_time: latestEndTime.toISOString()
      };
    }
    
    return { valid: true };
  } catch (error) {
    console.error('Error validating trip time feasibility:', error);
    return { valid: true }; // Allow trip if validation fails
  }
}

// Update rate limiting to use user_id instead of device_id
async function checkRateLimit(userId) {
  if (!userId) {
    throw new Error('User ID is required for rate limiting');
  }
  
  const now = Date.now();
  const hourSlot = Math.floor(now / 3600000);
  const daySlot = Math.floor(now / 86400000);

  const docRef = db.collection('rate_limits').doc(`user_${userId}`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    const data = snap.exists ? snap.data() : {};

    let {
      hourSlot: storedHourSlot = hourSlot,
      hourCount = 0,
      daySlot: storedDaySlot = daySlot,
      dayCount = 0
    } = data;

    // Reset counters if we moved into new time windows
    if (storedHourSlot !== hourSlot) {
      hourCount = 0;
      storedHourSlot = hourSlot;
    }
    if (storedDaySlot !== daySlot) {
      dayCount = 0;
      storedDaySlot = daySlot;
    }

    if (hourCount >= MAX_SUBMISSIONS_PER_HOUR) {
      throw new Error(`Rate limit exceeded: ${MAX_SUBMISSIONS_PER_HOUR} trips per hour. Please wait before submitting more trips.`);
    }
    if (dayCount >= MAX_SUBMISSIONS_PER_DAY) {
      throw new Error(`Rate limit exceeded: ${MAX_SUBMISSIONS_PER_DAY} trips per day. Please try again tomorrow.`);
    }

    hourCount += 1;
    dayCount += 1;

    tx.set(docRef, {
      hourSlot: storedHourSlot,
      hourCount,
      daySlot: storedDaySlot,
      dayCount,
      // Firestore TTL (configure in console) – doc expires after 2 days
      expiresAt: admin.firestore.Timestamp.fromMillis(now + 2 * 24 * 60 * 60 * 1000)
    }, { merge: true });
  });
}

function getSimilarTripsQuery(fromZone, toZone) {
  let query = db.collection('trips')
    .where('from_zone', '==', fromZone)
    .where('to_zone', '==', toZone)
    .where('suspicious', '==', false)
    .orderBy('submitted_at', 'desc')
    .limit(200);
  return query;
}

async function isFareWithinSimilarRange(tripData, mlFeatures) {
  if (!mlFeatures.from_zone || !mlFeatures.to_zone) {
    return false; // Cannot compare without zones
  }

  const snapshot = await getSimilarTripsQuery(mlFeatures.from_zone, mlFeatures.to_zone).get();
  if (snapshot.empty) return false;

  // Collect fares and additional filtering on distance/time if provided
  const fares = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    // Optional coarse filtering
    if (tripData.distance && d.distance) {
      const pctDiff = Math.abs(d.distance - tripData.distance) / tripData.distance;
      if (pctDiff > 0.2) return; // Filter out trips with distance diff >20%
    }
    if (tripData.start_time && d.start_time) {
      const ourHour = new Date(tripData.start_time).getHours();
      const theirHour = new Date(d.start_time).getHours();
      if (Math.abs(ourHour - theirHour) > 2) return; // ±2 hours window
    }
    fares.push(d.fare);
  });

  // Need at least 4 data points for IQR method
  if (fares.length < 4) return false;

  const iqrStats = calculateIQR(fares);
  if (!iqrStats) return false;

  return tripData.fare >= iqrStats.lowerBound && tripData.fare <= iqrStats.upperBound;
}

// Secure trip submission with validation
exports.submitTrip = onCall({
  memory: '512MiB',
  timeoutSeconds: 60
}, async (request) => {
  const { data } = request;
  const context = request.auth;
  try {
    // Get user ID for validation
    const userId = data.user_id || (context ? context.uid : null);
    
    if (!userId) {
      throw new Error('User ID is required for trip submission');
    }
    
    // Check if user is admin (bypasses all restrictions)
    const isAdmin = await isAdminUser(userId);
    
    if (!isAdmin) {
      // Apply rate limiting for non-admin users
      await checkRateLimit(userId);
    }
    
    // Validate trip data using Zod schema
    const parseResult = tripSchema.safeParse(data);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(i => i.message);
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    // Extract ML features from the trip data (Cairo timezone-aware)
    const mlFeatures = extractMLFeatures(data);
    
    // Add ML features to trip data for validation
    const tripDataWithFeatures = {
      ...data,
      ...mlFeatures
    };
    
    // Apply validation rules for non-admin users
    if (!isAdmin) {
      // Check for duplicate trips
      const isDuplicate = await checkDuplicateTrip(tripDataWithFeatures, userId);
      if (isDuplicate) {
        throw new Error('Duplicate trip detected. A similar trip was submitted recently.');
      }
      
      // Check for same zone to same destination within time window
      const isSameZoneRecent = await checkSameZoneDestination(tripDataWithFeatures, userId);
      if (isSameZoneRecent) {
        throw new Error('Recent trip from same zone to same destination detected. Please wait 30 minutes.');
      }
      
      // // Validate trip time feasibility
      // const timeValidation = await validateTripTimeFeasibility(tripDataWithFeatures, userId);
      // if (!timeValidation.valid) {
      //   throw new Error(timeValidation.error);
      // }
    }

    // --- Official tariff validation ---
    const officialFare = OFFICIAL_TARIFF_BASE_FARE + OFFICIAL_TARIFF_PER_KM * data.distance;
    const minAllowedFare = officialFare * (1 + OFFICIAL_TARIFF_MIN_PERCENT_MODIFIER);
    const maxAllowedFare = officialFare * (1 + OFFICIAL_TARIFF_MAX_PERCENT_MODIFIER);

    let validationStatus = 'accepted';
    let suspicious = false;
    if (data.fare < minAllowedFare) {
      console.log('Fare below allowed minimum', data.fare, minAllowedFare);
      validationStatus = 'below_min_fare';
      suspicious = true;
    } else if (data.fare > maxAllowedFare) {
      console.log('Fare above allowed maximum', data.fare, maxAllowedFare);
      validationStatus = 'above_max_fare';
      suspicious = true;
    }

    if (validationStatus !== 'accepted') {
      // Attempt fallback using similar trips statistics
      const withinSimilar = await isFareWithinSimilarRange(data, mlFeatures);
      if (withinSimilar) {
        validationStatus = 'accepted';
        suspicious = false; // No longer suspicious if passes similarity check
      }
    }

    // Add metadata and ML features
    const tripData = {
      ...data,
      ...mlFeatures, // Include all ML features
      user_id: userId,
      submitted_at: admin.firestore.FieldValue.serverTimestamp(),
      ip_address: hashIp(request.ip),
      user_agent: request.headers?.['user-agent'] || 'unknown',
      suspicious: suspicious,
      validation_status: validationStatus,
      official_fare: officialFare,
      min_allowed_fare: minAllowedFare,
      max_allowed_fare: maxAllowedFare,
      is_admin_submission: isAdmin
    };

    // Save to Firestore
    const docRef = await db.collection('trips').add(tripData);
    
    // Invalidate cache for this user
    const cacheKey = `latest_trip_end_${userId}`;
    await db.collection('trip_cache').doc(cacheKey).delete();

    return {
      success: true,
      status: validationStatus,
      trip_id: docRef.id,
      message: validationStatus === 'accepted'
        ? 'Trip submitted successfully'
        : (validationStatus === 'below_min_fare'
            ? 'Fare below allowed minimum'
            : 'Fare above allowed maximum'),
      ml_features: mlFeatures, // Return ML features for debugging
      is_admin: isAdmin
    };
    
  } catch (error) {
    console.error('Error submitting trip:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Secure trip analysis (no direct data access)
exports.analyzeSimilarTrips = onCall({
  memory: '512MiB',
  timeoutSeconds: 60
}, async (request) => {
  const { data } = request;
  const context = request.auth;
  
  if (process.env.DEBUG_LOGS === 'true') {
    console.log('=== analyzeSimilarTrips DEBUG START ===');
  }
  if (process.env.DEBUG_LOGS === 'true') {
    console.log('Request data:', JSON.stringify(data, null, 2));
  }
  if (process.env.DEBUG_LOGS === 'true') {
    console.log('Context:', context ? 'Authenticated' : 'Unauthenticated');
  }
  
  try {
    // Get user ID for rate limiting
    const userId = data.user_id || (context ? context.uid : null);
    
    if (userId) {
      // Check if user is admin (bypasses rate limiting)
      const isAdmin = await isAdminUser(userId);
      
      if (!isAdmin) {
        // Apply rate limiting for non-admin users
        await checkRateLimit(userId);
      }
    }
    
    const { 
      fromLat, 
      fromLng, 
      toLat, 
      toLng, 
      distance, 
      startTime, 
      governorate,
      maxDistance = 5,
      maxTimeDiff = 2,
      maxDistanceDiff = 2
    } = data;

    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Extracted parameters:', {
        fromLat, fromLng, toLat, toLng, distance, startTime, governorate,
        maxDistance, maxTimeDiff, maxDistanceDiff
      });
    }

    // Validate input parameters
    if (!distance || distance <= 0 || distance > 100) {
      if (process.env.DEBUG_LOGS === 'true') {
        console.log('Distance validation failed:', { distance });
      }
      throw new Error('Invalid distance parameter');
    }
    
    // Egypt bounds validation for analysis
    if (fromLat && (fromLat < 22 || fromLat > 32)) {
    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Start latitude validation failed:', { fromLat });
    }
    throw new Error('Invalid start latitude');
    }
    
  if (toLat && (toLat < 22 || toLat > 32)) {
    if (process.env.DEBUG_LOGS === 'true') {
      console.log('End latitude validation failed:', { toLat });
    }
    throw new Error('Invalid end latitude');
    }
  
  if (fromLng && (fromLng < 25 || fromLng > 37)) {
    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Start longitude validation failed:', { fromLng });
    }
    throw new Error('Invalid start longitude');
  }
  if (toLng && (toLng < 25 || toLng > 37)) {
    if (process.env.DEBUG_LOGS === 'true') {
      console.log('End longitude validation failed:', { toLng });
    }
    throw new Error('Invalid end longitude');
  }

    // Calculate time range
    const startDate = new Date(startTime);
    const hour = startDate.getHours();
    const timeRangeStart = new Date(startDate);
    timeRangeStart.setHours(hour - maxTimeDiff, 0, 0, 0);
    const timeRangeEnd = new Date(startDate);
    timeRangeEnd.setHours(hour + maxTimeDiff, 59, 59, 999);

    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Time calculations:', {
        startTime,
        startDate: startDate.toISOString(),
        hour,
        timeRangeStart: timeRangeStart.toISOString(),
        timeRangeEnd: timeRangeEnd.toISOString()
      });
    }

    // Calculate distance range
    const distanceRangeStart = Math.max(0, distance - maxDistanceDiff);
    const distanceRangeEnd = distance + maxDistanceDiff;

    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Distance range calculations:', {
        distance,
        maxDistanceDiff,
        distanceRangeStart,
        distanceRangeEnd
      });
    }

    // Convert coordinates to zones (H3)
    const fromZone = fromLat && fromLng ? computeH3Zone(fromLat, fromLng) : null;
    const toZone = toLat && toLng ? computeH3Zone(toLat, toLng) : null;

    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Zone calculations:', { fromZone, toZone });
    }

    // Query for similar trips (server-side only)
    let tripsQuery = db.collection('trips')
      .where('from_zone', '==', fromZone)
      .where('to_zone', '==', toZone)
      .where('distance', '>=', distanceRangeStart)
      .where('distance', '<=', distanceRangeEnd)
      .where('fare', '>', 0);
      // Note: We'll filter suspicious trips in application logic to include records without suspicious field


    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Base query created with filters:', {
        distanceRangeStart,
        distanceRangeEnd,
        fareFilter: '> 0'
      });
    }

    // If governorate is available, filter by it
    if (governorate) {
      tripsQuery = tripsQuery.where('governorate', '==', governorate);
      if (process.env.DEBUG_LOGS === 'true') {
        console.log('Added governorate filter:', governorate);
      }
    }

    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Executing Firestore query...');
    }
    const snapshot = await tripsQuery.limit(100).get();
    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Query executed. Results count:', snapshot.size);
    }
    // Estimate fare via google vertex ai ml model
    const estimatedFare = await estimateFare(snapshot.docs.map(doc => doc.data()), {
      distance,
      fromLat,
      fromLng,
      toLat,
      toLng,
      startTime,
      governorate
    });

    if (snapshot.empty) {
      if (process.env.DEBUG_LOGS === 'true') {
        console.log('No trips found in query results');
      }
      return {
        success: true,
        data: {
          similarTripsCount: 0,
          averageFare: 0,
          fareRange: { min: 0, max: 0 },
          timeBasedAverage: { morning: { count: 0, avg: 0 }, afternoon: { count: 0, avg: 0 }, evening: { count: 0, avg: 0 }, night: { count: 0, avg: 0 } },
          dayBasedAverage: { sunday: { count: 0, avg: 0 }, monday: { count: 0, avg: 0 }, tuesday: { count: 0, avg: 0 }, wednesday: { count: 0, avg: 0 }, thursday: { count: 0, avg: 0 }, friday: { count: 0, avg: 0 }, saturday: { count: 0, avg: 0 } },
          distanceBasedAverage: { short: { count: 0, avg: 0 }, medium: { count: 0, avg: 0 }, long: { count: 0, avg: 0 } },
          fareDistribution: [],
          recentTrips: [],
          estimatedFare: 0
        }
      };
    }

    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Processing', snapshot.size, 'trips from query results');
    }
    
    const trips = [];
    snapshot.forEach(doc => {
      const trip = doc.data();
      trips.push({
        id: doc.id,
        ...trip
      });
    });
    
    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Sample trip data (first 2):', trips.slice(0, 2).map(trip => ({
        id: trip.id,
        distance: trip.distance,
        fare: trip.fare,
        from: trip.from,
        to: trip.to,
        start_time: trip.start_time
      })));
    }

    // Filter by geographic proximity (if coordinates are provided)
    let filteredTrips = trips;
    if (fromLat && fromLng && toLat && toLng) {
      if (process.env.DEBUG_LOGS === 'true') {
        console.log('Filtering by geographic proximity with coordinates:', {
          fromLat, fromLng, toLat, toLng, maxDistance
        });
      }
      
      const originalCount = trips.length;
      filteredTrips = trips.filter(trip => {
        if (!trip.from?.lat || !trip.from?.lng || !trip.to?.lat || !trip.to?.lng) {
          if (process.env.DEBUG_LOGS === 'true') {
            console.log('Trip missing coordinates:', trip.id);
          }
          return false;
        }
        
        const fromDistance = calculateDistance(fromLat, fromLng, trip.from.lat, trip.from.lng);
        const toDistance = calculateDistance(toLat, toLng, trip.to.lat, trip.to.lng);
        const isWithinRange = fromDistance <= maxDistance && toDistance <= maxDistance;
        
        if (!isWithinRange) {
          if (process.env.DEBUG_LOGS === 'true') {
            console.log('Trip outside geographic range:', {
              tripId: trip.id,
              fromDistance: Math.round(fromDistance * 100) / 100,
              toDistance: Math.round(toDistance * 100) / 100,
              maxDistance
            });
          }
        }
        
        return isWithinRange;
      });
      
      if (process.env.DEBUG_LOGS === 'true') {
        console.log('Geographic filtering results:', {
          originalCount,
          filteredCount: filteredTrips.length,
          removedCount: originalCount - filteredTrips.length
        });
      }
    } else {
      if (process.env.DEBUG_LOGS === 'true') {
        console.log('No geographic filtering applied - missing coordinates');
      }
    }

    // Filter out suspicious trips (include records without suspicious field)
    const originalCount = filteredTrips.length;
    filteredTrips = filteredTrips.filter(trip => {
      // Include trips where suspicious is false OR doesn't exist
      return trip.suspicious !== true;
    });
    
    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Suspicious filtering results:', {
        originalCount,
        filteredCount: filteredTrips.length,
        removedCount: originalCount - filteredTrips.length
      });
    }

    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Final trips count for analysis:', filteredTrips.length);
    }
    
    // Calculate statistics (same logic as before)
    const analysis = calculateTripStatistics(filteredTrips);
    
    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Analysis completed successfully');
    }
    if (process.env.DEBUG_LOGS === 'true') {
      console.log('=== analyzeSimilarTrips DEBUG END ===');
    }
    
    return {
      success: true,
      data: {
        ...analysis,
        estimatedFare: Math.round(estimatedFare * 100) / 100
      }
    };

  } catch (error) {
    if (process.env.DEBUG_LOGS === 'true') {
      console.error('=== analyzeSimilarTrips ERROR ===');
    }
    console.error('Error analyzing similar trips:', error);
    console.error('Error stack:', error.stack);
    if (process.env.DEBUG_LOGS === 'true') {
      console.error('=== analyzeSimilarTrips ERROR END ===');
    }
    return {
      success: false,
      error: error.message
    };
  }
});

// Only essential functions - no export needed

function hashIp(ip) {
  if (!ip) return 'unknown';
  return crypto.createHash('sha256').update(ip).digest('hex');
} 

async function estimateFare(trips, requestData = null) {
  if (!trips || trips.length === 0) {
    return 0;
  }
  
  try {
    // If we have request data, use it for prediction
    if (requestData) {
      // Extract ML features from the request data
      const mlFeatures = extractMLFeatures(requestData);
      
      // Make prediction using Vertex AI (disabled for now)
      // const predictedFare = await getVertexAIClient().predictFare({
      //   ...requestData,
      //   ...mlFeatures
      // });
      const predictedFare = 0; // Return 0 until Vertex AI is ready
      
      return predictedFare;
    }
    
    // Otherwise, use the most recent trip as reference
    const latestTrip = trips[0]; // Assuming trips are sorted by date
    const mlFeatures = extractMLFeatures(latestTrip);
    
    // const predictedFare = await getVertexAIClient().predictFare({
    //   ...latestTrip,
    //   ...mlFeatures
    // });
    const predictedFare = 0; // Return 0 until Vertex AI is ready
    
    return predictedFare;
    
  } catch (error) {
    console.error('Error making Vertex AI prediction:', error);
    // Fallback to 0 if Vertex AI fails
    return 0;
  }
}

// Calculate trip statistics (same as before)
function calculateTripStatistics(trips) {
  if (process.env.DEBUG_LOGS === 'true') {
    console.log('=== calculateTripStatistics DEBUG START ===');
  }
  if (process.env.DEBUG_LOGS === 'true') {
    console.log('Processing', trips.length, 'trips for statistics');
  }
  
  if (trips.length === 0) {
    if (process.env.DEBUG_LOGS === 'true') {
      console.log('No trips to analyze, returning empty statistics');
    }
    return {
      similarTripsCount: 0,
      averageFare: 0,
      fareRange: { min: 0, max: 0 },
      timeBasedAverage: { morning: { count: 0, avg: 0 }, afternoon: { count: 0, avg: 0 }, evening: { count: 0, avg: 0 }, night: { count: 0, avg: 0 } },
      dayBasedAverage: { sunday: { count: 0, avg: 0 }, monday: { count: 0, avg: 0 }, tuesday: { count: 0, avg: 0 }, wednesday: { count: 0, avg: 0 }, thursday: { count: 0, avg: 0 }, friday: { count: 0, avg: 0 }, saturday: { count: 0, avg: 0 } },
      distanceBasedAverage: { short: { count: 0, avg: 0 }, medium: { count: 0, avg: 0 }, long: { count: 0, avg: 0 } },
      fareDistribution: [],
      recentTrips: []
    };
  }

  // Calculate basic statistics
  const fares = trips.map(trip => trip.fare).filter(fare => fare > 0);
  if (process.env.DEBUG_LOGS === 'true') {
    console.log('Fare statistics:', {
      totalTrips: trips.length,
      tripsWithValidFares: fares.length,
      fareRange: fares.length > 0 ? { min: Math.min(...fares), max: Math.max(...fares) } : 'No valid fares'
    });
  }
  
  const averageFare = fares.length > 0 ? fares.reduce((a, b) => a + b, 0) / fares.length : 0;
  const fareRange = {
    min: fares.length > 0 ? Math.min(...fares) : 0,
    max: fares.length > 0 ? Math.max(...fares) : 0
  };
  
  if (process.env.DEBUG_LOGS === 'true') {
    console.log('Calculated fare statistics:', { averageFare, fareRange });
  }

  // Group by time periods
  const timeGroups = {
    morning: { count: 0, total: 0, avg: 0 },
    afternoon: { count: 0, total: 0, avg: 0 },
    evening: { count: 0, total: 0, avg: 0 },
    night: { count: 0, total: 0, avg: 0 }
  };

  // Group by day of week
  const dayGroups = {
    sunday: { count: 0, total: 0, avg: 0 },
    monday: { count: 0, total: 0, avg: 0 },
    tuesday: { count: 0, total: 0, avg: 0 },
    wednesday: { count: 0, total: 0, avg: 0 },
    thursday: { count: 0, total: 0, avg: 0 },
    friday: { count: 0, total: 0, avg: 0 },
    saturday: { count: 0, total: 0, avg: 0 }
  };

  let tripsWithStartTime = 0;
  trips.forEach(trip => {
    if (trip.start_time) {
      tripsWithStartTime++;
      const tripDate = new Date(trip.start_time);
      const tripHour = tripDate.getHours();
      const dayOfWeek = tripDate.getDay();
      
      // Time grouping
      if (tripHour >= 6 && tripHour < 12) {
        timeGroups.morning.count++;
        timeGroups.morning.total += trip.fare;
      } else if (tripHour >= 12 && tripHour < 18) {
        timeGroups.afternoon.count++;
        timeGroups.afternoon.total += trip.fare;
      } else if (tripHour >= 18 && tripHour < 24) {
        timeGroups.evening.count++;
        timeGroups.evening.total += trip.fare;
      } else {
        timeGroups.night.count++;
        timeGroups.night.total += trip.fare;
      }

      // Day grouping
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = dayNames[dayOfWeek];
      dayGroups[dayName].count++;
      dayGroups[dayName].total += trip.fare;
    }
  });
  
  if (process.env.DEBUG_LOGS === 'true') {
    console.log('Time-based grouping:', {
      tripsWithStartTime,
      tripsWithoutStartTime: trips.length - tripsWithStartTime,
      timeGroups
    });
  }

  // Calculate averages
  Object.keys(timeGroups).forEach(key => {
    if (timeGroups[key].count > 0) {
      timeGroups[key].avg = timeGroups[key].total / timeGroups[key].count;
    }
  });

  Object.keys(dayGroups).forEach(key => {
    if (dayGroups[key].count > 0) {
      dayGroups[key].avg = dayGroups[key].total / dayGroups[key].count;
    }
  });

  // Group by distance ranges
  const distanceGroups = {
    short: { count: 0, total: 0, avg: 0 },
    medium: { count: 0, total: 0, avg: 0 },
    long: { count: 0, total: 0, avg: 0 }
  };

  trips.forEach(trip => {
    if (trip.distance <= 5) {
      distanceGroups.short.count++;
      distanceGroups.short.total += trip.fare;
    } else if (trip.distance <= 15) {
      distanceGroups.medium.count++;
      distanceGroups.medium.total += trip.fare;
    } else {
      distanceGroups.long.count++;
      distanceGroups.long.total += trip.fare;
    }
  });

  Object.keys(distanceGroups).forEach(key => {
    if (distanceGroups[key].count > 0) {
      distanceGroups[key].avg = distanceGroups[key].total / distanceGroups[key].count;
    }
  });

  // Create fare distribution
  const fareDistribution = createFareDistribution(fares);

  // Get recent trips (anonymized)
  const recentTrips = trips
    .sort((a, b) => {
      const dateA = a.created_at || a.submitted_at || new Date(0);
      const dateB = b.created_at || b.submitted_at || new Date(0);
      return new Date(dateB) - new Date(dateA);
    })
    .slice(0, 10)
    .map(trip => ({
      fare: trip.fare,
      distance: trip.distance,
      duration: trip.duration,
      startTime: trip.start_time,
      from: trip.from?.governorate || 'غير محدد',
      to: trip.to?.governorate || 'غير محدد'
    }));
    

  const result = {
    similarTripsCount: trips.length,
    averageFare: Math.round(averageFare * 100) / 100,
    fareRange,
    timeBasedAverage: timeGroups,
    dayBasedAverage: dayGroups,
    distanceBasedAverage: distanceGroups,
    fareDistribution,
    recentTrips
  };
  
  if (process.env.DEBUG_LOGS === 'true') {
    console.log('Final analysis result:', {
      similarTripsCount: result.similarTripsCount,
      averageFare: result.averageFare,
      recentTripsCount: result.recentTrips.length
    });
  }
  if (process.env.DEBUG_LOGS === 'true') {
    console.log('=== calculateTripStatistics DEBUG END ===');
  }
  
  return result;
}

// Helper function to create fare distribution
function createFareDistribution(fares) {
  if (fares.length === 0) return [];

  const min = Math.min(...fares);
  const max = Math.max(...fares);
  const range = max - min;
  const bucketCount = 8;
  const bucketSize = range / bucketCount;

  const distribution = Array(bucketCount).fill(0);
  
  fares.forEach(fare => {
    const bucketIndex = Math.min(
      Math.floor((fare - min) / bucketSize),
      bucketCount - 1
    );
    distribution[bucketIndex]++;
  });

  return distribution.map((count, index) => ({
    range: `${Math.round(min + index * bucketSize)}-${Math.round(min + (index + 1) * bucketSize)}`,
    count,
    percentage: Math.round((count / fares.length) * 100)
  }));
} 

// Only essential functions - no export needed

function hashIp(ip) {
  if (!ip) return 'unknown';
  return crypto.createHash('sha256').update(ip).digest('hex');
} 

// Admin user management function
exports.setUserRole = onCall({
  memory: '256MiB',
  timeoutSeconds: 30
}, async (request) => {
  const { data } = request;
  const context = request.auth;
  
  try {
    // Only allow authenticated users
    if (!context || !context.uid) {
      throw new Error('Authentication required');
    }
    
    const { targetUserId, role } = data;
    
    if (!targetUserId || !role) {
      throw new Error('Target user ID and role are required');
    }
    
    // Check if current user is admin
    const currentUserIsAdmin = await isAdminUser(context.uid);
    if (!currentUserIsAdmin) {
      throw new Error('Only admins can modify user roles');
    }
    
    // Validate role
    const validRoles = ['user', 'admin'];
    if (!validRoles.includes(role)) {
      throw new Error('Invalid role. Must be "user" or "admin"');
    }
    
    // Set user role
    await db.collection('users').doc(targetUserId).set({
      role: role,
      updated_by: context.uid,
      updated_at: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    return {
      success: true,
      message: `User role updated to ${role}`
    };
    
  } catch (error) {
    console.error('Error setting user role:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

// Function to get user's current role
exports.getUserRole = onCall({
  memory: '256MiB',
  timeoutSeconds: 30
}, async (request) => {
  const { data } = request;
  const context = request.auth;
  
  try {
    // Only allow authenticated users
    if (!context || !context.uid) {
      throw new Error('Authentication required');
    }
    
    const targetUserId = data.userId || context.uid;
    
    // Check if current user is admin or requesting their own role
    const currentUserIsAdmin = await isAdminUser(context.uid);
    if (!currentUserIsAdmin && targetUserId !== context.uid) {
      throw new Error('You can only view your own role');
    }
    
    const userDoc = await db.collection('users').doc(targetUserId).get();
    
    if (!userDoc.exists) {
      return {
        success: true,
        role: 'user', // Default role
        isAdmin: false
      };
    }
    
    const userData = userDoc.data();
    const role = userData.role || 'user';
    
    return {
      success: true,
      role: role,
      isAdmin: role === 'admin'
    };
    
  } catch (error) {
    console.error('Error getting user role:', error);
    return {
      success: false,
      error: error.message
    };
  }
}); 

// Function to backfill H3 zones for existing trips
exports.backfillH3Zones = onCall({
  memory: '1GiB',
  timeoutSeconds: 540 // 9 minutes max
}, async (request) => {
  const { data } = request;
  const context = request.auth;
  
  try {
    // Only allow authenticated users
    if (!context || !context.uid) {
      throw new Error('Authentication required');
    }
    
    // Check if user is admin (only admins can backfill)
    const isAdmin = await isAdminUser(context.uid);
    if (!isAdmin) {
      throw new Error('Only admins can perform H3 zone backfill');
    }
    
    const { batchSize = 100, maxBatches = 50 } = data || {};
    
    console.log(`Starting H3 zone backfill with batch size ${batchSize}, max ${maxBatches} batches`);
    
    let totalProcessed = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let batchCount = 0;
    let lastDoc = null;
    
    while (batchCount < maxBatches) {
      // Query for trips
      let query = db.collection('trips')
        .orderBy(admin.firestore.FieldPath.documentId())
        .limit(batchSize);
      
      if (lastDoc) {
        query = query.startAfter(lastDoc.id);
      }
      
      const snapshot = await query.get();
      if (snapshot.empty) {
        console.log('No more trips to process');
        break;
      }
      
      const batch = db.batch();
      let batchUpdates = 0;
      
      snapshot.docs.forEach(doc => {
        const tripData = doc.data();
        
        const fromLat = tripData?.from?.lat;
        const fromLng = tripData?.from?.lng;
        const toLat = tripData?.to?.lat;
        const toLng = tripData?.to?.lng;
        
        let fromZone = tripData.from_zone;
        let toZone = tripData.to_zone;
        
        // Check if zones need updating (missing or legacy text zones)
        const isH3Zone = (zone) => {
          return typeof zone === 'string' && 
                 /^[0-9a-f]+$/i.test(zone) && 
                 zone.length >= 5;
        };
        
        const needsFromZone = (!fromZone || !isH3Zone(fromZone)) && 
                             fromLat != null && fromLng != null;
        const needsToZone = (!toZone || !isH3Zone(toZone)) && 
                           toLat != null && toLng != null;
        
        if (needsFromZone || needsToZone) {
          if (needsFromZone) {
            fromZone = computeH3Zone(fromLat, fromLng);
          }
          if (needsToZone) {
            toZone = computeH3Zone(toLat, toLng);
          }
          
          batch.update(doc.ref, {
            ...(needsFromZone ? { from_zone: fromZone } : {}),
            ...(needsToZone ? { to_zone: toZone } : {}),
            h3_backfilled_at: admin.firestore.FieldValue.serverTimestamp(),
            h3_resolution: H3_RESOLUTION
          });
          
          batchUpdates++;
          totalUpdated++;
        } else {
          totalSkipped++;
        }
        
        totalProcessed++;
      });
      
      if (batchUpdates > 0) {
        await batch.commit();
        console.log(`Batch ${batchCount + 1}: Updated ${batchUpdates} trips`);
      }
      
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
      batchCount++;
      
      // Progress update
      if (batchCount % 10 === 0) {
        console.log(`Progress: ${totalProcessed} processed, ${totalUpdated} updated, ${totalSkipped} skipped`);
      }
    }
    
    console.log(`H3 zone backfill completed:`);
    console.log(`  Total processed: ${totalProcessed}`);
    console.log(`  Total updated: ${totalUpdated}`);
    console.log(`  Total skipped: ${totalSkipped}`);
    console.log(`  Batches processed: ${batchCount}`);
    
    return {
      success: true,
      message: 'H3 zone backfill completed successfully',
      data: {
        totalProcessed,
        totalUpdated,
        totalSkipped,
        batchesProcessed: batchCount,
        h3Resolution: H3_RESOLUTION
      }
    };
    
  } catch (error) {
    console.error('Error during H3 zone backfill:', error);
    return {
      success: false,
      error: error.message
    };
  }
}); 