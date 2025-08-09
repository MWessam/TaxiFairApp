import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ActivityIndicator, Platform, ScrollView, Dimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MapView, { MapboxGL } from '@/components/MapView';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getRouteDistanceORS, getGovernorateFromCoords } from '../../routeHelpers';
import { saveTrip } from '../../firestoreHelpers';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/constants/AuthContext';
import locationService from '../../services/locationService';
import adService from '../../services/adService';
import BannerAdComponent from '../../components/BannerAdComponent';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function TripForm({ mode = 'submit', navigationParams = {} }) {
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  
  const { theme } = useTheme();
  const { isAuthenticated, loading: authLoading, user } = useAuth();

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

  // Ensure current location is available and permissions requested
  useEffect(() => {
    const initLocation = async () => {
      try {
        if (!locationService.isInitialized) {
          await locationService.initialize();
        }
        const existing = locationService.getCurrentLocation();
        if (existing && existing.latitude && existing.longitude) {
          setCurrentLocation({ lat: existing.latitude, lng: existing.longitude });
        } else {
          const loc = await locationService.requestLocationPermission();
          if (loc && loc.latitude && loc.longitude) {
            setCurrentLocation({ lat: loc.latitude, lng: loc.longitude });
          }
        }
      } catch (e) {
        // ignore; fallback center will be used
      }
    };
    initLocation();
  }, []);

  // Clean and merge parameters properly
  const cleanRouteParams = useMemo(() => {
    const cleaned = {};
    
    // Handle mode parameter - it might be an array due to corruption
    if (routeParams.mode) {
      if (Array.isArray(routeParams.mode)) {
        // Take the first element and clean it
        const modeStr = routeParams.mode[0] || routeParams.mode[1] || '';
        cleaned.mode = modeStr.split('?')[0]; // Remove any query params that got attached
      } else {
        cleaned.mode = routeParams.mode.split('?')[0]; // Remove any query params
      }
    }
    
    // Clean other parameters
    Object.keys(routeParams).forEach(key => {
      if (key !== 'mode') {
        cleaned[key] = routeParams[key];
      }
    });
    
    return cleaned;
  }, [routeParams]);

  // Merge with navigation params
  const params = useMemo(() => ({ ...cleanRouteParams, ...navigationParams }), [cleanRouteParams, navigationParams]);

  // Determine mode from cleaned params or prop
  const isEstimateMode = (cleanRouteParams.mode === 'estimate') || mode === 'estimate';
  
  console.log('SubmitTrip: Mode detection:', { 
    routeMode: cleanRouteParams.mode, 
    propMode: mode, 
    isEstimateMode,
    allRouteParams: cleanRouteParams
  });

  // Update from/to if coming back from PlacePicker
  useEffect(() => {
    // console.log('TripForm params updated:', params); // Debug log
    // console.log('TripForm: All route params:', routeParams); // Debug log
    // console.log('TripForm: Mode from route:', routeParams.mode); // Debug log
    
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

        const response = await saveTrip(tripData);
        if (!response.success) {
          setLoading(false);
          console.log('Error saving trip:', response);
          
          // Handle authentication errors
          if (response.requiresAuth) {
            Alert.alert(
              'تسجيل الدخول مطلوب',
              'يجب تسجيل الدخول لحفظ رحلاتك',
              [
                {
                  text: 'إلغاء',
                  style: 'cancel'
                },
                {
                  text: 'تسجيل الدخول',
                  onPress: () => router.push('/(other)/SignInScreen')
                }
              ]
            );
            return;
          }
          
          Alert.alert('حدث خطأ أثناء حفظ الرحلة', response.error || 'حدث خطأ غير متوقع');
          return;
        }
        
        // Navigate to results with status
        console.log('Response:', response);
        console.log('Status:', response.status);
        router.push({
          pathname: '/(other)/FareResults',
          params: {
            from: fromObj.name,
            to: toObj.name,
            from_lat: fromObj.lat,
            from_lng: fromObj.lng,
            to_lat: toObj.lat,
            to_lng: toObj.lng,
            distance,
            duration,
            time: startTime ? startTime.toLocaleTimeString('ar-EG', { 
              hour: '2-digit', 
              minute: '2-digit',
              hour12: true 
            }) : null,
            paidFare: fare,
            status: response.status || null,
            tripData: JSON.stringify(tripData)
          }
        });
        return; // Exit early for submit mode
      }
      
      setLoading(false);
      
      // Show ad after trip estimation (not tracking)
      if (isEstimateMode) {
        // await adService.showAdAfterTripEstimation();
      }
      
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
            }),
          }),
        },
      });
    } catch (err) {
      setLoading(false);
      Alert.alert('حدث خطأ أثناء حساب المسافة أو التقدير');
      console.error('Error saving trip:', err);
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
    
    // Pass current location data to preserve existing selections
    const pickerParams = { 
      type, 
      lat: coords.lat, 
      lng: coords.lng, 
      returnTo: '/(other)/SubmitTrip', // Just the pathname, no query params
      mode: isEstimateMode ? 'estimate' : 'submit' // Pass the mode parameter
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

  // Check authentication on component mount
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      Alert.alert(
        'تسجيل الدخول مطلوب',
        'يجب تسجيل الدخول لحفظ رحلاتك',
        [
          {
            text: 'إلغاء',
            style: 'cancel',
            onPress: () => router.back()
          },
          {
            text: 'تسجيل الدخول',
            onPress: () => router.push('/(other)/SignInScreen')
          }
        ]
      );
    }
  }, [isAuthenticated, authLoading]);

  // Show loading screen while checking authentication
  if (authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { marginTop: 16 }]}>جاري التحقق من تسجيل الدخول...</Text>
      </View>
    );
  }

  // Show sign-in prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="lock-closed" size={64} color={theme.textSecondary} />
        <Text style={styles.authRequiredTitle}>تسجيل الدخول مطلوب</Text>
        <Text style={styles.authRequiredText}>
          يجب تسجيل الدخول لحفظ رحلاتك ومشاركة البيانات
        </Text>
        <TouchableOpacity
          style={styles.authButton}
          onPress={() => router.push('/(other)/SignInScreen')}
        >
          <Text style={styles.authButtonText}>تسجيل الدخول</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>العودة</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const styles = createStyles(theme);
  const isFormComplete = from.address && to.address && (isEstimateMode || fare);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-forward" size={20} color={theme.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEstimateMode ? 'تقدير سعر الرحلة' : 'إضافة رحلة'}
          </Text>
          {user && (
            <View style={styles.userInfo}>
              <Ionicons name="person-circle" size={16} color={theme.textSecondary} />
              <Text style={styles.userText}>
                {user.displayName || (user.isAnonymous ? 'زائر' : 'مستخدم')}
              </Text>
            </View>
          )}
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Map Area */}
        <View style={styles.mapCard}>
          <View style={styles.mapContainer}>
            <MapView 
              style={styles.map}
              center={getMapCenter()}
              zoom={14}
              onRegionDidChange={(e) => {
                // keep currentLocation in sync if user pans and neither from/to set
                if (!(from.lat && from.lng) && !(to.lat && to.lng)) {
                  const coords = e?.geometry?.coordinates;
                  if (Array.isArray(coords)) {
                    const [lng, lat] = coords;
                    setCurrentLocation({ lat, lng });
                  }
                }
              }}
            >
              {/* Native-specific map elements */}
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
            </MapView>
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

      {/* Banner Ad */}
      <BannerAdComponent containerStyle={styles.bannerAdContainer} />
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
    paddingBottom: 80, // Increased padding for banner ad
  },
  bannerAdContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
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
  loadingText: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  authRequiredTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.text,
    marginTop: 16,
  },
  authRequiredText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  authButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    width: '80%',
    marginBottom: 16,
  },
  authButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButtonText: {
    fontSize: 16,
    color: theme.textSecondary,
    textDecorationLine: 'underline',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  userText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginLeft: 4,
  },
});