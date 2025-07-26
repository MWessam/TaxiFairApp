import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location'; // Import expo-location
import { distillRoute, calculateRouteDistance, getGovernorateFromCoords, getAddressFromCoords } from '../../routeHelpers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  startBackgroundTracking, 
  stopBackgroundTracking, 
  isTrackingActive, 
  getCurrentTrackingData, 
  clearTrackingData 
} from '../../services/backgroundTracking';
import locationService from '../../services/locationService';

export default function TrackRide() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isTracking, setIsTracking] = useState(false);
  const [route, setRoute] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passengers, setPassengers] = useState('');

  // This function loads the tracked route from storage and updates the map
  const loadRouteFromStorage = async () => {
    const trackingData = await getCurrentTrackingData();
    if (trackingData && trackingData.route && trackingData.route.length > 0) {
      setRoute(trackingData.route);
      setCurrentLocation(trackingData.route[trackingData.route.length - 1]);
    }
    return trackingData?.route || [];
  };
  
  // useFocusEffect runs when the screen comes into view.
  useFocusEffect(
    useCallback(() => {
      // Check if a trip is already in progress when the screen loads
      const checkTrackingStatus = async () => {
        const isActive = await isTrackingActive();
        setIsTracking(isActive);
        if (isActive) {
          loadRouteFromStorage();
        }
      };
      
      checkTrackingStatus();

      // Set up a listener to update the route on the map in real-time
      // as the background task saves new points. This keeps the UI in sync
      // when the app is brought back from the background.
      const interval = setInterval(async () => {
        const isActive = await isTrackingActive();
        if (isActive) {
          loadRouteFromStorage();
        }
      }, 2000); // Update every 2 seconds for a smoother feel

      return () => clearInterval(interval);
    }, [])
  );

  // This effect handles the case where the user taps the "stop tracking" notification
  useEffect(() => {
    if (params.finalize_trip === 'true') {
      // Remove the param so it doesn't trigger again on screen focus
      router.setParams({ finalize_trip: '' }); 
      endTracking();
    }
  }, [params.finalize_trip]);

  const startTracking = async () => {
    console.log('Starting tracking');
    
    // Request location permission using the centralized service
    const location = await locationService.requestLocationPermission();
    if (!location) {
      Alert.alert('Permission Required', 'Please enable location permissions to track your ride.');
      return;
    }
    console.log('Location permission granted');

    // Request background permission
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    if (backgroundStatus !== 'granted') {
      Alert.alert('Permission Required', 'Please enable background location permissions to track your ride when the app is closed.');
      return;
    }
    console.log('Background permission granted');
    
    // Clear any existing tracking data
    await clearTrackingData();
    console.log('Cleared tracked locations');
    setRoute([]);
    console.log('Set route to empty array');
    
    // Start background tracking with current location
    const success = await startBackgroundTracking(location);
    if (success) {
      console.log('Started background location tracking');
      setIsTracking(true);
      console.log('Set isTracking to true');
    } else {
      console.log('Failed to start background tracking');
      Alert.alert('Error', 'Failed to start background tracking. Please try again.');
    }
  };

  const endTracking = async () => {
    setLoading(true);
    
    try {
      // Stop background tracking
      await stopBackgroundTracking();
      
      // Get the tracking data
      const trackingData = await getCurrentTrackingData();
      if (!trackingData || !trackingData.route || trackingData.route.length < 2) {
        Alert.alert("Error", "Not enough location points were recorded for a trip.");
        setLoading(false);
        await clearTrackingData();
        setIsTracking(false);
        setRoute([]);
        return;
      }

      const finalRoute = trackingData.route;
      const startTime = new Date(trackingData.startTime);
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      const startLoc = finalRoute[0];
      const endLoc = finalRoute[finalRoute.length - 1];

      const [startAddressName, endAddressName, governorate] = await Promise.all([
        getAddressFromCoords(startLoc.latitude, startLoc.longitude),
        getAddressFromCoords(endLoc.latitude, endLoc.longitude),
        getGovernorateFromCoords(startLoc.latitude, startLoc.longitude)
      ]);
      
      const distance = calculateRouteDistance(finalRoute);
      const distilled = distillRoute(finalRoute, 20);

      const tripData = {
        from: { lat: startLoc.latitude, lng: startLoc.longitude, name: startAddressName },
        to: { lat: endLoc.latitude, lng: endLoc.longitude, name: endAddressName },
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration: durationMinutes,
        passenger_count: passengers ? Number(passengers) : 1,
        governorate,
        route: distilled,
        distance,
      };

      // Clean up storage
      await clearTrackingData();
      setIsTracking(false);
      setRoute([]);

      router.push({
        pathname: '/(other)/FareResults',
        params: {
          from: startAddressName,
          to: endAddressName,
          duration: durationMinutes.toString(),
          passengers: passengers || '1',
          distance: distance.toFixed(2),
          governorate,
          mode: 'track',
          tripData: JSON.stringify(tripData),
        },
      });

    } catch (err) {
      console.error("Error processing trip:", err);
      Alert.alert("Error", "An error occurred while processing the trip data.");
    } finally {
      setLoading(false);
    }
  };
  
  const getMapCenter = () => {
    // Center on the latest point of the route, or a default location
    if (currentLocation) {
      return [currentLocation.longitude, currentLocation.latitude];
    }
    return [31.2357, 30.0444]; // Default to Cairo
  };

  return (
    <View style={styles.container}>
      <MapboxGL.MapView style={styles.map}>
        <MapboxGL.Camera
          centerCoordinate={getMapCenter()}
          zoomLevel={16}
          animationMode='flyTo'
          animationDuration={1200}
          followUserLocation={!isTracking} // Follow user until tracking starts
          followUserMode='normal'
        />
        
        {/* This component provides the blue dot for the user's location */}
        <MapboxGL.UserLocation 
          visible={true}
          showsUserHeadingIndicator={true}
          onUpdate={(location) => setCurrentLocation(location.coords)}
        />

        {/* This component draws the tracked route line */}
        {route.length > 1 && (
          <MapboxGL.ShapeSource id="routeSource" shape={{
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: route.map(p => [p.longitude, p.latitude]) },
          }}>
            <MapboxGL.LineLayer id="routeLine" style={{ lineColor: '#d32f2f', lineWidth: 4 }} />
          </MapboxGL.ShapeSource>
        )}
      </MapboxGL.MapView>

      <View style={styles.bottomPanel}>
        <Text style={styles.title}>ابدأ تتبع رحلتك</Text>
        <TextInput
          style={styles.input}
          placeholder="عدد الركاب (اختياري)"
          keyboardType="numeric"
          value={passengers}
          onChangeText={setPassengers}
        />
        {!isTracking ? (
          <TouchableOpacity style={styles.button} onPress={startTracking}>
            <Text style={styles.buttonText}>ابدأ التتبع</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.button, { backgroundColor: '#222' }]} onPress={endTracking}>
            <Text style={styles.buttonText}>انهاء التتبع</Text>
          </TouchableOpacity>
        )}
        {loading && <ActivityIndicator size="large" color="#d32f2f" style={{ marginTop: 10 }} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 12,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 10,
    color: '#222',
  },
  button: {
    backgroundColor: '#d32f2f',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
