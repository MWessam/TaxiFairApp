import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ActivityIndicator, Platform, ScrollView, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapboxGL from '@rnmapbox/maps';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getRouteDistanceORS, getGovernorateFromCoords } from '../../routeHelpers';
import { saveTrip } from '../../firestoreHelpers';
import { useTheme } from '@/constants/ThemeContext';
import locationService from '../../services/locationService';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function TripForm({ mode = 'submit', navigationParams = {} }) {
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  
  // Merge route params with navigation params (for estimate mode) - memoized to prevent infinite loops
  const params = useMemo(() => ({ ...routeParams, ...navigationParams }), [routeParams, navigationParams]);
  const { theme } = useTheme();

  const [from, setFrom] = useState({ address: '', lat: null, lng: null });
  const [to, setTo] = useState({ address: '', lat: null, lng: null });
  const [fare, setFare] = useState('');
  const [duration, setDuration] = useState('');
  const [passengers, setPassengers] = useState('1');
  const [startTime, setStartTime] = useState(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const cameraRef = useRef();

  const isEstimateMode = mode === 'estimate';

  // Update from/to if coming back from PlacePicker
  useEffect(() => {
    console.log('TripForm params updated:', params); // Debug log
    
    if (params.from_name && params.from_lat && params.from_lng) {
      const fromData = { 
        address: params.from_name, 
        lat: Number(params.from_lat), 
        lng: Number(params.from_lng) 
      };
      console.log('Setting from:', fromData); // Debug log
      setFrom(fromData);
    }
    if (params.to_name && params.to_lat && params.to_lng) {
      const toData = { 
        address: params.to_name, 
        lat: Number(params.to_lat), 
        lng: Number(params.to_lng) 
      };
      console.log('Setting to:', toData); // Debug log
      setTo(toData);
    }
  }, [params.from_name, params.from_lat, params.from_lng, params.to_name, params.to_lat, params.to_lng]); // Watch specific param properties

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
        animationDuration: 1000,
      });
    }
  }, [currentLocation, from, to]);

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
          from_lat: from.lat,
          from_lng: from.lng,
          to_lat: to.lat,
          to_lng: to.lng,
          time: startTime ? startTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }) : null,
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
      return [midLng, midLat];
    } else if (from.lat && from.lng) {
      return [from.lng, from.lat];
    } else if (currentLocation) {
      return [currentLocation.lng, currentLocation.lat];
    } else {
      return [31.2357, 30.0444];
    }
  };

  const handleNavigateToPlacePicker = (type) => {
    const coords = type === 'from' ? { lat: from.lat, lng: from.lng } : { lat: to.lat, lng: to.lng };
    const returnTo = isEstimateMode ? '/(tabs)/SubmitTrip?mode=estimate' : '/(tabs)/SubmitTrip';
    
    // Pass current location data to preserve existing selections
    const pickerParams = { 
      type, 
      lat: coords.lat, 
      lng: coords.lng, 
      returnTo
    };
    
    // Add current from location data
    if (from.address && from.lat && from.lng) {
      pickerParams.from_name = from.address;
      pickerParams.from_lat = from.lat;
      pickerParams.from_lng = from.lng;
    }
    
    // Add current to location data
    if (to.address && to.lat && to.lng) {
      pickerParams.to_name = to.address;
      pickerParams.to_lat = to.lat;
      pickerParams.to_lng = to.lng;
    }
    
    router.push({ 
      pathname: '/(other)/PlacePicker', 
      params: pickerParams
    });
  };

  const styles = createStyles(theme);
  const isFormComplete = from.address && to.address && (isEstimateMode || fare);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEstimateMode ? 'تقدير سعر الرحلة' : 'إضافة رحلة'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Map Area */}
        <View style={styles.mapCard}>
          <View style={styles.mapContainer}>
            <MapboxGL.MapView style={styles.map}>
              <MapboxGL.Camera ref={cameraRef} />
              {from.lat && from.lng && (
                <MapboxGL.PointAnnotation id="fromPoint" coordinate={[from.lng, from.lat]}>
                  <View style={[styles.mapPin, { backgroundColor: '#10B981' }]} />
                </MapboxGL.PointAnnotation>
              )}
              {to.lat && to.lng && (
                <MapboxGL.PointAnnotation id="toPoint" coordinate={[to.lng, to.lat]}>
                  <View style={[styles.mapPin, { backgroundColor: '#EF4444' }]} />
                </MapboxGL.PointAnnotation>
              )}
              {routeCoords.length > 0 && (
                <MapboxGL.ShapeSource id="routeSource" shape={{
                  type: 'Feature',
                  geometry: {
                    type: 'LineString',
                    coordinates: routeCoords,
                  },
                }}>
                  <MapboxGL.LineLayer id="routeLine" style={{ lineColor: theme.primary, lineWidth: 4 }} />
                </MapboxGL.ShapeSource>
              )}
              {currentLocation && (
                <MapboxGL.UserLocation 
                  visible={true} 
                  showsUserHeadingIndicator={true}
                  onUpdate={(location) => {
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
            <View style={styles.mapOverlay}>
              <Ionicons name="location" size={32} color={theme.primary} />
            </View>
            <View style={styles.locationBadge}>
              <Text style={styles.locationBadgeText}>القاهرة، مصر</Text>
            </View>
          </View>
        </View>

        {/* Location Inputs */}
        <View style={styles.card}>
          <View style={styles.cardContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>من</Text>
              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => handleNavigateToPlacePicker('from')}
              >
                <Ionicons name="location" size={16} color="#10B981" style={styles.locationIcon} />
                <Text style={styles.locationButtonText}>
                  {from.address || 'اختر نقطة البداية'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>إلى</Text>
              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => handleNavigateToPlacePicker('to')}
              >
                <Ionicons name="location" size={16} color="#EF4444" style={styles.locationIcon} />
                <Text style={styles.locationButtonText}>
                  {to.address || 'اختر الوجهة'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Trip Details */}
        {from.address && to.address && (
          <View style={styles.card}>
            <View style={styles.cardContent}>
              <Text style={styles.cardTitle}>تفاصيل الرحلة</Text>

              {!isEstimateMode && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>السعر المدفوع (جنيه) *</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="cash" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="45"
                      keyboardType="numeric"
                      value={fare}
                      onChangeText={setFare}
                      placeholderTextColor={theme.textSecondary}
                    />
                  </View>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>وقت بداية الرحلة</Text>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                  <Text style={[styles.input, { color: startTime ? theme.text : theme.textSecondary }]}>
                    {startTime ? startTime.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'اختر الوقت'}
                  </Text>
                </TouchableOpacity>
                {showTimePicker && (
                  <DateTimePicker
                    value={startTime || new Date()}
                    mode="time"
                    is24Hour={false}
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowTimePicker(false);
                      if (selectedDate) setStartTime(selectedDate);
                    }}
                  />
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>مدة الرحلة (دقيقة)</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="time" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="20"
                    keyboardType="numeric"
                    value={duration}
                    onChangeText={setDuration}
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>عدد الركاب</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="people" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={passengers}
                    onChangeText={setPassengers}
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Submit Button */}
        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[styles.submitButton, { opacity: isFormComplete ? 1 : 0.5 }]}
            onPress={handleSubmit}
            disabled={!isFormComplete || loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isEstimateMode ? 'احسب السعر' : 'إرسال الرحلة'}
              </Text>
            )}
          </TouchableOpacity>

          {!isEstimateMode && (
            <Text style={styles.requiredText}>* الحقول المطلوبة</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  mapCard: {
    margin: 16,
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapContainer: {
    height: 192,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -16 }],
    zIndex: 1,
  },
  mapPin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  locationBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.text,
  },
  card: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
    marginBottom: 4,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 48,
  },
  locationIcon: {
    marginLeft: 8,
  },
  locationButtonText: {
    fontSize: 16,
    color: theme.text,
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  inputIcon: {
    marginLeft: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
    paddingVertical: 12,
  },
  submitContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  submitButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  requiredText: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
});