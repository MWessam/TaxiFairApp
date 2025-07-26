const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();

// Bot protection and rate limiting
const rateLimitMap = new Map();
const MAX_SUBMISSIONS_PER_HOUR = 5;
const MAX_SUBMISSIONS_PER_DAY = 50;

// Clean up rate limit map every hour
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of rateLimitMap.entries()) {
    if (now - timestamp > 3600000) { // 1 hour
      rateLimitMap.delete(key);
    }
  }
}, 3600000);

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
  
  // Location validation
  if (tripData.from && tripData.from.lat && tripData.from.lng) {
    if (tripData.from.lat < 22 || tripData.from.lat > 32 || 
        tripData.from.lng < 25 || tripData.from.lng > 37) {
      errors.push('Start location seems outside Egypt');
    }
  }
  
  if (tripData.to && tripData.to.lat && tripData.to.lng) {
    if (tripData.to.lat < 22 || tripData.to.lat > 32 || 
        tripData.to.lng < 25 || tripData.to.lng > 37) {
      errors.push('End location seems outside Egypt');
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
  
//   // Time validation
//   if (tripData.start_time) {
//     const startTime = new Date(tripData.start_time);
//     const now = new Date();
//     if (startTime > now) {
//       errors.push('Start time cannot be in the future');
//     }
//     if (startTime < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) { // 7 days ago
//       errors.push('Start time cannot be more than 7 days ago');
//     }
//   }
  
  return errors;
}

// Rate limiting function
function checkRateLimit(identifier) {
  const now = Date.now();
  const hourKey = `${identifier}_${Math.floor(now / 3600000)}`;
  const dayKey = `${identifier}_${Math.floor(now / 86400000)}`;
  
  const hourCount = rateLimitMap.get(hourKey) || 0;
  const dayCount = rateLimitMap.get(dayKey) || 0;
  
  if (hourCount >= MAX_SUBMISSIONS_PER_HOUR) {
    throw new Error('Too many submissions this hour. Please wait.');
  }
  
  if (dayCount >= MAX_SUBMISSIONS_PER_DAY) {
    throw new Error('Too many submissions today. Please try again tomorrow.');
  }
  
  rateLimitMap.set(hourKey, hourCount + 1);
  rateLimitMap.set(dayKey, dayCount + 1);
}

// Secure trip submission with validation
exports.submitTrip = onCall(async (request) => {
  const { data } = request;
  const context = request.auth;
  try {
    // For now, allow unauthenticated requests (you can enable auth later)
    // if (!context) {
    //   throw new Error('Authentication required');
    // }
    
    // Rate limiting based on IP address for now
    const identifier = context ? context.uid : request.ip;
    checkRateLimit(identifier);
    
    // Validate trip data
    const validationErrors = validateTripFeasibility(data);
    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }
    
    // Add metadata
    const tripData = {
      ...data,
      user_id: context ? context.uid : 'anonymous',
      submitted_at: admin.firestore.FieldValue.serverTimestamp(),
      ip_address: request.ip || 'unknown',
      user_agent: request.headers?.['user-agent'] || 'unknown'
    };
    
    // Save to Firestore
    const docRef = await db.collection('trips').add(tripData);
    
    return {
      success: true,
      trip_id: docRef.id,
      message: 'Trip submitted successfully'
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
exports.analyzeSimilarTrips = onCall(async (request) => {
  const { data } = request;
  const context = request.auth;
  
  console.log('=== analyzeSimilarTrips DEBUG START ===');
  console.log('Request data:', JSON.stringify(data, null, 2));
  console.log('Context:', context ? 'Authenticated' : 'Unauthenticated');
  
  try {
    // For now, allow unauthenticated requests (you can enable auth later)
    // if (!context) {
    //   throw new Error('Authentication required');
    // }
    
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

    console.log('Extracted parameters:', {
      fromLat, fromLng, toLat, toLng, distance, startTime, governorate,
      maxDistance, maxTimeDiff, maxDistanceDiff
    });

    // Validate input parameters
    if (!distance || distance <= 0 || distance > 100) {
      console.log('Distance validation failed:', { distance });
      throw new Error('Invalid distance parameter');
    }
    
    if (fromLat && (fromLat < 22 || fromLat > 32)) {
      console.log('Start latitude validation failed:', { fromLat });
      throw new Error('Invalid start latitude');
    }
    
    if (toLat && (toLat < 22 || toLat > 32)) {
      console.log('End latitude validation failed:', { toLat });
      throw new Error('Invalid end latitude');
    }

    // Calculate time range
    const startDate = new Date(startTime);
    const hour = startDate.getHours();
    const timeRangeStart = new Date(startDate);
    timeRangeStart.setHours(hour - maxTimeDiff, 0, 0, 0);
    const timeRangeEnd = new Date(startDate);
    timeRangeEnd.setHours(hour + maxTimeDiff, 59, 59, 999);

    console.log('Time calculations:', {
      startTime,
      startDate: startDate.toISOString(),
      hour,
      timeRangeStart: timeRangeStart.toISOString(),
      timeRangeEnd: timeRangeEnd.toISOString()
    });

    // Calculate distance range
    const distanceRangeStart = Math.max(0, distance - maxDistanceDiff);
    const distanceRangeEnd = distance + maxDistanceDiff;

    console.log('Distance range calculations:', {
      distance,
      maxDistanceDiff,
      distanceRangeStart,
      distanceRangeEnd
    });

    // Query for similar trips (server-side only)
    let tripsQuery = db.collection('trips')
      .where('distance', '>=', distanceRangeStart)
      .where('distance', '<=', distanceRangeEnd)
      .where('fare', '>', 0);

    console.log('Base query created with filters:', {
      distanceRangeStart,
      distanceRangeEnd,
      fareFilter: '> 0'
    });

    // If governorate is available, filter by it
    if (governorate) {
      tripsQuery = tripsQuery.where('governorate', '==', governorate);
      console.log('Added governorate filter:', governorate);
    }

    console.log('Executing Firestore query...');
    const snapshot = await tripsQuery.limit(100).get();
    console.log('Query executed. Results count:', snapshot.size);

    if (snapshot.empty) {
      console.log('No trips found in query results');
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
          recentTrips: []
        }
      };
    }

    console.log('Processing', snapshot.size, 'trips from query results');
    
    const trips = [];
    snapshot.forEach(doc => {
      const trip = doc.data();
      trips.push({
        id: doc.id,
        ...trip
      });
    });
    
    console.log('Sample trip data (first 2):', trips.slice(0, 2).map(trip => ({
      id: trip.id,
      distance: trip.distance,
      fare: trip.fare,
      from: trip.from,
      to: trip.to,
      start_time: trip.start_time
    })));

    // Filter by geographic proximity (if coordinates are provided)
    let filteredTrips = trips;
    if (fromLat && fromLng && toLat && toLng) {
      console.log('Filtering by geographic proximity with coordinates:', {
        fromLat, fromLng, toLat, toLng, maxDistance
      });
      
      const originalCount = trips.length;
      filteredTrips = trips.filter(trip => {
        if (!trip.from?.lat || !trip.from?.lng || !trip.to?.lat || !trip.to?.lng) {
          console.log('Trip missing coordinates:', trip.id);
          return false;
        }
        
        const fromDistance = calculateDistance(fromLat, fromLng, trip.from.lat, trip.from.lng);
        const toDistance = calculateDistance(toLat, toLng, trip.to.lat, trip.to.lng);
        const isWithinRange = fromDistance <= maxDistance && toDistance <= maxDistance;
        
        if (!isWithinRange) {
          console.log('Trip outside geographic range:', {
            tripId: trip.id,
            fromDistance: Math.round(fromDistance * 100) / 100,
            toDistance: Math.round(toDistance * 100) / 100,
            maxDistance
          });
        }
        
        return isWithinRange;
      });
      
      console.log('Geographic filtering results:', {
        originalCount,
        filteredCount: filteredTrips.length,
        removedCount: originalCount - filteredTrips.length
      });
    } else {
      console.log('No geographic filtering applied - missing coordinates');
    }

    console.log('Final trips count for analysis:', filteredTrips.length);
    
    // Calculate statistics (same logic as before)
    const analysis = calculateTripStatistics(filteredTrips);
    
    console.log('Analysis completed successfully');
    console.log('=== analyzeSimilarTrips DEBUG END ===');
    
    return {
      success: true,
      data: analysis
    };

  } catch (error) {
    console.error('=== analyzeSimilarTrips ERROR ===');
    console.error('Error analyzing similar trips:', error);
    console.error('Error stack:', error.stack);
    console.error('=== analyzeSimilarTrips ERROR END ===');
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

// Calculate trip statistics (same as before)
function calculateTripStatistics(trips) {
  console.log('=== calculateTripStatistics DEBUG START ===');
  console.log('Processing', trips.length, 'trips for statistics');
  
  if (trips.length === 0) {
    console.log('No trips to analyze, returning empty statistics');
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
  console.log('Fare statistics:', {
    totalTrips: trips.length,
    tripsWithValidFares: fares.length,
    fareRange: fares.length > 0 ? { min: Math.min(...fares), max: Math.max(...fares) } : 'No valid fares'
  });
  
  const averageFare = fares.length > 0 ? fares.reduce((a, b) => a + b, 0) / fares.length : 0;
  const fareRange = {
    min: fares.length > 0 ? Math.min(...fares) : 0,
    max: fares.length > 0 ? Math.max(...fares) : 0
  };
  
  console.log('Calculated fare statistics:', { averageFare, fareRange });

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
  
  console.log('Time-based grouping:', {
    tripsWithStartTime,
    tripsWithoutStartTime: trips.length - tripsWithStartTime,
    timeGroups
  });

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
  
  console.log('Final analysis result:', {
    similarTripsCount: result.similarTripsCount,
    averageFare: result.averageFare,
    recentTripsCount: result.recentTrips.length
  });
  console.log('=== calculateTripStatistics DEBUG END ===');
  
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