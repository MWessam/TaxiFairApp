import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

class LocationService {
  constructor() {
    this.currentLocation = null;
    this.locationStatus = 'not_requested'; // 'not_requested', 'requesting', 'granted', 'denied'
    this.listeners = [];
    this._isInitialized = false;
  }

  // Initialize location service (call this at app startup)
  async initialize() {
    if (this._isInitialized) return;
    
    try {
      console.log('Initializing location service...');
      
      // Check if we already have permission
      const { status } = await Location.getForegroundPermissionsAsync();
      console.log('Current permission status:', status);
      
      if (status === 'granted') {
        this.locationStatus = 'granted';
        this.notifyListeners();
        
        // Try to get current location
        try {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 5000,
            distanceInterval: 5,
          });
          
          this.currentLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
          
          console.log('Initial location obtained:', this.currentLocation);
          this.notifyListeners();
        } catch (error) {
          console.log('Could not get initial location:', error);
          // Even if we can't get location immediately, permission is granted
          this.notifyListeners();
        }
      } else {
        this.locationStatus = 'not_requested';
        this.notifyListeners();
      }
      
      this._isInitialized = true;
    } catch (error) {
      console.error('Error initializing location service:', error);
      this.locationStatus = 'denied';
      this.notifyListeners();
    }
  }

  // Request location permission and get current location
  async requestLocationPermission() {
    try {
      console.log('Requesting location permission...');
      this.locationStatus = 'requesting';
      this.notifyListeners();

      // First check if location services are enabled
      const isEnabled = await Location.hasServicesEnabledAsync();
      if (!isEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings to use this app.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() }
          ]
        );
        this.locationStatus = 'denied';
        this.notifyListeners();
        return null;
      }

      // Request precise location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('Permission request result:', status);
      
      if (status === 'granted') {
        // Get current location with high accuracy
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000,
          distanceInterval: 5,
        });
        
        this.currentLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        
        this.locationStatus = 'granted';
        this.notifyListeners();
        
        console.log('Location obtained:', location.coords);
        return this.currentLocation;
      } else {
        this.locationStatus = 'denied';
        this.notifyListeners();
        
        // Don't show alerts for permission issues - just log and continue
        console.log('Location permission not granted:', status);
        if (status === 'denied') {
          console.log('Location permission was denied');
        } else if (status === 'undetermined') {
          console.log('Location permission not determined');
        }
        return null;
      }
    } catch (error) {
      this.locationStatus = 'denied';
      this.notifyListeners();
      
      console.error('Error requesting location permission:', error);
      
      // Handle specific error cases - just log instead of showing alerts
      console.log('Location error:', error);
      if (error.code === 'LOCATION_UNAVAILABLE') {
        console.log('Location is currently unavailable');
      } else if (error.code === 'LOCATION_TIMEOUT') {
        console.log('Location request timed out');
      }
      return null;
    }
  }

  // Get current location (returns cached location if available)
  getCurrentLocation() {
    return this.currentLocation;
  }

  // Get location status
  getLocationStatus() {
    return this.locationStatus;
  }

  // Check if service is initialized
  get isInitialized() {
    return this._isInitialized;
  }

  // Check if location is available
  isLocationAvailable() {
    return this.locationStatus === 'granted' && this.currentLocation !== null;
  }

  // Request fresh location update
  async getFreshLocation() {
    if (this.locationStatus !== 'granted') {
      return await this.requestLocationPermission();
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 5000,
        distanceInterval: 5,
      });
      
      this.currentLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      
      this.notifyListeners();
      return this.currentLocation;
    } catch (error) {
      console.error('Error getting fresh location:', error);
      return this.currentLocation; // Return cached location as fallback
    }
  }

  // Subscribe to location updates
  subscribe(callback) {
    this.listeners.push(callback);
    // Immediately call with current state
    callback({
      location: this.currentLocation,
      status: this.locationStatus
    });
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Notify all listeners
  notifyListeners() {
    this.listeners.forEach(callback => {
      callback({
        location: this.currentLocation,
        status: this.locationStatus
      });
    });
  }
}

// Create singleton instance
const locationService = new LocationService();

export default locationService; 