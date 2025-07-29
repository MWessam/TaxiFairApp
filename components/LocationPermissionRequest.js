import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking, StyleSheet } from 'react-native';
import locationService from '../services/locationService';

export default function LocationPermissionRequest() {
  const [locationStatus, setLocationStatus] = useState('not_requested');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize location service if not already done
    const initLocationService = async () => {
      if (!isInitialized) {
        await locationService.initialize();
        setIsInitialized(true);
      }
    };
    
    initLocationService();
    
    // Subscribe to location service updates
    const unsubscribe = locationService.subscribe(({ location, status }) => {
      console.log('LocationPermissionRequest: Status update:', status, 'Location:', location);
      setCurrentLocation(location);
      setLocationStatus(status);
    });

    return unsubscribe;
  }, [isInitialized]);

  const requestPermission = async () => {
    console.log('LocationPermissionRequest: Requesting permission...');
    await locationService.requestLocationPermission();
  };

  // Don't show anything if location is already granted and we have a location
  if (locationStatus === 'granted' && currentLocation) {
    console.log('LocationPermissionRequest: Location granted and available, hiding component');
    return null;
  }

  // Show loading state while initializing
  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>🔄 جاري تهيئة خدمة الموقع...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {locationStatus === 'requesting' && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusText}>🔄 جاري طلب إذن الموقع الدقيق...</Text>
        </View>
      )}

      {locationStatus === 'denied' && (
        <View style={styles.deniedContainer}>
          <Text style={styles.deniedText}>❌ الموقع الدقيق مطلوب للتطبيق</Text>
          <Text style={styles.deniedSubtext}>
            نحتاج إلى موقع دقيق لتتبع رحلات التاكسي بدقة
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={requestPermission}>
            <Text style={styles.retryButtonText}>إعادة المحاولة</Text>
          </TouchableOpacity>
        </View>
      )}

      {locationStatus === 'not_requested' && (
        <View style={styles.requestContainer}>
          <Text style={styles.requestText}>📍 نحتاج إلى إذن الموقع الدقيق</Text>
          <Text style={styles.requestSubtext}>
            لتتبع رحلات التاكسي بدقة وحساب المسافات
          </Text>
          <TouchableOpacity style={styles.requestButton} onPress={requestPermission}>
            <Text style={styles.requestButtonText}>منح الإذن</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Debug info in development */}
      {__DEV__ && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugText}>Debug: Status={locationStatus}, Location={currentLocation ? 'Available' : 'None'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  statusContainer: {
    backgroundColor: '#fff3e0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff9800',
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#e65100',
  },
  deniedContainer: {
    backgroundColor: '#ffebee',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f44336',
  },
  deniedText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#c62828',
    marginBottom: 8,
  },
  deniedSubtext: {
    fontSize: 14,
    color: '#d32f2f',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: '#d32f2f',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  requestContainer: {
    backgroundColor: '#e3f2fd',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  requestText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1565c0',
    marginBottom: 8,
  },
  requestSubtext: {
    fontSize: 14,
    color: '#1976d2',
    textAlign: 'center',
    marginBottom: 12,
  },
  requestButton: {
    backgroundColor: '#2196f3',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  requestButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  debugContainer: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
}); 