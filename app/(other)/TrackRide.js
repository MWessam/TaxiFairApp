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
  const [isMockMode, setIsMockMode] = useState(false);
  const [mockInterval, setMockInterval] = useState(null);
  const [locationSubscription, setLocationSubscription] = useState(null);
  const [foregroundTracking, setForegroundTracking] = useState(false);
  
  // Check background permission status
  const checkBackgroundPermission = async () => {
    const { status } = await Location.getBackgroundPermissionsAsync();
    setBackgroundPermissionGranted(status === 'granted');
    return status === 'granted';
  };

  // Request background location permission
  const requestBackgroundPermission = async () => {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      console.log('Background permission request result:', status);
      setBackgroundPermissionGranted(status === 'granted');
      
      if (status === 'granted') {
        Alert.alert(
          'تم منح الإذن',
          'تم منح إذن الموقع في الخلفية بنجاح. يمكنك الآن تتبع رحلتك.',
          [{ text: 'حسناً', style: 'default' }]
        );
      } else {
        Alert.alert(
          'إذن مطلوب',
          'يجب منح إذن الموقع في الخلفية لتتبع رحلتك. يرجى تفعيله في إعدادات الجهاز.',
          [
            { text: 'إلغاء', style: 'cancel' },
            { text: 'فتح الإعدادات', onPress: () => Location.openSettings() }
          ]
        );
      }
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting background permission:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء طلب إذن الموقع في الخلفية.');
      return false;
    }
  };

  // Start foreground location tracking as fallback
  const startForegroundTracking = async (startLocation) => {
    try {
      console.log('Starting foreground location tracking');
      
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000, // Update every 3 seconds
          distanceInterval: 5, // Update every 5 meters
        },
        (location) => {
          const newLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
          };
          
          setCurrentLocation(newLocation);
          setRoute(prevRoute => {
            const newRoute = [...prevRoute, newLocation];
            console.log('Foreground tracking: Added location point', newLocation);
            console.log('Total route points:', newRoute.length);
            
            // Save to storage every 5 points
            if (newRoute.length % 5 === 0) {
              saveRouteToStorage(newRoute);
            }
            
            return newRoute;
          });
        }
      );
      
      setLocationSubscription(subscription);
      setForegroundTracking(true);
      console.log('Foreground tracking started');
      
      return true;
    } catch (error) {
      console.error('Failed to start foreground tracking:', error);
      return false;
    }
  };

  // Stop foreground tracking
  const stopForegroundTracking = async () => {
    if (locationSubscription) {
      await locationSubscription.remove();
      setLocationSubscription(null);
      setForegroundTracking(false);
      console.log('Foreground tracking stopped');
    }
  };

  // Save route to storage for background tracking compatibility
  const saveRouteToStorage = async (currentRoute) => {
    try {
      const trackingData = await getCurrentTrackingData();
      if (trackingData && trackingData.isTracking) {
        trackingData.route = currentRoute;
        await AsyncStorage.setItem('tracking_data', JSON.stringify(trackingData));
        console.log('Saved route to storage with', currentRoute.length, 'points');
      }
    } catch (error) {
      console.error('Failed to save route to storage:', error);
    }
  };

  // Mock route from Mansoura to Talkha
  const mockRoute = [
    { latitude: 31.0364, longitude: 31.3807 }, // Mansoura center
    { latitude: 31.0380, longitude: 31.3820 },
    { latitude: 31.0400, longitude: 31.3840 },
    { latitude: 31.0420, longitude: 31.3860 },
    { latitude: 31.0440, longitude: 31.3880 },
    { latitude: 31.0460, longitude: 31.3900 },
    { latitude: 31.0480, longitude: 31.3920 },
    { latitude: 31.0500, longitude: 31.3940 },
    { latitude: 31.0520, longitude: 31.3960 },
    { latitude: 31.0540, longitude: 31.3980 },
    { latitude: 31.0560, longitude: 31.4000 },
    { latitude: 31.0580, longitude: 31.4020 },
    { latitude: 31.0600, longitude: 31.4040 },
    { latitude: 31.0620, longitude: 31.4060 },
    { latitude: 31.0640, longitude: 31.4080 },
    { latitude: 31.0660, longitude: 31.4100 },
    { latitude: 31.0680, longitude: 31.4120 },
    { latitude: 31.0700, longitude: 31.4140 },
    { latitude: 31.0720, longitude: 31.4160 },
    { latitude: 31.0740, longitude: 31.4180 },
    { latitude: 31.0760, longitude: 31.4200 },
    { latitude: 31.0780, longitude: 31.4220 },
    { latitude: 31.0800, longitude: 31.4240 },
    { latitude: 31.0820, longitude: 31.4260 },
    { latitude: 31.0840, longitude: 31.4280 },
    { latitude: 31.0860, longitude: 31.4300 },
    { latitude: 31.0880, longitude: 31.4320 },
    { latitude: 31.0900, longitude: 31.4340 },
    { latitude: 31.0920, longitude: 31.4360 },
    { latitude: 31.0940, longitude: 31.4380 },
    { latitude: 31.0960, longitude: 31.4400 },
    { latitude: 31.0980, longitude: 31.4420 },
    { latitude: 31.1000, longitude: 31.4440 },
    { latitude: 31.1020, longitude: 31.4460 },
    { latitude: 31.1040, longitude: 31.4480 },
    { latitude: 31.1060, longitude: 31.4500 },
    { latitude: 31.1080, longitude: 31.4520 },
    { latitude: 31.1100, longitude: 31.4540 },
    { latitude: 31.1120, longitude: 31.4560 },
    { latitude: 31.1140, longitude: 31.4580 },
    { latitude: 31.1160, longitude: 31.4600 },
    { latitude: 31.1180, longitude: 31.4620 },
    { latitude: 31.1200, longitude: 31.4640 },
    { latitude: 31.1220, longitude: 31.4660 },
    { latitude: 31.1240, longitude: 31.4680 },
    { latitude: 31.1260, longitude: 31.4700 },
    { latitude: 31.1280, longitude: 31.4720 },
    { latitude: 31.1300, longitude: 31.4740 },
    { latitude: 31.1320, longitude: 31.4760 },
    { latitude: 31.1340, longitude: 31.4780 },
    { latitude: 31.1360, longitude: 31.4800 },
    { latitude: 31.1380, longitude: 31.4820 },
    { latitude: 31.1400, longitude: 31.4840 },
    { latitude: 31.1420, longitude: 31.4860 },
    { latitude: 31.1440, longitude: 31.4880 },
    { latitude: 31.1460, longitude: 31.4900 },
    { latitude: 31.1480, longitude: 31.4920 },
    { latitude: 31.1500, longitude: 31.4940 },
    { latitude: 31.1520, longitude: 31.4960 },
    { latitude: 31.1540, longitude: 31.4980 },
    { latitude: 31.1560, longitude: 31.5000 },
    { latitude: 31.1580, longitude: 31.5020 },
    { latitude: 31.1600, longitude: 31.5040 },
    { latitude: 31.1620, longitude: 31.5060 },
    { latitude: 31.1640, longitude: 31.5080 },
    { latitude: 31.1660, longitude: 31.5100 },
    { latitude: 31.1680, longitude: 31.5120 },
    { latitude: 31.1700, longitude: 31.5140 },
    { latitude: 31.1720, longitude: 31.5160 },
    { latitude: 31.1740, longitude: 31.5180 },
    { latitude: 31.1760, longitude: 31.5200 },
    { latitude: 31.1780, longitude: 31.5220 },
    { latitude: 31.1800, longitude: 31.5240 },
    { latitude: 31.1820, longitude: 31.5260 },
    { latitude: 31.1840, longitude: 31.5280 },
    { latitude: 31.1860, longitude: 31.5300 },
    { latitude: 31.1880, longitude: 31.5320 },
    { latitude: 31.1900, longitude: 31.5340 },
    { latitude: 31.1920, longitude: 31.5360 },
    { latitude: 31.1940, longitude: 31.5380 },
    { latitude: 31.1960, longitude: 31.5400 },
    { latitude: 31.1980, longitude: 31.5420 },
    { latitude: 31.2000, longitude: 31.5440 },
    { latitude: 31.2020, longitude: 31.5460 },
    { latitude: 31.2040, longitude: 31.5480 },
    { latitude: 31.2060, longitude: 31.5500 },
    { latitude: 31.2080, longitude: 31.5520 },
    { latitude: 31.2100, longitude: 31.5540 },
    { latitude: 31.2120, longitude: 31.5560 },
    { latitude: 31.2140, longitude: 31.5580 },
    { latitude: 31.2160, longitude: 31.5600 },
    { latitude: 31.2180, longitude: 31.5620 },
    { latitude: 31.2200, longitude: 31.5640 },
    { latitude: 31.2220, longitude: 31.5660 },
    { latitude: 31.2240, longitude: 31.5680 },
    { latitude: 31.2260, longitude: 31.5700 },
    { latitude: 31.2280, longitude: 31.5720 },
    { latitude: 31.2300, longitude: 31.5740 },
    { latitude: 31.2320, longitude: 31.5760 },
    { latitude: 31.2340, longitude: 31.5780 },
    { latitude: 31.2360, longitude: 31.5800 },
    { latitude: 31.2380, longitude: 31.5820 },
    { latitude: 31.2400, longitude: 31.5840 },
    { latitude: 31.2420, longitude: 31.5860 },
    { latitude: 31.2440, longitude: 31.5880 },
    { latitude: 31.2460, longitude: 31.5900 },
    { latitude: 31.2480, longitude: 31.5920 },
    { latitude: 31.2500, longitude: 31.5940 },
    { latitude: 31.2520, longitude: 31.5960 },
    { latitude: 31.2540, longitude: 31.5980 },
    { latitude: 31.2560, longitude: 31.6000 },
    { latitude: 31.2580, longitude: 31.6020 },
    { latitude: 31.2600, longitude: 31.6040 },
    { latitude: 31.2620, longitude: 31.6060 },
    { latitude: 31.2640, longitude: 31.6080 },
    { latitude: 31.2660, longitude: 31.6100 },
    { latitude: 31.2680, longitude: 31.6120 },
    { latitude: 31.2700, longitude: 31.6140 },
    { latitude: 31.2720, longitude: 31.6160 },
    { latitude: 31.2740, longitude: 31.6180 },
    { latitude: 31.2760, longitude: 31.6200 },
    { latitude: 31.2780, longitude: 31.6220 },
    { latitude: 31.2800, longitude: 31.6240 },
    { latitude: 31.2820, longitude: 31.6260 },
    { latitude: 31.2840, longitude: 31.6280 },
    { latitude: 31.2860, longitude: 31.6300 },
    { latitude: 31.2880, longitude: 31.6320 },
    { latitude: 31.2900, longitude: 31.6340 },
    { latitude: 31.2920, longitude: 31.6360 },
    { latitude: 31.2940, longitude: 31.6380 },
    { latitude: 31.2960, longitude: 31.6400 },
    { latitude: 31.2980, longitude: 31.6420 },
    { latitude: 31.3000, longitude: 31.6440 },
    { latitude: 31.3020, longitude: 31.6460 },
    { latitude: 31.3040, longitude: 31.6480 },
    { latitude: 31.3060, longitude: 31.6500 },
    { latitude: 31.3080, longitude: 31.6520 },
    { latitude: 31.3100, longitude: 31.6540 },
    { latitude: 31.3120, longitude: 31.6560 },
    { latitude: 31.3140, longitude: 31.6580 },
    { latitude: 31.3160, longitude: 31.6600 },
    { latitude: 31.3180, longitude: 31.6620 },
    { latitude: 31.3200, longitude: 31.6640 },
    { latitude: 31.3220, longitude: 31.6660 },
    { latitude: 31.3240, longitude: 31.6680 },
    { latitude: 31.3260, longitude: 31.6700 },
    { latitude: 31.3280, longitude: 31.6720 },
    { latitude: 31.3300, longitude: 31.6740 },
    { latitude: 31.3320, longitude: 31.6760 },
    { latitude: 31.3340, longitude: 31.6780 },
    { latitude: 31.3360, longitude: 31.6800 },
    { latitude: 31.3380, longitude: 31.6820 },
    { latitude: 31.3400, longitude: 31.6840 },
    { latitude: 31.3420, longitude: 31.6860 },
    { latitude: 31.3440, longitude: 31.6880 },
    { latitude: 31.3460, longitude: 31.6900 },
    { latitude: 31.3480, longitude: 31.6920 },
    { latitude: 31.3500, longitude: 31.6940 },
    { latitude: 31.3520, longitude: 31.6960 },
    { latitude: 31.3540, longitude: 31.6980 },
    { latitude: 31.3560, longitude: 31.7000 },
    { latitude: 31.3580, longitude: 31.7020 },
    { latitude: 31.3600, longitude: 31.7040 },
    { latitude: 31.3620, longitude: 31.7060 },
    { latitude: 31.3640, longitude: 31.7080 },
    { latitude: 31.3660, longitude: 31.7100 },
    { latitude: 31.3680, longitude: 31.7120 },
    { latitude: 31.3700, longitude: 31.7140 },
    { latitude: 31.3720, longitude: 31.7160 },
    { latitude: 31.3740, longitude: 31.7180 },
    { latitude: 31.3760, longitude: 31.7200 },
    { latitude: 31.3780, longitude: 31.7220 },
    { latitude: 31.3800, longitude: 31.7240 },
    { latitude: 31.3820, longitude: 31.7260 },
    { latitude: 31.3840, longitude: 31.7280 },
    { latitude: 31.3860, longitude: 31.7300 },
    { latitude: 31.3880, longitude: 31.7320 },
    { latitude: 31.3900, longitude: 31.7340 },
    { latitude: 31.3920, longitude: 31.7360 },
    { latitude: 31.3940, longitude: 31.7380 },
    { latitude: 31.3960, longitude: 31.7400 },
    { latitude: 31.3980, longitude: 31.7420 },
    { latitude: 31.4000, longitude: 31.7440 },
    { latitude: 31.4020, longitude: 31.7460 },
    { latitude: 31.4040, longitude: 31.7480 },
    { latitude: 31.4060, longitude: 31.7500 },
    { latitude: 31.4080, longitude: 31.7520 },
    { latitude: 31.4100, longitude: 31.7540 },
    { latitude: 31.4120, longitude: 31.7560 },
    { latitude: 31.4140, longitude: 31.7580 },
    { latitude: 31.4160, longitude: 31.7600 },
    { latitude: 31.4180, longitude: 31.7620 },
    { latitude: 31.4200, longitude: 31.7640 },
    { latitude: 31.4220, longitude: 31.7660 },
    { latitude: 31.4240, longitude: 31.7680 },
    { latitude: 31.4260, longitude: 31.7700 },
    { latitude: 31.4280, longitude: 31.7720 },
    { latitude: 31.4300, longitude: 31.7740 },
    { latitude: 31.4320, longitude: 31.7760 },
    { latitude: 31.4340, longitude: 31.7780 },
    { latitude: 31.4360, longitude: 31.7800 },
    { latitude: 31.4380, longitude: 31.7820 },
    { latitude: 31.4400, longitude: 31.7840 },
    { latitude: 31.4420, longitude: 31.7860 },
    { latitude: 31.4440, longitude: 31.7880 },
    { latitude: 31.4460, longitude: 31.7900 },
    { latitude: 31.4480, longitude: 31.7920 },
    { latitude: 31.4500, longitude: 31.7940 },
    { latitude: 31.4520, longitude: 31.7960 },
    { latitude: 31.4540, longitude: 31.7980 },
    { latitude: 31.4560, longitude: 31.8000 },
    { latitude: 31.4580, longitude: 31.8020 },
    { latitude: 31.4600, longitude: 31.8040 },
    { latitude: 31.4620, longitude: 31.8060 },
    { latitude: 31.4640, longitude: 31.8080 },
    { latitude: 31.4660, longitude: 31.8100 },
    { latitude: 31.4680, longitude: 31.8120 },
    { latitude: 31.4700, longitude: 31.8140 },
    { latitude: 31.4720, longitude: 31.8160 },
    { latitude: 31.4740, longitude: 31.8180 },
    { latitude: 31.4760, longitude: 31.8200 },
    { latitude: 31.4780, longitude: 31.8220 },
    { latitude: 31.4800, longitude: 31.8240 },
    { latitude: 31.4820, longitude: 31.8260 },
    { latitude: 31.4840, longitude: 31.8280 },
    { latitude: 31.4860, longitude: 31.8300 },
    { latitude: 31.4880, longitude: 31.8320 },
    { latitude: 31.4900, longitude: 31.8340 },
    { latitude: 31.4920, longitude: 31.8360 },
    { latitude: 31.4940, longitude: 31.8380 },
    { latitude: 31.4960, longitude: 31.8400 },
    { latitude: 31.4980, longitude: 31.8420 },
    { latitude: 31.5000, longitude: 31.8440 }, // Talkha center
  ];

  // Mock tracking functions
  const startMockTracking = async () => {
    console.log('Starting mock tracking');
    
    // First, get current location
    if (!locationService.isInitialized) {
      console.log('Location service not initialized, initializing now...');
      await locationService.initialize();
    }
    
    const location = await locationService.requestLocationPermission();
    if (!location) {
      console.log('Location permission denied or failed');
      Alert.alert('Permission Required', 'Please enable location permissions to start mock tracking.');
      return;
    }
    
    console.log('Current location for mock tracking:', location);
    
    // Generate mock route from current location to Talkha
    const startLat = location.latitude;
    const startLng = location.longitude;
    const endLat = 31.5000; // Talkha
    const endLng = 31.8440; // Talkha
    
    // Create a route with 100 points from current location to Talkha
    const mockRouteFromCurrent = [];
    const totalPoints = 100;
    
    for (let i = 0; i <= totalPoints; i++) {
      const progress = i / totalPoints;
      const lat = startLat + (endLat - startLat) * progress;
      const lng = startLng + (endLng - startLng) * progress;
      mockRouteFromCurrent.push({ latitude: lat, longitude: lng });
    }
    
    setIsMockMode(true);
    setIsTracking(true);
    setHasStarted(true);
    setRoute([]);
    
    // Clear any existing tracking data
    await clearTrackingData();
    
    // Start mock tracking with interval
    let currentIndex = 0;
    console.log('Starting mock tracking with route:', mockRouteFromCurrent.length, 'points');
    console.log('Start location:', mockRouteFromCurrent[0]);
    console.log('End location:', mockRouteFromCurrent[mockRouteFromCurrent.length - 1]);
    
    const interval = setInterval(() => {
      if (currentIndex < mockRouteFromCurrent.length) {
        const newRoute = mockRouteFromCurrent.slice(0, currentIndex + 1);
        setRoute(newRoute);
        setCurrentLocation(mockRouteFromCurrent[currentIndex]);
        console.log(`Mock tracking: point ${currentIndex + 1}/${mockRouteFromCurrent.length}`, mockRouteFromCurrent[currentIndex]);
        currentIndex++;
      } else {
        // Route completed
        console.log('Mock tracking completed');
        clearInterval(interval);
        setMockInterval(null);
      }
    }, 1000); // Update every second
    
    setMockInterval(interval);
  };

  const stopMockTracking = async () => {
    if (mockInterval) {
      clearInterval(mockInterval);
      setMockInterval(null);
    }
    setIsMockMode(false);
    setIsTracking(false);
    setHasStarted(false);
    setRoute([]);
    await clearTrackingData();
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
        if (isActive && !foregroundTracking) {
          // Only update from storage if we're not using foreground tracking
          loadRouteFromStorage();
        }
      }, 2000);

      return () => clearInterval(interval);
    }, [foregroundTracking])
  );
  // This effect handles the case where the user taps the "stop tracking" notification
  useEffect(() => {
    if (params.finalize_trip === 'true') {
      router.setParams({ finalize_trip: '' }); 
      endTracking();
    }
  }, [params.finalize_trip]);

  // Cleanup mock interval and location subscription on unmount
  useEffect(() => {
    return () => {
      if (mockInterval) {
        clearInterval(mockInterval);
      }
      if (locationSubscription) {
        locationSubscription.remove();
      }
    };
  }, [mockInterval, locationSubscription]);

  const startTracking = async () => {
    console.log('Starting tracking');
    
    // First, ensure location service is initialized
    if (!locationService.isInitialized) {
      console.log('Location service not initialized, initializing now...');
      await locationService.initialize();
    }
    
    // Check current location status
    const currentStatus = locationService.getLocationStatus();
    console.log('Current location status:', currentStatus);
    
    // Request location permission using the centralized service
    const location = await locationService.requestLocationPermission();
    if (!location) {
      console.log('Location permission denied or failed');
      Alert.alert('Permission Required', 'Please enable location permissions to track your ride.');
      return;
    }
    console.log('Location permission granted, location:', location);

    // Check background permission status
    const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
    console.log('Background permission status:', backgroundStatus);
    
    if (backgroundStatus !== 'granted') {
      // Show informative alert about background permissions
      Alert.alert(
        'إذن الموقع في الخلفية مطلوب',
        'لتتبع رحلتك حتى عندما تكون التطبيق مغلق، يلزم إذن الموقع في الخلفية. هذا يسمح للتطبيق بمواصلة تتبع موقعك في الخلفية.',
        [
          {
            text: 'إلغاء',
            style: 'cancel',
          },
          {
            text: 'تفعيل',
            onPress: async () => {
              // Request background permission
              const { status: newBackgroundStatus } = await Location.requestBackgroundPermissionsAsync();
              console.log('New background permission status:', newBackgroundStatus);
              if (newBackgroundStatus === 'granted') {
                console.log('Background permission granted');
                // Continue with tracking after permission is granted
                await continueWithTracking(location);
              } else {
                Alert.alert(
                  'تم رفض الإذن',
                  'يجب منح إذن الموقع في الخلفية لتتبع رحلتك. يرجى تفعيله في إعدادات الجهاز.',
                  [
                    { text: 'إلغاء', style: 'cancel' },
                    { text: 'فتح الإعدادات', onPress: () => Location.openSettings() }
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
    setRoute([location]); // Initialize route with starting location
    setCurrentLocation(location);
    console.log('Set route with initial location:', location);
    
    // Start background tracking with current location
    const success = await startBackgroundTracking(location);
    if (success) {
      console.log('Started background location tracking');
      setIsTracking(true);
      setHasStarted(true);
      console.log('Set isTracking to true');
      
      // Also start foreground tracking as backup
      await startForegroundTracking(location);
    } else {
      console.log('Failed to start background tracking, using foreground only');
      // Fallback to foreground tracking only
      const foregroundSuccess = await startForegroundTracking(location);
      if (foregroundSuccess) {
        setIsTracking(true);
        setHasStarted(true);
        console.log('Started foreground tracking as fallback');
      } else {
        Alert.alert('Error', 'Failed to start location tracking. Please try again.');
      }
    }
  };

  const endTracking = async () => {
    setLoading(true);
    
    try {
      // Stop foreground tracking first
      await stopForegroundTracking();
      
      // Handle mock mode differently
      if (isMockMode) {
        await stopMockTracking();
        
        if (route.length < 2) {
          Alert.alert("Error", "Not enough location points were recorded for a trip.");
          setLoading(false);
          return;
        }

        const finalRoute = route;
        const startTime = new Date(Date.now() - (route.length * 1000)); // Mock start time
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
        return;
      }

      // Stop background tracking
      await stopBackgroundTracking();
      
      // Use current route state if available, otherwise get from storage
      let finalRoute = route;
      let startTime = new Date();
      
      if (route.length < 2) {
        // Try to get data from storage as fallback
        const trackingData = await getCurrentTrackingData();
        if (trackingData && trackingData.route && trackingData.route.length >= 2) {
          finalRoute = trackingData.route;
          startTime = new Date(trackingData.startTime);
        } else {
          Alert.alert("Error", "Not enough location points were recorded for a trip.");
          setLoading(false);
          await clearTrackingData();
          setIsTracking(false);
          setHasStarted(false);
          setRoute([]);
          return;
        }
      } else {
        // Use current route state
        startTime = new Date(Date.now() - (route.length * 3000)); // Approximate start time based on 3-second intervals
      }

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationMinutes = Math.round(durationMs / 60000);

      const startLoc = finalRoute[0];
      const endLoc = finalRoute[finalRoute.length - 1];

      console.log('Processing trip with route points:', finalRoute.length);
      console.log('Start location:', startLoc);
      console.log('End location:', endLoc);

      const [startAddressName, endAddressName, governorate] = await Promise.all([
        getAddressFromCoords(startLoc.latitude, startLoc.longitude),
        getAddressFromCoords(endLoc.latitude, endLoc.longitude),
        getGovernorateFromCoords(startLoc.latitude, startLoc.longitude)
      ]);
      
      const distance = calculateRouteDistance(finalRoute);
      const distilled = distillRoute(finalRoute, 20);

      console.log('Calculated distance:', distance, 'km');
      console.log('Duration:', durationMinutes, 'minutes');

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

  // Debug function to add a test location point
  const addTestLocation = () => {
    if (currentLocation && isTracking) {
      const testLocation = {
        latitude: currentLocation.latitude + (Math.random() - 0.5) * 0.001,
        longitude: currentLocation.longitude + (Math.random() - 0.5) * 0.001,
        timestamp: Date.now(),
      };
      
      setRoute(prevRoute => {
        const newRoute = [...prevRoute, testLocation];
        console.log('Added test location point:', testLocation);
        console.log('Total route points:', newRoute.length);
        return newRoute;
      });
    }
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
            followUserLocation={isTracking}
            followUserMode='normal'
            followZoomLevel={16}
            centerCoordinate={currentLocation ? [currentLocation.longitude, currentLocation.latitude] : [31.2357, 30.0444]}
          />
          
          {/* User Location */}
          <MapboxGL.UserLocation 
            visible={true}
            showsUserHeadingIndicator={true}
            onUpdate={(location) => {
              // Only update if we're not already tracking
              if (!isTracking) {
                setCurrentLocation(location.coords);
              }
            }}
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
          
          {/* Debug: Show route info */}
          {route.length > 0 && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>Route points: {route.length}</Text>
              <Text style={styles.debugText}>Distance: {getDistanceText()}</Text>
              <Text style={styles.debugText}>Current: {currentLocation ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}` : 'None'}</Text>
            </View>
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
                      ⚠️ يلزم إذن الموقع في الخلفية لتتبع الرحلة
                    </Text>
                    <TouchableOpacity 
                      style={styles.permissionButton}
                      onPress={requestBackgroundPermission}
                    >
                      <Text style={styles.permissionButtonText}>منح الإذن</Text>
                    </TouchableOpacity>
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
                
                {/* Mock Tracking Button */}
                <TouchableOpacity 
                  style={styles.mockButton} 
                  onPress={startMockTracking}
                >
                  <Text style={styles.mockButtonIcon}>🧪</Text>
                  <Text style={styles.mockButtonText}>تجربة المسار الوهمي (من موقعك الحالي إلى طلخا)</Text>
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
                
                {/* Debug Info */}
                <View style={styles.debugContainer}>
                  <Text style={styles.debugText}>Tracking Mode: {foregroundTracking ? 'Foreground' : 'Background'}</Text>
                  <Text style={styles.debugText}>Route Points: {route.length}</Text>
                  <Text style={styles.debugText}>Current Location: {currentLocation ? 'Yes' : 'No'}</Text>
                </View>
                
                {/* Test Button */}
                <TouchableOpacity 
                  style={styles.testButton} 
                  onPress={addTestLocation}
                >
                  <Text style={styles.testButtonText}>Add Test Location Point</Text>
                </TouchableOpacity>
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
    marginBottom: 12,
  },
  permissionButton: {
    backgroundColor: '#5C2633',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
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
  mockButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginTop: 12,
  },
  mockButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  mockButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  debugInfo: {
    position: 'absolute',
    top: 120,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
  },
  debugText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  debugContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  testButton: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  testButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});
