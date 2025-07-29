import React, { useState, useEffect, useCallback, useRef, use } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Dimensions } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
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
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function TrackRide() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [isTracking, setIsTracking] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [route, setRoute] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [passengers, setPassengers] = useState('');
  const [backgroundPermissionGranted, setBackgroundPermissionGranted] = useState(false);
  
  // Check background permission status
  const checkBackgroundPermission = async () => {
    const { status } = await Location.getBackgroundPermissionsAsync();
    setBackgroundPermissionGranted(status === 'granted');
    return status === 'granted';
  };
  
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
        setHasStarted(isActive);
        if (isActive) {
          loadRouteFromStorage();
        }
      };
      
      // Check background permission status when screen loads
      checkBackgroundPermission();
      checkTrackingStatus();

      // Set up a listener to update the route on the map in real-time
      const interval = setInterval(async () => {
        const isActive = await isTrackingActive();
        if (isActive) {
          loadRouteFromStorage();
        }
      }, 2000);

      return () => clearInterval(interval);
    }, [])
  );
  // This effect handles the case where the user taps the "stop tracking" notification
  useEffect(() => {
    if (params.finalize_trip === 'true') {
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

    // Check background permission status
    const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
    
    if (backgroundStatus !== 'granted') {
      // Show informative alert about background permissions
      Alert.alert(
        'Background Location Required',
        'To track your ride even when the app is closed, background location access is required. This allows the app to continue tracking your location in the background.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Enable',
            onPress: async () => {
              // Request background permission
              const { status: newBackgroundStatus } = await Location.requestBackgroundPermissionsAsync();
              if (newBackgroundStatus === 'granted') {
                console.log('Background permission granted');
                // Continue with tracking after permission is granted
                await continueWithTracking(location);
              } else {
                Alert.alert(
                  'Permission Denied',
                  'Background location access is required to track your ride. Please enable it in your device settings.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => Location.openSettings() }
                  ]
                );
              }
            },
          },
        ]
      );
      return;
    }
    
    console.log('Background permission granted');
    await continueWithTracking(location);
  };

  const continueWithTracking = async (location) => {
    
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
      setHasStarted(true);
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
        setHasStarted(false);
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
      setHasStarted(false);
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
    // Always center on current location if available, otherwise default to Cairo
    if (currentLocation) {
      return [currentLocation.longitude, currentLocation.latitude];
    }
    return [31.2357, 30.0444]; // Default to Cairo
  };

  const getDistanceText = () => {
    if (route.length < 2) return "0 كم";
    const distance = calculateRouteDistance(route);
    return `${distance.toFixed(1)} كم`;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-forward" size={20} style = {styles.backButtonIcon}/>
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText}>تتبع الرحلة</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Map Area */}
      {isTracking && (
        <MapboxGL.MapView
        style={styles.map}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
          <MapboxGL.Camera
            followUserLocation={true}
            followUserMode='normal'
            followZoomLevel={16} // Use this prop for zoom level when following
          />
          
          {/* User Location */}
          <MapboxGL.UserLocation 
            visible={true}
            showsUserHeadingIndicator={true}
            onUpdate={(location) => setCurrentLocation(location.coords)}
          />

          {/* Route Line */}
          {route.length > 1 && (
            <MapboxGL.ShapeSource id="routeSource" shape={{
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: route.map(p => [p.longitude, p.latitude]) },
            }}>
              <MapboxGL.LineLayer id="routeLine" style={{ lineColor: '#5C2633', lineWidth: 4 }} />
            </MapboxGL.ShapeSource>
          )}

          {/* Start Location Pin */}
          {hasStarted && route.length > 0 && (
            <MapboxGL.PointAnnotation
              id="startPoint"
              coordinate={[route[0].longitude, route[0].latitude]}
            >
              <View style={styles.startPin}>
                <Text style={styles.startPinText}>📍</Text>
              </View>
            </MapboxGL.PointAnnotation>
            )}
          </MapboxGL.MapView>
      )}

      {/* Bottom Control Modal */}
      <View style={styles.bottomModal}>
        <View style={styles.bottomCard}>
          <View style={styles.bottomContent}>
            {!hasStarted ? (
              // It should be centered and all elements should extend to their full width
              <View style = {styles.startContainer}>
                <Text style={styles.startTitle}>ابدأ تتبع رحلتك</Text>
                <Text style={styles.startSubtitle}>اضغط على "بدء التتبع" لتسجيل رحلتك</Text>
                
                {/* Background Permission Status */}
                {!backgroundPermissionGranted && (
                  <View style={styles.permissionWarning}>
                    <Text style={styles.permissionWarningText}>
                      ⚠️ Background location access is required for ride tracking
                    </Text>
                  </View>
                )}
                
                <TextInput
                  style={styles.passengerInput}
                  placeholder="عدد الركاب (اختياري)"
                  placeholderTextColor="#666666"
                  keyboardType="numeric"
                  value={passengers}
                  onChangeText={setPassengers}
                />
                
                <TouchableOpacity 
                  style={[
                    styles.startButton, 
                    !backgroundPermissionGranted && styles.startButtonDisabled
                  ]} 
                  onPress={startTracking}
                  disabled={!backgroundPermissionGranted}
                >
                  <Text style={styles.startButtonIcon}>▶️</Text>
                  <Text style={styles.startButtonText}>بدء التتبع</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ width: '100%', alignItems: 'center' }}>
                <View style={styles.trackingStatus}>
                  <Text style={styles.trackingTitle}>
                    {isTracking ? "جاري التتبع..." : "تم إيقاف التتبع"}
                  </Text>
                  <Text style={styles.trackingDistance}>المسافة المقطوعة: {getDistanceText()}</Text>
                </View>

                {isTracking ? (
                  <TouchableOpacity style={styles.stopButton} onPress={endTracking}>
                    <Text style={styles.stopButtonIcon}>⏹️</Text>
                    <Text style={styles.stopButtonText}>إنهاء الرحلة</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.resumeButton} onPress={startTracking}>
                    <Text style={styles.resumeButtonIcon}>▶️</Text>
                    <Text style={styles.resumeButtonText}>استئناف التتبع</Text>
                  </TouchableOpacity>
                )}
                
                {loading && <ActivityIndicator size="large" color="#5C2633" style={styles.loading} />}
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonIcon: {
    transform: [{ rotate: '180deg' }],
    color: '#5C2633',
  },
  headerTitle: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  headerSpacer: {
    width: 40,
  },
  map: {
    flex: 1,
  },
  locationIndicator: {
    position: 'absolute',
    top: 120,
    right: 16,
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  locationSubtitle: {
    fontSize: 12,
    color: '#666666',
  },
  startPin: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  startPinText: {
    fontSize: 24,
  },
  bottomModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
  },
  bottomCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  bottomContent: {
    padding: 24,
    alignItems: 'center',
    width: '100%',
  },
  startTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
    width: '100%',
  },
  startSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 20,
    textAlign: 'center',
    width: '100%',
  },
  passengerInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 16,
    color: '#1a1a1a',
    textAlign: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  startButton: {
    backgroundColor: '#5C2633',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  startButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  startButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  trackingStatus: {
    marginBottom: 20,
    alignItems: 'center',
    width: '100%',
  },
  trackingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#5C2633',
    marginBottom: 4,
  },
  trackingDistance: {
    fontSize: 14,
    color: '#666666',
  },
  stopButton: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  stopButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  stopButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resumeButton: {
    backgroundColor: '#5C2633',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  resumeButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  resumeButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loading: {
    marginTop: 16,
  },
  permissionWarning: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    alignSelf: 'stretch',
  },
  permissionWarningText: {
    fontSize: 14,
    color: '#92400e',
    textAlign: 'center',
    fontWeight: '500',
  },
  startButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  startContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
});
