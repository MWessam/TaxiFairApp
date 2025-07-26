import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

const BACKGROUND_LOCATION_TASK = 'background-location-task';
const TRACKING_DATA_KEY = 'tracking_data';

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Background location task
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }

  const { locations } = data;
  if (locations && locations.length > 0) {
    const location = locations[0];
    
    // Get current tracking data
    const trackingData = await getTrackingData();
    if (trackingData && trackingData.isTracking) {
      // Add new location to route
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
      };
      
      trackingData.route.push(newLocation);
      trackingData.lastLocation = newLocation;
      
      // Save updated tracking data
      await saveTrackingData(trackingData);
      
      // Update notification with current status
      await updateTrackingNotification(trackingData);
    }
  }
});

// Initialize background tracking
export async function initializeBackgroundTracking() {
  try {
    // Request permissions
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
    
    if (foregroundStatus !== 'granted' || backgroundStatus !== 'granted') {
      throw new Error('Location permissions not granted');
    }

    // Request notification permissions
    const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
    if (notificationStatus !== 'granted') {
      throw new Error('Notification permissions not granted');
    }

    return true;
  } catch (error) {
    console.error('Failed to initialize background tracking:', error);
    return false;
  }
}

// Start background tracking
export async function startBackgroundTracking(startLocation) {
  try {
    // Check if we already have the necessary permissions
    const { status: foregroundStatus } = await Location.getForegroundPermissionsAsync();
    const { status: backgroundStatus } = await Location.getBackgroundPermissionsAsync();
    const { status: notificationStatus } = await Notifications.getPermissionsAsync();
    
    // Only request permissions if we don't have them
    if (foregroundStatus !== 'granted') {
      const { status: newForegroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (newForegroundStatus !== 'granted') {
        throw new Error('Foreground location permission not granted');
      }
    }
    
    if (backgroundStatus !== 'granted') {
      const { status: newBackgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (newBackgroundStatus !== 'granted') {
        throw new Error('Background location permission not granted');
      }
    }
    
    if (notificationStatus !== 'granted') {
      const { status: newNotificationStatus } = await Notifications.requestPermissionsAsync();
      if (newNotificationStatus !== 'granted') {
        throw new Error('Notification permission not granted');
      }
    }

    // Create tracking data
    const trackingData = {
      isTracking: true,
      startTime: new Date().toISOString(),
      startLocation,
      route: [startLocation],
      lastLocation: startLocation,
      notificationId: null,
    };

    // Save tracking data
    await saveTrackingData(trackingData);

    // Start background location updates with high accuracy
    try {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000, // 5 seconds for more frequent updates
        distanceInterval: 5, // 5 meters for more precise tracking
        foregroundService: {
          notificationTitle: 'Taxi Tracking Active',
          notificationBody: 'Your ride is being tracked with precise location',
          notificationColor: '#d32f2f',
        },
        // Android specific
        activityType: Location.ActivityType.AutomotiveNavigation,
        showsBackgroundLocationIndicator: true,
      });
    } catch (locationError) {
      console.error('Failed to start location updates:', locationError);
      // If location updates fail, we'll still show the notification
      // but tracking will only work while app is in foreground
    }

    // Show initial notification
    await showTrackingNotification(trackingData);

    return true;
  } catch (error) {
    console.error('Failed to start background tracking:', error);
    return false;
  }
}

// Stop background tracking
export async function stopBackgroundTracking() {
  try {
    // Stop location updates
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    
    // Get final tracking data
    const trackingData = await getTrackingData();
    if (trackingData && trackingData.isTracking) {
      trackingData.isTracking = false;
      trackingData.endTime = new Date().toISOString();
      
      // Save final data
      await saveTrackingData(trackingData);
      
      // Cancel notification
      if (trackingData.notificationId) {
        await Notifications.dismissNotificationAsync(trackingData.notificationId);
      }
      
      // Show completion notification
      await showCompletionNotification(trackingData);
    }

    return true;
  } catch (error) {
    console.error('Failed to stop background tracking:', error);
    return false;
  }
}

// Show tracking notification
async function showTrackingNotification(trackingData) {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: '🚗 Taxi Tracking Active',
        body: 'Your ride is being tracked. Tap to stop tracking.',
        data: { action: 'stop_tracking' },
        sticky: true,
        autoDismiss: false,
      },
      trigger: null, // Show immediately and keep showing
    });

    // Update tracking data with notification ID
    trackingData.notificationId = notificationId;
    await saveTrackingData(trackingData);
  } catch (error) {
    console.error('Failed to show tracking notification:', error);
  }
}

// Update tracking notification
async function updateTrackingNotification(trackingData) {
  try {
    if (trackingData.notificationId) {
      const distance = calculateDistance(trackingData.route);
      const duration = calculateDuration(trackingData.startTime);
      
      await Notifications.scheduleNotificationAsync({
        identifier: trackingData.notificationId,
        content: {
          title: '🚗 Taxi Tracking Active',
          body: `Distance: ${distance.toFixed(1)}km | Duration: ${duration}min | Tap to stop`,
          data: { action: 'stop_tracking' },
          sticky: true,
          autoDismiss: false,
        },
        trigger: null,
      });
    }
  } catch (error) {
    console.error('Failed to update tracking notification:', error);
  }
}

// Show completion notification
async function showCompletionNotification(trackingData) {
  try {
    const distance = calculateDistance(trackingData.route);
    const duration = calculateDuration(trackingData.startTime);
    
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '✅ Trip Completed!',
        body: `Distance: ${distance.toFixed(1)}km | Duration: ${duration}min | Tap to view results`,
        data: { action: 'view_results' },
      },
      trigger: null,
    });
  } catch (error) {
    console.error('Failed to show completion notification:', error);
  }
}

// Handle notification response
export function setupNotificationHandler() {
  Notifications.addNotificationResponseReceivedListener(async (response) => {
    const { action } = response.notification.request.content.data;
    
    if (action === 'stop_tracking') {
      try {
        // Stop tracking and get the data
        await stopBackgroundTracking();
        
        // Get the tracking data for navigation
        const trackingData = await getCurrentTrackingData();
        if (trackingData && trackingData.route && trackingData.route.length > 0) {
          // Store the data for the app to use when it opens
          await AsyncStorage.setItem('PENDING_FARE_RESULTS', JSON.stringify(trackingData));
        }
      } catch (error) {
        console.error('Error stopping tracking from notification:', error);
      }
    } else if (action === 'view_results') {
      // Navigation will be handled by the app when it opens
      console.log('View results requested from notification');
    }
  });
}

// Storage helpers
async function saveTrackingData(data) {
  try {
    await AsyncStorage.setItem(TRACKING_DATA_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save tracking data:', error);
  }
}

async function getTrackingData() {
  try {
    const data = await AsyncStorage.getItem(TRACKING_DATA_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to get tracking data:', error);
    return null;
  }
}

// Utility functions
function calculateDistance(route) {
  if (route.length < 2) return 0;
  
  let totalDistance = 0;
  for (let i = 1; i < route.length; i++) {
    const prev = route[i - 1];
    const curr = route[i];
    totalDistance += haversineDistance(prev, curr);
  }
  
  return totalDistance / 1000; // Convert to kilometers
}

function calculateDuration(startTime) {
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now - start;
  return Math.round(diffMs / (1000 * 60)); // Convert to minutes
}

function haversineDistance(point1, point2) {
  const R = 6371000; // Earth's radius in meters
  const lat1 = point1.latitude * Math.PI / 180;
  const lat2 = point2.latitude * Math.PI / 180;
  const deltaLat = (point2.latitude - point1.latitude) * Math.PI / 180;
  const deltaLon = (point2.longitude - point1.longitude) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Check if tracking is active
export async function isTrackingActive() {
  const trackingData = await getTrackingData();
  return trackingData && trackingData.isTracking;
}

// Get current tracking data
export async function getCurrentTrackingData() {
  return await getTrackingData();
}

// Clear all tracking data
export async function clearTrackingData() {
  try {
    await AsyncStorage.removeItem(TRACKING_DATA_KEY);
    console.log('Tracking data cleared');
  } catch (error) {
    console.error('Failed to clear tracking data:', error);
  }
}

// Check for pending fare results from notification
export async function getPendingFareResults() {
  try {
    const pendingData = await AsyncStorage.getItem('PENDING_FARE_RESULTS');
    if (pendingData) {
      await AsyncStorage.removeItem('PENDING_FARE_RESULTS');
      return JSON.parse(pendingData);
    }
    return null;
  } catch (error) {
    console.error('Failed to get pending fare results:', error);
    return null;
  }
} 