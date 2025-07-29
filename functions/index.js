const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { tripSchema } = require('./schema');
// Lazy load zone manager
let zoneManager;

function getZoneManager() {
  if (!zoneManager) {
    zoneManager = require('./zone-manager');
  }
  return zoneManager;
}

// Vertex AI will be loaded when needed
function getVertexAIClient() {
  // For now, return null since we're not using Vertex AI yet
  return null;
}

admin.initializeApp();

const db = admin.firestore();

// Bot protection and rate limiting (Firestore-backed)
const MAX_SUBMISSIONS_PER_HOUR = 5;
const MAX_SUBMISSIONS_PER_DAY = 50;

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

// Tariff validation constants
const TARIFF_CONFIG = {
  BASE_FARE: 9, // Base fare in EGP
  PER_KM_RATE: 2, // Rate per kilometer in EGP
  MIN_PERCENTAGE_MODIFIER: 0.15, // 15% minimum
  MAX_PERCENTAGE_MODIFIER: 0.60, // 60% maximum
  ESTIMATE_PERCENTAGE_MODIFIER: 0.40, // 40% for estimate
  OUTLIER_MULTIPLIER: 1.5, // For IQR outlier detection
};

// Zone determination is now handled by zone-manager.js

// Function to extract ML features from trip data
function extractMLFeatures(tripData) {
  const features = {};
  
  // Extract time features
  if (tripData.start_time) {
    const startDate = new Date(tripData.start_time);
    features.time_of_day = startDate.getHours(); // 0-23
    features.day_of_week = startDate.getDay(); // 0=Sunday, 6=Saturday
    features.date = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    features.month = startDate.getMonth() + 1; // 1-12 (getMonth() returns 0-11)
    features.day_of_month = startDate.getDate(); // 1-31
  }
  
  // Extract speed feature
  if (tripData.distance && tripData.duration) {
    features.speed_kmh = (tripData.distance / tripData.duration) * 60;
  }
  
  // Extract zone features
  if (tripData.from?.lat && tripData.from?.lng) {
    features.from_zone = getZoneManager().getZoneFromCoordinates(tripData.from.lat, tripData.from.lng);
  }
  if (tripData.to?.lat && tripData.to?.lng) {
    features.to_zone = getZoneManager().getZoneFromCoordinates(tripData.to.lat, tripData.to.lng);
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
  
  // Location validation - Updated for Mansoura specifically
  if (tripData.from && tripData.from.lat && tripData.from.lng) {
    // Mansoura coordinates roughly: lat 31.04, lng 31.37
    if (tripData.from.lat < 30.9 || tripData.from.lat > 31.2 || 
        tripData.from.lng < 31.3 || tripData.from.lng > 31.5) {
      errors.push('Start location seems outside Mansoura area');
    }
  }
  
  if (tripData.to && tripData.to.lat && tripData.to.lng) {
    if (tripData.to.lat < 30.9 || tripData.to.lat > 31.2 || 
        tripData.to.lng < 31.3 || tripData.to.lng > 31.5) {
      errors.push('End location seems outside Mansoura area');
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

async function checkRateLimit(identifier) {
  const now = Date.now();
  const hourSlot = Math.floor(now / 3600000);
  const daySlot = Math.floor(now / 86400000);

  const docRef = db.collection('rate_limits').doc(identifier);

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
      throw new Error('Too many submissions this hour. Please wait.');
    }
    if (dayCount >= MAX_SUBMISSIONS_PER_DAY) {
      throw new Error('Too many submissions today. Please try again tomorrow.');
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

// Secure trip submission with validation
exports.submitTrip = onCall({
  memory: '512MiB',
  timeoutSeconds: 60
}, async (request) => {
  const { data } = request;
  const context = request.auth;
  try {
    // No user authentication required – function protected by rate limiting only.
    
    // Rate limiting based on IP address for now
    const identifier = context ? context.uid : (request.ip || 'unknown');
    if (!identifier || identifier.trim() === '') {
      throw new Error('Unable to identify user for rate limiting');
    }
    await checkRateLimit(identifier);
    
    // Validate trip data using Zod schema
    const parseResult = tripSchema.safeParse(data);
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map(i => i.message);
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }
    
    // Extract ML features from the trip data
    const mlFeatures = extractMLFeatures(data);
    
    // Add metadata and ML features
    const tripData = {
      ...data,
      ...mlFeatures, // Include all ML features
      user_id: context ? context.uid : 'anonymous',
      submitted_at: admin.firestore.FieldValue.serverTimestamp(),
      ip_address: hashIp(request.ip),
      user_agent: request.headers?.['user-agent'] || 'unknown'
    };
    
    // Save to Firestore
    const docRef = await db.collection('trips').add(tripData);
    
    return {
      success: true,
      trip_id: docRef.id,
      message: 'Trip submitted successfully',
      ml_features: mlFeatures // Return ML features for debugging
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
    // No user authentication required – function protected by rate limiting only.
    
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

    // Query for similar trips (server-side only)
    let tripsQuery = db.collection('trips')
      .where('distance', '>=', distanceRangeStart)
      .where('distance', '<=', distanceRangeEnd)
      .where('fare', '>', 0);

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

// Only essential functions - no zone management needed

// Only essential functions - no testing needed

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