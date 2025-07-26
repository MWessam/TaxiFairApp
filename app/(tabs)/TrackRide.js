import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import MapboxGL from '@rnmapbox/maps';
import { useRouter } from 'expo-router';
import { distillRoute, calculateRouteDistance, getGovernorateFromCoords, getAddressFromCoords } from '../../routeHelpers';

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

  const cameraRef = useRef(null);
  const router = useRouter();

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

  const startTracking = () => {
    if (!currentLocation) {
      Alert.alert('Could not get location', 'Please make sure location services are enabled and try again.');
      return;
    }
    setTracking(true);
    setRoute([]);
    setEndLoc(null);
    setStartTime(new Date());
    setStartLoc(currentLocation);
    setRoute([currentLocation]);
  };

  const endTracking = async () => {
    // ... (Your endTracking logic is fine, no changes needed here)
    setTracking(false);
    
    if (route.length === 0 || !startLoc) {
        Alert.alert("Tracking Error", "No route was recorded.");
        return;
    }

    const endTimeNow = new Date();
    const endLocation = route[route.length - 1];
    setEndLoc(endLocation);
    setLoading(true);

    try {
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
      <MapboxGL.MapView style={styles.map}>
        {/* The Camera is now completely separate and manually controlled */}
        <MapboxGL.Camera ref={cameraRef} />
        
        <MapboxGL.UserLocation 
          visible={true}
          showsUserHeadingIndicator={true}
          onUpdate={handleLocationUpdate}
          minDisplacement={5}
        />

        {/* --- The rest of your map components are fine --- */}
        {route.length > 0 && (
          <MapboxGL.ShapeSource id="routeSource" shape={{
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: route.map(p => [p.longitude, p.latitude]),
            },
          }}>
            <MapboxGL.LineLayer id="routeLine" style={{ lineColor: '#d32f2f', lineWidth: 4 }} />
          </MapboxGL.ShapeSource>
        )}
        {startLoc && (
          <MapboxGL.PointAnnotation id="start" coordinate={[startLoc.longitude, startLoc.latitude]}>
            <View style={styles.markerGreen} />
          </MapboxGL.PointAnnotation>
        )}
        {endLoc && (
          <MapboxGL.PointAnnotation id="end" coordinate={[endLoc.longitude, endLoc.latitude]}>
            <View style={styles.markerRed} />
          </MapboxGL.PointAnnotation>
        )}
      </MapboxGL.MapView>

      <View style={styles.bottomPanel}>
        {/* --- Your bottom panel is fine, no changes needed --- */}
        <Text style={styles.title}>ابدأ تتبع رحلتك</Text>
        <TextInput
          style={styles.input}
          placeholder="عدد الركاب (اختياري)"
          keyboardType="numeric"
          value={passengers}
          onChangeText={setPassengers}
        />
        {!tracking ? (
          <TouchableOpacity style={styles.button} onPress={startTracking} disabled={!currentLocation}>
            <Text style={styles.buttonText}>ابدأ التتبع</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.button, { backgroundColor: '#222' }]} onPress={endTracking}>
            <Text style={styles.buttonText}>انهاء التتبع</Text>
          </TouchableOpacity>
        )}
        {loading && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#d32f2f" />
            <Text style={styles.loaderText}>جاري المعالجة...</Text>
          </View>
        )}
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
    }
});