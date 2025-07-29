// routeHelpers.js
// Helper functions for route distance calculations and geocoding

// Calculates driving distance between two points using OpenRouteService
export async function getRouteDistanceORS(start, end, getGeometry = false) {
  const apiKey = 'eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImRkZGE0M2MyYWVmNDRkYzFiYWRmMzMyN2IzMzhmMzMxIiwiaCI6Im11cm11cjY0In0='; // <-- Replace with your real key!
  const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${start.lng},${start.lat}&end=${end.lng},${end.lat}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('ORS API error');
    const data = await res.json();
    
    if (getGeometry) {
      // Return both distance and geometry
      const distanceKm = data.features[0].properties.summary.distance / 1000;
      const geometry = data.features[0].geometry.coordinates.map(coord => ({
        latitude: coord[1],
        longitude: coord[0]
      }));
      return { distance: distanceKm, geometry };
    } else {
      // Return only distance (backward compatibility)
      const distanceKm = data.features[0].properties.summary.distance / 1000;
      return distanceKm;
    }
  } catch (err) {
    console.error('Error fetching route distance:', err);
    return getGeometry ? { distance: null, geometry: [] } : null;
  }
}

// Calculates total distance (in km) from an array of {lat, lng} points (tracked route)
export function calculateRouteDistance(route) {
  if (!route || route.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += haversine(route[i-1], route[i]);
  }
  return total / 1000; // return in kilometers
}

function haversine(a, b) {
  const R = 6371000; // meters
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad((b.lat || b.latitude) - (a.lat || a.latitude));
  const dLon = toRad((b.lng || b.longitude) - (a.lng || a.longitude));
  const lat1 = toRad(a.lat || a.latitude);
  const lat2 = toRad(b.lat || b.latitude);
  const h =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Downsamples a route array to N points (start, end, and evenly spaced in between)
export function distillRoute(route, maxPoints = 20) {
  if (!route || route.length <= maxPoints) return route;
  const result = [];
  const step = (route.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const idx = Math.round(i * step);
    result.push(route[idx]);
  }
  return result;
}

const MAPBOX_TOKEN = 'pk.eyJ1IjoibWVkb3dlc3NhbSIsImEiOiJjbWRrNmNoOGMwdjV4MmpxeXRlMWRiZmF2In0.VIllyVMDcPZVM00od5u0yg';

// Gets the governorate/state from coordinates using Mapbox Geocoding API
export async function getGovernorateFromCoords(lat, lng) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=region&language=ar,en`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Mapbox Geocoding error');
    const data = await res.json();
    // Try to get governorate from features
    const gov = data.features && data.features[0] && (data.features[0].text || data.features[0].place_name) || '';
    return gov;
  } catch (err) {
    console.error('Error fetching governorate:', err);
    return '';
  }
}
export async function reverseGeocode(lat, lng){
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=ar,en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Mapbox Geocoding error');
    const data = await res.json();
    return data.features && data.features[0] && data.features[0].place_name || '';
  } catch (err) {
    console.error('Error fetching address:', err);
    return '';
  }
};

// Gets the full address name from coordinates using Mapbox Geocoding API
export async function getAddressFromCoords(lat, lng) {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=ar,en`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Mapbox Geocoding error');
    const data = await res.json();
    return data.features && data.features[0] && data.features[0].place_name || '';
  } catch (err) {
    console.error('Error fetching address:', err);
    return '';
  }
}

// Search places using Mapbox Geocoding API
export async function searchPlacesMapbox(query, currentLocation = null) {
  try {
    let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&language=ar,en&limit=10&types=poi,place,address&country=EG`;
    
    // Add proximity if we have current location (prioritize results near user)
    if (currentLocation) {
      url += `&proximity=${currentLocation.longitude},${currentLocation.latitude}`;
    } else {
      // Default to Cairo center if no current location
      url += `&proximity=31.2357,30.0444`;
    }
    
    const res = await fetch(url);
    if (!res.ok) throw new Error('Mapbox Geocoding error');
    const data = await res.json();
    
    // Transform Mapbox response to match the expected format
    return data.features.map(feature => ({
      place_id: feature.id,
      display_name: feature.place_name,
      lat: feature.center[1],
      lon: feature.center[0],
      type: feature.place_type[0]
    }));
  } catch (err) {
    console.error('Error searching places:', err);
    return [];
  }
}