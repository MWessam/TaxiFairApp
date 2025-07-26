import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Linking } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useRouter } from 'expo-router';
import { distillRoute, calculateRouteDistance, getGovernorateFromCoords, getAddressFromCoords } from '../../routeHelpers';
import { startBackgroundTracking, stopBackgroundTracking, isTrackingActive, getCurrentTrackingData, setupNotificationHandler, clearTrackingData } from '../../services/backgroundTracking';
import locationService from '../../services/locationService';

// MapboxGL.setAccessToken("YOUR_MAPBOX_ACCESS_TOKEN");

export default function TrackRide() {
  const [tracking, setTracking] = useState(false);
  const [route, setRoute] = useState([]);
  const [startLoc, setStartLoc] = useState(null);
  const [endLoc, setEndLoc] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [passengers, setPassengers] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [backgroundTrackingActive, setBackgroundTrackingActive] = useState(false);
  const [locationStatus, setLocationStatus] = useState('requesting'); // 'requesting', 'granted', 'denied'

  const cameraRef = useRef(null);
  const router = useRouter();

  // Setup notification handler and subscribe to location service
  useEffect(() => {
    setupNotificationHandler();
    
    // Subscribe to location service updates
    const unsubscribe = locationService.subscribe(({ location, status }) => {
      setCurrentLocation(location);
      setLocationStatus(status);
    });
    
    // Check if background tracking is already active
    checkBackgroundTrackingStatus();
    
    // Cleanup subscription
    return unsubscribe;
  }, []);

  // Clear any stale tracking data on component mount
  useEffect(() => {
    const clearStaleData = async () => {
      try {
        const trackingData = await getCurrentTrackingData();
        console.log('Checking for stale tracking data:', trackingData);
        
        if (trackingData && (!trackingData.isTracking || !trackingData.startLocation || !trackingData.route)) {
          console.log('Clearing stale tracking data');
          await clearTrackingData();
        }
      } catch (error) {
        console.error('Error clearing stale data:', error);
        // If there's any error, clear the data to be safe
        await clearTrackingData();
      }
    };
    
    clearStaleData();
  }, []);

  const requestLocationPermission = async () => {
    await locationService.requestLocationPermission();
  };

  const resetTracking = async () => {
    try {
      await clearTrackingData();
      setTracking(false);
      setBackgroundTrackingActive(false);
      setRoute([]);
      setStartLoc(null);
      setEndLoc(null);
      setStartTime(null);
      console.log('Tracking reset successfully');
    } catch (error) {
      console.error('Error resetting tracking:', error);
    }
  };

  const checkBackgroundTrackingStatus = async () => {
    try {
      const isActive = await isTrackingActive();
      console.log('Background tracking status check:', isActive);
      
      // TEMPORARILY DISABLE SESSION RESTORATION TO DEBUG
      if (isActive) {
        console.log('Found active tracking session, but skipping restoration for debugging');
        await clearTrackingData(); // Clear any existing data
        setBackgroundTrackingActive(false);
        setTracking(false);
        return;
      }
      
      setBackgroundTrackingActive(false);
      setTracking(false);
    } catch (error) {
      console.error('Error checking background tracking status:', error);
      // Reset to safe state
      setBackgroundTrackingActive(false);
      setTracking(false);
    }
  };

  // This effect manually moves the camera. It runs only when `currentLocation` changes
  // and we are NOT in tracking mode.
  useEffect(() => {
    if (currentLocation && cameraRef.current && !tracking) {
      cameraRef.current.setCamera({
        centerCoordinate: [currentLocation.longitude, currentLocation.latitude],
        zoomLevel: 15,
        animationMode: 'flyTo',
        animationDuration: 2000,
      });
    }
  }, [currentLocation]); // Dependency: only run when currentLocation changes

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      if (cameraRef.current) {
        cameraRef.current = null;
      }
    };
  }, []);

  const startTracking = async () => {
    if (!currentLocation) {
      Alert.alert('Could not get location', 'Please make sure location services are enabled and try again.');
      return;
    }

    setLoading(true);
    console.log('Starting tracking with location:', currentLocation);
    
    try {
      // Start background tracking with timeout
      const trackingPromise = startBackgroundTracking(currentLocation);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Background tracking timeout')), 10000)
      );
      
      const success = await Promise.race([trackingPromise, timeoutPromise]);
      console.log('Background tracking result:', success);
      
      if (success) {
        setTracking(true);
        setRoute([currentLocation]);
        setEndLoc(null);
        setStartTime(new Date());
        setStartLoc(currentLocation);
        setBackgroundTrackingActive(true);
        
        // Show a simple success message without alert dialog
        console.log('Background tracking started successfully');
      } else {
        console.log('Background tracking failed, starting foreground tracking instead');
        // Fallback to foreground tracking if background fails
        setTracking(true);
        setRoute([currentLocation]);
        setEndLoc(null);
        setStartTime(new Date());
        setStartLoc(currentLocation);
        setBackgroundTrackingActive(false);
        
        Alert.alert(
          'Background Tracking Unavailable', 
          'Background tracking is not available. Your ride will be tracked while the app is open.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error starting tracking:', error);
      Alert.alert('Error', 'Failed to start tracking. Please try again.');
    }
    
    setLoading(false);
  };

  const endTracking = async () => {
    setLoading(true);
    
    try {
      // Stop background tracking
      await stopBackgroundTracking();
      
      setTracking(false);
      setBackgroundTrackingActive(false);
      
      if (route.length === 0 || !startLoc) {
        Alert.alert("Tracking Error", "No route was recorded.");
        setLoading(false);
        return;
      }

      const endTimeNow = new Date();
      const endLocation = route[route.length - 1];
      setEndLoc(endLocation);

      const durationMs = endTimeNow.getTime() - startTime.getTime();
      const durationMinutes = Math.round(durationMs / (1000 * 60));
      
      const [startAddressName, endAddressName] = await Promise.all([
        getAddressFromCoords(startLoc.latitude, startLoc.longitude),
        getAddressFromCoords(endLocation.latitude, endLocation.longitude)
      ]);

      const distilled = distillRoute(route, 20);
      const distance = calculateRouteDistance(route);
      const governorate = await getGovernorateFromCoords(startLoc.latitude, startLoc.longitude);

      const tripData = {
        from: { lat: startLoc.latitude, lng: startLoc.longitude, name: startAddressName },
        to: { lat: endLocation.latitude, lng: endLocation.longitude, name: endAddressName },
        fare: null,
        start_time: startTime.toISOString(),
        end_time: endTimeNow.toISOString(),
        created_at: new Date().toISOString(),
        duration: durationMinutes,
        passenger_count: passengers ? Number(passengers) : 1,
        governorate,
        route: distilled,
        distance,
      };

      setLoading(false);
      router.push({
        pathname: '/(other)/FareResults',
        params: {
          from: startAddressName,
          to: endAddressName,
          time: startTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          duration: durationMinutes.toString(),
          passengers: passengers || '1',
          estimate: '38',
          distance: distance.toFixed(2),
          governorate,
          mode: 'track',
          tripData: JSON.stringify(tripData)
        }
      });
    } catch (err) {
      setLoading(false);
      console.log("Error processing trip:", err);
      Alert.alert('Error', 'An error occurred while processing the trip.');
    }
  };

  const handleLocationUpdate = (location) => {
    if (location && location.coords) {
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      // Update the current location state. This will trigger the useEffect for the camera.
      setCurrentLocation(newLocation);

      // If tracking is active, add the new point to our route
      if (tracking) {
        setRoute((prevRoute) => [...prevRoute, newLocation]);
      }
    }
  };

  return (
    <View style={styles.container}>
      <MapboxGL.MapView key="trackRide" style={styles.map}>
        {/* The Camera is now completely separate and manually controlled */}
        <MapboxGL.Camera ref={cameraRef} />
        
        <MapboxGL.UserLocation 
          visible={true}
          showsUserHeadingIndicator={true}
          onUpdate={handleLocationUpdate}
          minDisplacement={5}
        />

        {/* --- The rest of your map components are fine --- */}
        {route.length > 0 && route.every(p => p && typeof p.longitude === 'number' && typeof p.latitude === 'number') && (
          <MapboxGL.ShapeSource id="trackRideRouteSource" shape={{
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: route.map(p => [p.longitude, p.latitude]),
            },
          }}>
            <MapboxGL.LineLayer id="trackRideRouteLine" style={{ lineColor: '#d32f2f', lineWidth: 4 }} />
          </MapboxGL.ShapeSource>
        )}
        {startLoc && typeof startLoc.longitude === 'number' && typeof startLoc.latitude === 'number' && (
          <MapboxGL.PointAnnotation id="trackRideStart" coordinate={[startLoc.longitude, startLoc.latitude]}>
            <View style={styles.markerGreen} />
          </MapboxGL.PointAnnotation>
        )}
        {endLoc && typeof endLoc.longitude === 'number' && typeof endLoc.latitude === 'number' && (
          <MapboxGL.PointAnnotation id="trackRideEnd" coordinate={[endLoc.longitude, endLoc.latitude]}>
            <View style={styles.markerRed} />
          </MapboxGL.PointAnnotation>
        )}
      </MapboxGL.MapView>

      <View style={styles.bottomPanel}>
        <Text style={styles.title}>ابدأ تتبع رحلتك</Text>
        
        {/* Location Status */}
        {locationStatus === 'requesting' && (
          <View style={styles.locationStatus}>
            <ActivityIndicator size="small" color="#d32f2f" />
            <Text style={styles.locationStatusText}>جاري طلب إذن الموقع الدقيق...</Text>
          </View>
        )}
        
        {locationStatus === 'denied' && (
          <View style={[styles.locationStatus, { backgroundColor: '#ffebee' }]}>
            <Text style={[styles.locationStatusText, { color: '#c62828' }]}>❌ الموقع الدقيق مطلوب</Text>
            <TouchableOpacity 
              style={styles.retryButton} 
              onPress={requestLocationPermission}
            >
              <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {locationStatus === 'granted' && currentLocation && (
          <View style={[styles.locationStatus, { backgroundColor: '#e8f5e8' }]}>
            <Text style={[styles.locationStatusText, { color: '#2e7d32' }]}>✅ الموقع الدقيق متاح</Text>
            <Text style={styles.locationCoords}>
              {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
            </Text>
          </View>
        )}
        
        {backgroundTrackingActive && (
          <View style={styles.backgroundStatus}>
            <Text style={styles.backgroundStatusText}>🔄 التتبع يعمل في الخلفية</Text>
            <Text style={styles.backgroundStatusSubtext}>يمكنك تصغير التطبيق والاستمرار في التتبع</Text>
          </View>
        )}
        
        <TextInput
          style={styles.input}
          placeholder="عدد الركاب (اختياري)"
          keyboardType="numeric"
          value={passengers}
          onChangeText={setPassengers}
        />
        
        {!tracking ? (
          <TouchableOpacity 
            style={styles.button} 
            onPress={startTracking} 
            disabled={!currentLocation || loading || locationStatus !== 'granted'}
          >
            <Text style={styles.buttonText}>
              {loading ? 'جاري البدء...' : 'ابدأ التتبع'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: '#222' }]} 
            onPress={endTracking}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'جاري الإنهاء...' : 'انهاء التتبع'}
            </Text>
          </TouchableOpacity>
        )}
        
        {loading && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#d32f2f" />
            <Text style={styles.loaderText}>جاري المعالجة...</Text>
          </View>
        )}
        
        {/* Debug reset button - remove in production */}
        <TouchableOpacity 
          style={[styles.button, { backgroundColor: '#666', marginTop: 10 }]} 
          onPress={resetTracking}
        >
          <Text style={styles.buttonText}>Reset Tracking (Debug)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}


// --- Styles are fine, no changes needed ---
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
        textAlign: 'right'
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
    markerGreen: {
        backgroundColor: 'green',
        borderRadius: 10,
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: '#fff'
    },
    markerRed: {
        backgroundColor: 'red',
        borderRadius: 10,
        width: 20,
        height: 20,
        borderWidth: 2,
        borderColor: '#fff'
    },
    loaderContainer: {
        alignItems: 'center',
        marginVertical: 10
    },
    loaderText: {
        color: '#d32f2f',
        marginTop: 8
    },
    backgroundStatus: {
        backgroundColor: '#e8f5e8',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#4caf50',
    },
    backgroundStatusText: {
        color: '#2e7d32',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 4,
    },
    backgroundStatusSubtext: {
        color: '#388e3c',
        fontSize: 14,
        textAlign: 'center',
    },
    locationStatus: {
        backgroundColor: '#fff3e0',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#ff9800',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    locationStatusText: {
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        marginLeft: 8,
    },
    locationCoords: {
        fontSize: 12,
        color: '#666',
        textAlign: 'center',
        marginTop: 4,
    },
    retryButton: {
        backgroundColor: '#d32f2f',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginLeft: 12,
    },
    retryButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    }
});