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
import { useResponsiveValue, useBreakpoints } from '@/constants/responsive';

const { width, height } = Dimensions.get('window');

export default function TripForm({ mode = 'submit', navigationParams = {} }) {
  const router = useRouter();
  const routeParams = useLocalSearchParams();
  
  const { theme } = useTheme();
  const { isSmall, isMedium, isLarge } = useBreakpoints();
  const { isAuthenticated, loading: authLoading, user } = useAuth();

  const [from, setFrom] = useState({ address: '', lat: null, lng: null });
  const [to, setTo] = useState({ address: '', lat: null, lng: null });
  const [fare, setFare] = useState('');
  const [duration, setDuration] = useState('');
  const [passengers, setPassengers] = useState('1');
  const [startTime, setStartTime] = useState(() => new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeCoords, setRouteCoords] = useState([]);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState([31.2357, 30.0444]); // Stable map center
  const cameraRef = useRef();

  // Ensure current location is available and permissions requested
  useEffect(() => {
    const initLocation = async () => {
      setLocationLoading(true);
      try {
        if (!locationService.isInitialized) {
          await locationService.initialize();
        }
        const existing = locationService.getCurrentLocation();
        if (existing && existing.latitude && existing.longitude) {
          setCurrentLocation({ lat: existing.latitude, lng: existing.longitude });
          setMapCenter([existing.longitude, existing.latitude]);
          setLocationLoading(false);
          return;
        }
        
        const loc = await locationService.requestLocationPermission();
        if (loc && loc.latitude && loc.longitude) {
          setCurrentLocation({ lat: loc.latitude, lng: loc.longitude });
          setMapCenter([loc.longitude, loc.latitude]);
          setLocationLoading(false);
          return;
        }
        
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
          // Web fallback to browser Geolocation API
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const { latitude, longitude } = pos.coords || {};
              if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
                setCurrentLocation({ lat: latitude, lng: longitude });
                setMapCenter([longitude, latitude]);
              }
              setLocationLoading(false);
            },
            (error) => {
              console.warn('Geolocation error:', error);
              setLocationLoading(false);
            },
            { enableHighAccuracy: true, maximumAge: 15000, timeout: 8000 }
          );
        } else {
          setLocationLoading(false);
        }
      } catch (e) {
        console.warn('Location initialization error:', e);
        setLocationLoading(false);
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
      setMapCenter([fromData.lng, fromData.lat]); // Update map center
    }
    if (params.to_name && params.to_lat && params.to_lng) {
      const toData = { 
        address: params.to_name, 
        lat: Number(params.to_lat), 
        lng: Number(params.to_lng) 
      };
      console.log('Setting to:', toData); // Debug log
      setTo(toData);
      // If we don't have a 'from' location, center on 'to'
      if (!from.lat || !from.lng) {
        setMapCenter([toData.lng, toData.lat]);
      }
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
        setMapCenter([location.longitude, location.latitude]);
        setLocationLoading(false); // Stop loading when location is found
      }
    });
    
    // Cleanup subscription
    return unsubscribe;
  }, []);

  // No direct cameraRef control on web; MapView will react to center/bounds props

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

  // Web-friendly time picker fallback with robust fallbacks
  const handleOpenTimePicker = () => {
    if (Platform.OS === 'web') {
      try {
        if (typeof document === 'undefined') {
          setShowTimePicker(true);
          return;
        }
        const input = document.createElement('input');
        input.type = 'time';
        input.style.position = 'fixed';
        input.style.opacity = '0';
        input.style.pointerEvents = 'none';
        input.style.zIndex = '-1';
        const current = startTime || new Date();
        const hh = String(current.getHours()).padStart(2, '0');
        const mm = String(current.getMinutes()).padStart(2, '0');
        input.value = `${hh}:${mm}`;
        const cleanup = () => {
          try { input && input.parentNode && input.parentNode.removeChild(input); } catch {}
        };
        input.addEventListener('change', (e) => {
          try {
            const value = e.target.value; // HH:mm
            if (value && /^\d{2}:\d{2}$/.test(value)) {
              const [h, m] = value.split(':').map(Number);
              const d = new Date();
              d.setHours(h);
              d.setMinutes(m);
              d.setSeconds(0);
              d.setMilliseconds(0);
              setStartTime(d);
            }
          } finally {
            cleanup();
          }
        });
        input.addEventListener('blur', cleanup);
        document.body.appendChild(input);
        if (typeof input.showPicker === 'function') {
          input.showPicker();
        } else {
          input.focus();
          input.click();
          // As a last resort (Safari iOS/macOS where time input may not be supported)
          setTimeout(() => {
            try {
              const active = document.activeElement;
              const unsupported = !active || active !== input;
              if (unsupported) {
                cleanup();
                const entered = window.prompt('أدخل الوقت (HH:MM)', `${hh}:${mm}`);
                if (entered && /^\d{2}:\d{2}$/.test(entered)) {
                  const [h, m] = entered.split(':').map(Number);
                  const d = new Date();
                  d.setHours(h);
                  d.setMinutes(m);
                  d.setSeconds(0);
                  d.setMilliseconds(0);
                  setStartTime(d);
                }
              }
            } catch { cleanup(); }
          }, 80);
        }
        return;
      } catch {
        // Fall back to native picker if anything unexpected happens
      }
    }
    setShowTimePicker(true);
  };

  // Get map camera options using stable center
  const getMapCenter = () => {
    if (from.lat && from.lng) return [from.lng, from.lat];
    return mapCenter; // Use the stable map center
  };

  const getBoundsIfNeeded = () => {
    if (routeCoords && routeCoords.length > 0) {
      // Fit to route coordinates for best view
      let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
      for (const pt of routeCoords) {
        if (!Array.isArray(pt) || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) continue;
        const [lng, lat] = pt;
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
      if (Number.isFinite(minLng) && Number.isFinite(minLat) && Number.isFinite(maxLng) && Number.isFinite(maxLat)) {
        return { ne: [maxLng, maxLat], sw: [minLng, minLat], padding: 50, animationDuration: 800 };
      }
    }
    if (from.lat && from.lng && to.lat && to.lng) {
      const ne = [Math.max(from.lng, to.lng), Math.max(from.lat, to.lat)];
      const sw = [Math.min(from.lng, to.lng), Math.min(from.lat, to.lat)];
      return { ne, sw, padding: 50, animationDuration: 800 };
    }
    return null;
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

  const mapHeight = useResponsiveValue({ small: 280, medium: 360, large: 500, default: 280 });
  const contentMaxWidth = useResponsiveValue({ small: '100%', medium: 720, large: 960, default: '100%' });
  const styles = createStyles(theme, { mapHeight, contentMaxWidth });
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
          {/* <View style={styles.headerSpacer} /> */}
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Map Area */}
        <View style={styles.mapCard}>
          <View style={styles.mapContainer}>
            <MapView 
              style={styles.map}
              center={getMapCenter()}
              zoom={currentLocation ? 14 : 10}
              bounds={getBoundsIfNeeded()}
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
              webMarkers={[
                ...(from.lat && from.lng ? [{ lng: from.lng, lat: from.lat, color: '#10B981' }] : []),
                ...(to.lat && to.lng ? [{ lng: to.lng, lat: to.lat, color: '#EF4444' }] : []),
              ]}
              webLineCoords={routeCoords}
            >
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
            
            {/* Loading overlay when determining location */}
            {locationLoading && (
              <View style={styles.mapLoadingOverlay}>
                <View style={styles.mapLoadingContent}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={styles.mapLoadingText}>جاري تحديد موقعك...</Text>
                </View>
              </View>
            )}
            
            <View style={styles.mapOverlay}>
              <Ionicons name="location" size={32} color={theme.primary} />
            </View>
            {false && (
              <View style={styles.locationBadge}>
                <Text style={styles.locationBadgeText}>القاهرة، مصر</Text>
              </View>
            )}
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
                {Platform.OS === 'web' ? (
                  <View style={[styles.inputContainer, { paddingHorizontal: 12 }]}> 
                    <Ionicons name="time" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                    {(() => {
                      const d = startTime || new Date();
                      const minutes = d.getMinutes();
                      let hours24 = d.getHours();
                      const isPM = hours24 >= 12;
                      const hour12 = (hours24 % 12) || 12;
                      const setFromParts = (h12, m, pm) => {
                        const nd = new Date(startTime || new Date());
                        let h24 = h12 % 12;
                        if (pm) h24 += 12;
                        if (!pm && h12 === 12) h24 = 0;
                        nd.setHours(h24, m, 0, 0);
                        setStartTime(nd);
                      };
                      const selectStyle = {
                        appearance: 'none',
                        WebkitAppearance: 'none',
                        MozAppearance: 'none',
                        border: 'none',
                        background: 'transparent',
                        color: theme.text,
                        fontSize: 16,
                        padding: 8,
                        marginRight: 4,
                        outline: 'none',
                        cursor: 'pointer'
                      };
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
                          <select
                            value={String(hour12)}
                            onChange={(e) => setFromParts(Number(e.target.value), minutes, isPM)}
                            style={selectStyle}
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                          <Text style={{ color: theme.text, fontSize: 16, paddingHorizontal: 2 }}>:</Text>
                          <select
                            value={String(minutes).padStart(2, '0')}
                            onChange={(e) => setFromParts(hour12, Number(e.target.value), isPM)}
                            style={selectStyle}
                          >
                            {Array.from({ length: 60 }, (_, i) => i).map(m => (
                              <option key={m} value={String(m).padStart(2,'0')}>{String(m).padStart(2,'0')}</option>
                            ))}
                          </select>
                          <select
                            value={isPM ? 'PM' : 'AM'}
                            onChange={(e) => setFromParts(hour12, minutes, e.target.value === 'PM')}
                            style={{ ...selectStyle, marginLeft: 4 }}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                      );
                    })()}
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.inputContainer}
                    onPress={handleOpenTimePicker}
                  >
                    <Ionicons name="time" size={16} color={theme.textSecondary} style={styles.inputIcon} />
                    <Text style={[styles.input, { color: startTime ? theme.text : theme.textSecondary }]}>
                      {startTime ? startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'اختر الوقت'}
                    </Text>
                  </TouchableOpacity>
                )}
                {Platform.OS !== 'web' && showTimePicker && (
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

const createStyles = (theme, { mapHeight, contentMaxWidth }) => StyleSheet.create({
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
    maxWidth: contentMaxWidth,
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
  scrollContent: {
    alignItems: 'center',
  },
  mapCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    width: '80%'
  },
  mapContainer: {
    height: mapHeight,
    position: 'relative',
  },
  map: {
    width: '100%',
    flex: 1,
  },
  mapLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  mapLoadingContent: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mapLoadingText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 12,
    textAlign: 'center',
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
    width: '100%',
    maxWidth: contentMaxWidth,
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
    position: 'relative',
    width: '100%',
    backgroundColor: 'transparent',
    // Add a subtle border to separate from content
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 5,
  },
  submitButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    width: 96,
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