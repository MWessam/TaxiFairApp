import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ActivityIndicator, Platform, KeyboardAvoidingView, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import MapboxGL from '@rnmapbox/maps';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getRouteDistanceORS, getGovernorateFromCoords } from '../../routeHelpers';
import { saveTrip } from '../../firestoreHelpers';
import { useTheme } from '@/constants/ThemeContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import locationService from '../../services/locationService';


const { width, height } = Dimensions.get('window');

export default function TripForm({ mode = 'submit' }) {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();

  const [from, setFrom] = useState({ address: '', lat: null, lng: null });
  const [to, setTo] = useState({ address: '', lat: null, lng: null });
  const [fare, setFare] = useState('');
  const [duration, setDuration] = useState('');
  const [passengers, setPassengers] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [isScreenFocused, setIsScreenFocused] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['40%', '90%'], []);
  const cameraRef = useRef();

  const isEstimateMode = mode === 'estimate';

  // Handle screen focus/blur to manage bottom sheet behavior
  useFocusEffect(
    React.useCallback(() => {
      setIsScreenFocused(true);
      // Re-enable bottom sheet when screen comes back into focus
      if (bottomSheetRef.current) {
        bottomSheetRef.current.snapToIndex(0);
      }
      return () => {
        setIsScreenFocused(false);
        // Close bottom sheet when leaving screen
        if (bottomSheetRef.current) {
          bottomSheetRef.current.close();
        }
      };
    }, [])
  );

  // Update from/to if coming back from PlacePicker
  useEffect(() => {
    if (params.from_name && params.from_lat && params.from_lng) {
      setFrom({ address: params.from_name, lat: Number(params.from_lat), lng: Number(params.from_lng) });
    }
    if (params.to_name && params.to_lat && params.to_lng) {
      setTo({ address: params.to_name, lat: Number(params.to_lat), lng: Number(params.to_lng) });
    }
  }, [params.from_name, params.from_lat, params.from_lng, params.to_name, params.to_lat, params.to_lng]);

  // Fetch route polyline if both from and to are set
  useEffect(() => {
    async function fetchRoute() {
      if (from.lat && from.lng && to.lat && to.lng) {
        try {
          const routeData = await getRouteDistanceORS(
            { lat: from.lat, lng: from.lng, name: from.address },
            { lat: to.lat, lng: to.lng, name: to.address },
            true
          );
          if (routeData && routeData.geometry && routeData.geometry.length > 0) {
            setRouteCoords(routeData.geometry.map(coord =>
              Array.isArray(coord) ? coord : [coord.longitude, coord.latitude]
            ));
          } else {
            setRouteCoords([]);
          }
        } catch (error) {
          console.error('Error fetching route:', error);
          setRouteCoords([]);
        }
      } else {
        setRouteCoords([]);
      }
    }
    fetchRoute();
  }, [from, to]);

  // Auto-expand sheet if both locations are filled and screen is focused
  useEffect(() => {
    if (from.lat && to.lat && bottomSheetRef.current && isScreenFocused) {
      bottomSheetRef.current.expand();
    }
  }, [from, to, isScreenFocused]);

  useEffect(() => {
    // Subscribe to location service updates
    const unsubscribe = locationService.subscribe(({ location, status }) => {
      if (location) {
        setCurrentLocation({ lat: location.latitude, lng: location.longitude });
      }
    });
    
    // Cleanup subscription
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (cameraRef.current && getMapCenter()) {
      cameraRef.current.setCamera({
        centerCoordinate: getMapCenter(),
        zoomLevel: 14,
        animationDuration: 0,
        animationMode: 'none',
      });
    }
  }, [currentLocation, from, to]);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Cleanup when component unmounts
      if (cameraRef.current) {
        cameraRef.current = null;
      }
    };
  }, []);

  const handleSubmit = async () => {
    // Validation based on mode
    if (!from.address || !to.address) {
      Alert.alert('يرجى اختيار نقطة البداية والنهاية');
      return;
    }
    
    if (!isEstimateMode && !fare) {
      Alert.alert('يرجى كتابة الأجرة المدفوعة');
      return;
    }

    setLoading(true);
    try {
      const fromObj = { lat: from.lat, lng: from.lng, name: from.address };
      const toObj = { lat: to.lat, lng: to.lng, name: to.address };
      const routeData = await getRouteDistanceORS(fromObj, toObj, false); // Get distance only
      const distance = typeof routeData === 'number' ? routeData : routeData?.distance;
      const governorate = await getGovernorateFromCoords(fromObj.lat, fromObj.lng);
      
      // Mock estimate for now
      const estimate = 38;
      
      // If in submit mode, save trip data directly to Firebase
      if (!isEstimateMode) {
        const tripData = {
          from: fromObj,
          to: toObj,
          fare: Number(fare),
          start_time: startTime ? startTime.toISOString() : null,
          created_at: new Date().toISOString(),
          duration: duration ? Number(duration) : null,
          passenger_count: passengers ? Number(passengers) : 1,
          governorate,
          distance,
        };
        
        const success = await saveTrip(tripData);
        if (!success) {
          setLoading(false);
          Alert.alert('حدث خطأ أثناء حفظ الرحلة');
          return;
        }
      }
      
      setLoading(false);
      
      // Navigate to FareResults with appropriate data
      router.push({
        pathname: '/(other)/FareResults',
        params: {
          from: from.address,
          to: to.address,
          time: startTime ? startTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : null,
          duration,
          passengers,
          estimate,
          distance,
          governorate,
          // If in submit mode and fare is provided, pass it
          ...(fare && { paidFare: fare }),
          // Pass mode to FareResults
          mode,
          // Pass trip data for potential saving later (only in estimate mode)
          ...(isEstimateMode && {
            tripData: JSON.stringify({
              from: fromObj,
              to: toObj,
              fare: null, // Will be set when user enters paid fare
              start_time: startTime ? startTime.toISOString() : null,
              created_at: new Date().toISOString(),
              duration: duration ? Number(duration) : null,
              passenger_count: passengers ? Number(passengers) : 1,
              governorate,
              distance,
            })
          })
        },
      });
    } catch (err) {
      setLoading(false);
      Alert.alert('حدث خطأ أثناء حساب المسافة أو التقدير');
    }
  };

  // Get map center coordinates
  const getMapCenter = () => {
    if (from.lat && from.lng && to.lat && to.lng) {
      const midLat = (from.lat + to.lat) / 2;
      const midLng = (from.lng + to.lng) / 2;
      console.log('Mid:', midLat, midLng);
      return [midLng, midLat];
    } else if (from.lat && from.lng) {
      console.log('From:', from);
      return [from.lng, from.lat];
    } else if (currentLocation) {
      console.log('Current Location:', currentLocation);
      return [currentLocation.lng, currentLocation.lat];
    } else {
      console.log('Default:', [31.2357, 30.0444]);
      return [31.2357, 30.0444];
    }
  };

  const handleNavigateToPlacePicker = (type) => {
    // Close bottom sheet before navigation
    if (bottomSheetRef.current) {
      bottomSheetRef.current.close();
    }
    
    // Small delay to ensure bottom sheet is closed
    setTimeout(() => {
      const coords = type === 'from' ? { lat: from.lat, lng: from.lng } : { lat: to.lat, lng: to.lng };
      const returnTo = isEstimateMode ? '/(other)/EstimateFare' : '/(tabs)/SubmitTrip';
      router.push({ 
        pathname: '/(other)/PlacePicker', 
        params: { 
          type, 
          lat: coords.lat, 
          lng: coords.lng, 
          returnTo 
        } 
      });
    }, 100);
  };

  const styles = createStyles(theme);

  // Only render bottom sheet if screen is focused
  if (!isScreenFocused) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <MapboxGL.MapView key="submitTripUnfocused" style={StyleSheet.absoluteFill}>
            <MapboxGL.Camera
              zoomLevel={14}
              centerCoordinate={getMapCenter()}
              animationEnabled={false}
            />
            {from.lat && from.lng && (
              <MapboxGL.PointAnnotation id="submitTripFromUnfocused" coordinate={[from.lng, from.lat]}>
                <View style={{ backgroundColor: theme.primary, borderRadius: 10, width: 20, height: 20, borderWidth: 2, borderColor: '#fff' }} />
              </MapboxGL.PointAnnotation>
            )}
            {to.lat && to.lng && (
              <MapboxGL.PointAnnotation id="submitTripToUnfocused" coordinate={[to.lng, to.lat]}>
                <View style={{ backgroundColor: theme.accent, borderRadius: 10, width: 20, height: 20, borderWidth: 2, borderColor: '#fff' }} />
              </MapboxGL.PointAnnotation>
            )}
            {routeCoords.length > 0 && (
              <MapboxGL.ShapeSource id="submitTripRouteSourceUnfocused" shape={{
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoords,
                },
              }}>
                <MapboxGL.LineLayer id="submitTripRouteLineUnfocused" style={{ lineColor: theme.primary, lineWidth: 4 }} />
              </MapboxGL.ShapeSource>
            )}
            {currentLocation && (
              <MapboxGL.UserLocation 
                visible={true} 
                showsUserHeadingIndicator={true}
                onUpdate={(location) => {
                  // Safe location update handler
                  if (location && location.coords) {
                    setCurrentLocation({
                      lat: location.coords.latitude,
                      lng: location.coords.longitude
                    });
                  }
                }}
                          />
          )}
        </MapboxGL.MapView>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BottomSheetModalProvider>
        <View style={{ flex: 1, backgroundColor: theme.background }}>
          <MapboxGL.MapView key="submitTripFocused" style={StyleSheet.absoluteFill}>
            <MapboxGL.Camera ref={cameraRef} />
            {from.lat && from.lng && (
              <MapboxGL.PointAnnotation id="submitTripFrom" coordinate={[from.lng, from.lat]}>
                <View style={{ backgroundColor: theme.primary, borderRadius: 10, width: 20, height: 20, borderWidth: 2, borderColor: '#fff' }} />
              </MapboxGL.PointAnnotation>
            )}
            {to.lat && to.lng && (
              <MapboxGL.PointAnnotation id="submitTripTo" coordinate={[to.lng, to.lat]}>
                <View style={{ backgroundColor: theme.accent, borderRadius: 10, width: 20, height: 20, borderWidth: 2, borderColor: '#fff' }} />
              </MapboxGL.PointAnnotation>
            )}
            {routeCoords.length > 0 && (
              <MapboxGL.ShapeSource id="submitTripRouteSource" shape={{
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: routeCoords,
                },
              }}>
                <MapboxGL.LineLayer id="submitTripRouteLine" style={{ lineColor: theme.primary, lineWidth: 4 }} />
              </MapboxGL.ShapeSource>
            )}
            {currentLocation && (
              <MapboxGL.UserLocation 
                visible={true} 
                showsUserHeadingIndicator={true}
                onUpdate={(location) => {
                  // Safe location update handler
                  if (location && location.coords) {
                    setCurrentLocation({
                      lat: location.coords.latitude,
                      lng: location.coords.longitude
                    });
                  }
                }}
                          />
          )}
        </MapboxGL.MapView>
        <BottomSheet
            ref={bottomSheetRef}
            index={0}
            snapPoints={snapPoints}
            enablePanDownToClose={false}
            backgroundStyle={{ backgroundColor: theme.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}
            handleIndicatorStyle={{ backgroundColor: theme.border }}
            activeOffsetY={[-1, 1]}
            failOffsetX={[-5, 5]}
          >
            <BottomSheetView>
              <View style={styles.sheetContent}>
                <Text style={styles.sheetTitle}>
                  {isEstimateMode ? 'احسب اجرة رحلتك' : 'شارك اجرة رحلتك'}
                </Text>
                <View style={styles.sheetFieldsRow}>
                  <TouchableOpacity
                    style={styles.sheetField}
                    onPress={() => handleNavigateToPlacePicker('from')}
                  >
                    <Text style={styles.sheetFieldLabel}>من</Text>
                    <Text style={styles.sheetFieldValue}>{from.address || 'اختر نقطة البداية'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sheetField}
                    onPress={() => handleNavigateToPlacePicker('to')}
                  >
                    <Text style={styles.sheetFieldLabel}>إلى</Text>
                    <Text style={styles.sheetFieldValue}>{to.address || 'اختر نقطة النهاية'}</Text>
                  </TouchableOpacity>
                </View>
                {/* Expanded content */}
                {(from.lat && to.lat) && (
                  <View style={styles.sheetExpandedContent}>
                    <TouchableOpacity
                      style={styles.input}
                      onPress={() => setShowTimePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: startTime ? theme.text : theme.textSecondary, fontSize: 16 }}>
                        {startTime ? startTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : 'وقت بداية الرحلة (اختياري)'}
                      </Text>
                    </TouchableOpacity>
                    {showTimePicker && (
                      <DateTimePicker
                        value={startTime || new Date()}
                        mode="time"
                        is24Hour={true}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={(event, selectedDate) => {
                          setShowTimePicker(false);
                          if (selectedDate) setStartTime(selectedDate);
                        }}
                      />
                    )}
                    {/* Only show fare input in submit mode */}
                    {!isEstimateMode && (
                      <TextInput
                        style={styles.input}
                        placeholder="الأجرة المدفوعة (جنيه) *"
                        keyboardType="numeric"
                        value={fare}
                        onChangeText={setFare}
                        placeholderTextColor={theme.textSecondary}
                      />
                    )}
                    <TextInput
                      style={styles.input}
                      placeholder="مدة الرحلة (دقائق) (اختياري)"
                      keyboardType="numeric"
                      value={duration}
                      onChangeText={setDuration}
                      placeholderTextColor={theme.textSecondary}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="عدد الركاب (اختياري)"
                      keyboardType="numeric"
                      value={passengers}
                      onChangeText={setPassengers}
                      placeholderTextColor={theme.textSecondary}
                    />
                    <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
                      <Text style={styles.submitButtonText}>
                        {isEstimateMode ? 'احسب الأجرة' : 'حفظ الرحلة'}
                      </Text>
                    </TouchableOpacity>
                    {loading && (
                      <View style={{ alignItems: 'center', marginVertical: 10 }}>
                        <ActivityIndicator size="large" color={theme.primary} />
                        <Text style={{ color: theme.primary, marginTop: 8 }}>
                          {isEstimateMode ? 'جاري الحساب...' : 'جاري الحفظ...'}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </BottomSheetView>
          </BottomSheet>
        </View>
      </BottomSheetModalProvider>
    </GestureHandlerRootView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.primary,
    marginBottom: 18,
    textAlign: 'center',
  },
  sheetFieldsRow: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 12,
  },
  sheetField: {
    backgroundColor: theme.background,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  sheetFieldLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 2,
  },
  sheetFieldValue: {
    fontSize: 16,
    color: theme.text,
  },
  sheetExpandedContent: {
    marginTop: 10,
  },
  input: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  submitButton: {
    backgroundColor: theme.primary,
    borderRadius: 32,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: theme.textOnPrimary,
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
});