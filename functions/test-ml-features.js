// Test script for ML features extraction
const { extractMLFeatures, getZoneFromCoordinates } = require('./index');

// Test data
const testTrip = {
  fare: 50,
  distance: 10,
  duration: 20,
  passenger_count: 2,
  from: {
    lat: 31.04,
    lng: 31.37,
    name: 'University'
  },
  to: {
    lat: 31.05,
    lng: 31.36,
    name: 'Toreil'
  },
  start_time: '2024-01-15T08:30:00Z', // Monday morning
  governorate: 'Mansoura'
};

console.log('Test Trip Data:', testTrip);
console.log('\nExtracted ML Features:', extractMLFeatures(testTrip));

// Test zone mapping
console.log('\nZone Tests:');
console.log('University area (31.04, 31.37):', getZoneFromCoordinates(31.04, 31.37));
console.log('Toreil area (31.05, 31.36):', getZoneFromCoordinates(31.05, 31.36));
console.log('Unknown area (31.08, 31.40):', getZoneFromCoordinates(31.08, 31.40)); 