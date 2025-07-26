import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT, UrlTile } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { distillRoute, calculateRouteDistance, getGovernorateFromCoords, getAddressFromCoords } from '../../routeHelpers';
import { saveTrip } from '../../firestoreHelpers';

export default function TrackRide() {
  const [tracking, setTracking] = useState(false);
  const [route, setRoute] = useState([]);
  const [startLoc, setStartLoc] = useState(null);
  const [endLoc, setEndLoc] = useState(null);
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [endTime, setEndTime] = useState(null);
  const [calculatedDuration, setCalculatedDuration] = useState('');
  const [passengers, setPassengers] = useState('');
  const [loading, setLoading] = useState(false);

  const watchId = useRef(null);
  const router = useRouter();

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('يرجى السماح للتطبيق بالوصول إلى الموقع');
      return;
    }
    setTracking(true);
    setRoute([]);
    setStartLoc(null);
    setEndLoc(null);
    setStartTime(new Date());
    watchId.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Highest, timeInterval: 2000, distanceInterval: 5 },
      (loc) => {
        const { latitude, longitude } = loc.coords;
        setRoute((prev) => [...prev, { latitude, longitude }]);
        if (!startLoc) setStartLoc({ latitude, longitude });
      }
    );
  };

  const endTracking = async () => {
    setTracking(false);
    if (watchId.current) {
      watchId.current.remove();
      watchId.current = null;
    }
    
    const endTimeNow = new Date();
    setEndTime(endTimeNow);
    
    if (route.length > 0) {
      setEndLoc(route[route.length - 1]);
    }
    
    setLoading(true);
    try {
      // Calculate duration in minutes
      const durationMs = startTime ? endTimeNow.getTime() - startTime.getTime() : 0;
      const durationMinutes = Math.round(durationMs / (1000 * 60));
      setCalculatedDuration(durationMinutes.toString());
      
      // Get addresses for start and end locations
      let startAddressName = '';
      let endAddressName = '';
      
      if (startLoc) {
        startAddressName = await getAddressFromCoords(startLoc.latitude, startLoc.longitude);
        setStartAddress(startAddressName);
      }
      
      if (route.length > 0) {
        const endLocation = route[route.length - 1];
        endAddressName = await getAddressFromCoords(endLocation.latitude, endLocation.longitude);
        setEndAddress(endAddressName);
      }
      
      const distilledRoute = distillRoute(route, 20);
      const distance = calculateRouteDistance(route);
      const governorate = startLoc ? await getGovernorateFromCoords(startLoc.latitude, startLoc.longitude) : '';
      
      const tripDataObj = {
        from: startLoc ? { lat: startLoc.latitude, lng: startLoc.longitude, name: startAddressName } : {},
        to: route.length > 0 ? { lat: route[route.length - 1].latitude, lng: route[route.length - 1].longitude, name: endAddressName } : {},
        start_time: startTime ? startTime.toISOString() : null,
        end_time: endTimeNow.toISOString(),
        created_at: new Date().toISOString(),
        duration: durationMinutes,
        passenger_count: passengers ? Number(passengers) : 1,
        governorate,
        route: distilledRoute,
        distance,
      };
      
      setLoading(false);
      
      // Navigate to FareResults with appropriate data (following SubmitTrip pattern)
      router.push({
        pathname: '/(other)/FareResults',
        params: {
          from: startAddressName,
          to: endAddressName,
          time: startTime ? startTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : null,
          duration: durationMinutes.toString(),
          passengers: passengers || '1',
          estimate: '38', // Mock estimate like SubmitTrip
          distance: distance.toFixed(2),
          governorate,
          mode: 'track', // Indicate this came from tracking
          tripData: JSON.stringify({
            from: startLoc ? { lat: startLoc.latitude, lng: startLoc.longitude, name: startAddressName } : {},
            to: route.length > 0 ? { lat: route[route.length - 1].latitude, lng: route[route.length - 1].longitude, name: endAddressName } : {},
            fare: null, // Will be set when user enters paid fare
            start_time: startTime ? startTime.toISOString() : null,
            end_time: endTimeNow.toISOString(),
            created_at: new Date().toISOString(),
            duration: durationMinutes,
            passenger_count: passengers ? Number(passengers) : 1,
            governorate,
            route: distilledRoute,
            distance,
          })
        }
      });
    } catch (err) {
      setLoading(false);
      console.log(err);
      Alert.alert('حدث خطأ أثناء معالجة الرحلة');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <MapView
        style={{ flex: 1 }}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: 30.0444,
          longitude: 31.2357,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        {route.length > 0 && (
          <Polyline coordinates={route} strokeColor="#d32f2f" strokeWidth={4} />
        )}
        {startLoc && (
          <Marker coordinate={startLoc} title="نقطة البداية" pinColor="green" />
        )}
        {endLoc && (
          <Marker coordinate={endLoc} title="نقطة النهاية" pinColor="red" />
        )}
        <UrlTile
          urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />
                      </MapView>
        <View style={styles.bottomPanel}>
          <Text style={styles.title}>ابدأ تتبع رحلتك</Text>
          <TextInput
            style={styles.input}
            placeholder="عدد الركاب (اختياري)"
            keyboardType="numeric"
            value={passengers}
            onChangeText={setPassengers}
          />
          {!tracking ? (
            <TouchableOpacity style={styles.button} onPress={startTracking}>
              <Text style={styles.buttonText}>ابدأ التتبع</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.button, { backgroundColor: '#222' }]} onPress={endTracking}>
              <Text style={styles.buttonText}>انهاء التتبع</Text>
            </TouchableOpacity>
          )}
          {loading && (
            <View style={{ alignItems: 'center', marginVertical: 10 }}>
              <ActivityIndicator size="large" color="#d32f2f" />
              <Text style={{ color: '#d32f2f', marginTop: 8 }}>جاري المعالجة...</Text>
            </View>
          )}
        </View>
      </View>
  );
}

const styles = StyleSheet.create({
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