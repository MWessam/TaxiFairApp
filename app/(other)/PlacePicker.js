import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Modal, Dimensions, Alert, ScrollView } from 'react-native';
import MapView, { MapboxGL } from '@/components/MapView';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Location from 'expo-location';
import { searchPlacesMapbox, reverseGeocode } from '../../routeHelpers';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { useFavorites } from '@/constants/FavoritesContext';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function PlacePicker() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { theme } = useTheme();
  const { favorites, loading: favoritesLoading, removeFavorite } = useFavorites();
  const type = params.type; // 'from' or 'to'

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [mapPin, setMapPin] = useState(null);
  const [pinAddress, setPinAddress] = useState('جاري تحديد الموقع...');
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [isMapDragging, setIsMapDragging] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const debounceRef = useRef();
  const mapRef = useRef();
  const cameraRef = useRef();

  // Get current location on component mount
  useEffect(() => {
    let isMounted = true;
    
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted' && isMounted) {
          let loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
          });
          if (isMounted) {
            const currentCoords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
            console.log('Initial location:', currentCoords); // Debug log
            
            // Validate coordinates are not at (0,0) or invalid
            if (currentCoords.latitude === 0 && currentCoords.longitude === 0) {
              console.log('Invalid coordinates detected, using fallback');
              const fallbackCoords = { latitude: 30.0444, longitude: 31.2357 };
              setCurrentLocation(fallbackCoords);
              setMapPin(fallbackCoords);
              setPinAddress('ميدان التحرير، القاهرة');
              return;
            }
            
            setCurrentLocation(currentCoords);
            setMapPin(currentCoords);
            // Update pin address for current location
            try {
              const address = await reverseGeocode(currentCoords.latitude, currentCoords.longitude);
              setPinAddress(address || 'موقعك الحالي');
            } catch (err) {
              setPinAddress('موقعك الحالي');
            }
          }
        } else {
          console.log('Location permission denied, using Cairo as default');
          // Don't show alert - just use default location silently
          const fallbackCoords = { latitude: 30.0444, longitude: 31.2357 };
          setCurrentLocation(fallbackCoords);
          setMapPin(fallbackCoords);
          setPinAddress('ميدان التحرير، القاهرة');
        }
      } catch (error) {
        console.log('Location error:', error);
        // Fallback to Cairo if location fails - no alert needed
        const fallbackCoords = { latitude: 30.0444, longitude: 31.2357 };
        setCurrentLocation(fallbackCoords);
        setMapPin(fallbackCoords);
        setPinAddress('ميدان التحرير، القاهرة');
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Search locations
  const debouncedSearch = (query) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchPlaces(query), 400);
  };

  const searchPlaces = async (query) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      // Pass currentLocation only if it exists, otherwise search will use default location
      const data = await searchPlacesMapbox(query, currentLocation || null);
      setResults(data);
    } catch (err) {
      console.log('Search error:', err);
      setResults([]);
    }
    setLoading(false);
  };

  // Handle text input change
  const handleInputChange = (value) => {
    setSearchQuery(value);
    debouncedSearch(value);
  };

  // Handle selecting a location from the list
  const handleLocationSelect = (item) => {
    const loc = {
      name: item.display_name || item.name,
      lat: parseFloat(item.lat) || item.lat,
      lng: parseFloat(item.lon || item.lng) || item.lng,
    };

    // Check if user is trying to select the same location for both from and to
    const otherLocation = type === 'from' ? 
      { name: params.to_name, lat: params.to_lat, lng: params.to_lng } : 
      { name: params.from_name, lat: params.from_lat, lng: params.from_lng };

    if (otherLocation.name && otherLocation.lat && otherLocation.lng) {
      // Check if locations are the same
      if (Math.abs(loc.lat - parseFloat(otherLocation.lat)) < 0.0001 && 
          Math.abs(loc.lng - parseFloat(otherLocation.lng)) < 0.0001) {
        Alert.alert('تنبيه', 'لا يمكن اختيار نفس الموقع لنقطة البداية والوجهة');
        return;
      }
    }

    // Preserve existing location data
    const navigationParams = {
      [`${type}_lat`]: loc.lat,
      [`${type}_lng`]: loc.lng,
      [`${type}_name`]: loc.name,
    };

    // Add existing location data for the other field
    if (type === 'from') {
      // Preserve existing 'to' location if it exists
      if (params.to_lat && params.to_lng && params.to_name) {
        navigationParams.to_lat = params.to_lat;
        navigationParams.to_lng = params.to_lng;
        navigationParams.to_name = params.to_name;
      }
    } else {
      // Preserve existing 'from' location if it exists
      if (params.from_lat && params.from_lng && params.from_name) {
        navigationParams.from_lat = params.from_lat;
        navigationParams.from_lng = params.from_lng;
        navigationParams.from_name = params.from_name;
      }
    }

    // Preserve the mode parameter if it exists
    if (params.mode) {
      navigationParams.mode = params.mode;
    }

    // Navigate back with the selected location
    router.back();
    // Use setTimeout to ensure the navigation happens after the current render cycle
    setTimeout(() => {
      router.replace({
        pathname: '/(other)/SubmitTrip',
        params: navigationParams,
      });
    }, 50);
  };

  // Handle favorite location selection
  const handleFavoriteLocationSelect = (favorite) => {
    console.log('Favorite selected:', favorite); // Debug log
    console.log('Selection type:', type); // Debug log
    
    // Now favorite is the location itself (not a route)
    const location = {
      name: favorite.name,
      lat: favorite.lat,
      lng: favorite.lng
    };
    console.log('Selected location:', location); // Debug log
    
    if (!location.name || !location.lat || !location.lng) {
      Alert.alert('خطأ', 'بيانات الموقع المحفوظ غير مكتملة');
      return;
    }

    // Check if user is trying to select the same location for both from and to
    const otherLocation = type === 'from' ? 
      { name: params.to_name, lat: params.to_lat, lng: params.to_lng } : 
      { name: params.from_name, lat: params.from_lat, lng: params.from_lng };

    if (otherLocation.name && otherLocation.lat && otherLocation.lng) {
      // Check if locations are the same
      if (Math.abs(location.lat - parseFloat(otherLocation.lat)) < 0.0001 && 
          Math.abs(location.lng - parseFloat(otherLocation.lng)) < 0.0001) {
        Alert.alert('تنبيه', 'لا يمكن اختيار نفس الموقع لنقطة البداية والوجهة');
        return;
      }
    }
    
    handleLocationSelect(location);
  };

  // Handle deleting a favorite
  const handleDeleteFavorite = async (favoriteId, event) => {
    // Prevent the selection when deleting
    event.stopPropagation();
    
    try {
      const result = await removeFavorite(favoriteId);
      if (!result.success && result.error) {
        Alert.alert('خطأ', result.error);
      }
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء حذف المفضلة');
    }
  };

  // Map logic
  const openMap = async () => {
    try {
      // Try to get current location, but don't fail if permission denied
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
        });
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        console.log('Current location:', coords); // Debug log
        
        // Validate coordinates are not at (0,0) or invalid
        if (coords.latitude === 0 && coords.longitude === 0) {
          console.log('Invalid coordinates, using Cairo default');
          const fallbackCoords = { latitude: 30.0444, longitude: 31.2357 };
          setCurrentLocation(fallbackCoords);
          setMapPin(fallbackCoords);
          setShowMap(true);
          return;
        }
        
        setCurrentLocation(coords);
        setMapPin(coords);
        setShowMap(true);
      } else {
        console.log('Location permission denied, opening map with Cairo default');
        // Permission denied - still open map with Cairo default
        const fallbackCoords = { latitude: 30.0444, longitude: 31.2357 };
        setCurrentLocation(fallbackCoords);
        setMapPin(fallbackCoords);
        setShowMap(true);
      }
    } catch (error) {
      console.log('Location error:', error);
      console.log('Opening map with Cairo default due to location error');
      // Location failed - still open map with Cairo default
      const fallbackCoords = { latitude: 30.0444, longitude: 31.2357 };
      setCurrentLocation(fallbackCoords);
      setMapPin(fallbackCoords);
      setShowMap(true);
    }
  };

  // When map pin moves, reverse geocode
  React.useEffect(() => {
    if (showMap && mapPin && mapPin.latitude && mapPin.longitude && mapPin.latitude !== 0 && mapPin.longitude !== 0) {
      // Set loading state immediately when pin moves
      setIsAddressLoading(true);
      setPinAddress('...');
      
      // Debounce the reverse geocoding to avoid too many API calls
      const timeoutId = setTimeout(() => {
        console.log('Reverse geocoding for:', mapPin); // Debug log
        reverseGeocode(mapPin.latitude, mapPin.longitude).then(address => {
          setPinAddress(address || 'موقع غير محدد');
          setIsAddressLoading(false);
        }).catch(err => {
          console.error('Reverse geocoding error:', err);
          setPinAddress('موقع غير محدد');
          setIsAddressLoading(false);
        });
      }, 300); // Increased debounce time for better performance

      return () => clearTimeout(timeoutId);
    }
  }, [mapPin?.latitude, mapPin?.longitude, showMap]);

  // Debounced map pin update for smoother dragging experience
  const debouncedSetMapPin = React.useCallback(
    React.useMemo(() => {
      let timeoutId;
      return (coords) => {
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setMapPin(coords);
        }, 100); // Small delay for smoother updates
      };
    }, []),
    []
  );

  // Handle picking from map
  const handleMapLocationSelect = () => {
    if (!mapPin || !mapPin.latitude || !mapPin.longitude) {
      Alert.alert('خطأ', 'يرجى اختيار موقع صحيح من الخريطة');
      return;
    }
    
    const loc = {
      name: pinAddress,
      lat: mapPin.latitude,
      lng: mapPin.longitude,
    };
    
    setShowMap(false);
    handleLocationSelect(loc);
  };

  // Handle getting current location
  const handleCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeInterval: 5000,
      });
      const newPin = { latitude: location.coords.latitude, longitude: location.coords.longitude };
      
      // Validate coordinates
      if (newPin.latitude === 0 && newPin.longitude === 0) {
        console.log('Invalid coordinates from current location, keeping current pin');
        return;
      }
      
      setMapPin(newPin);
      
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: [newPin.longitude, newPin.latitude],
          zoomLevel: 16,
          animationDuration: 1000,
        });
      }
    } catch (error) {
      console.log('Could not get current location:', error);
      // Don't show alert - just log the error and keep current functionality
      // User can still manually move the map or search for locations
    }
  };

  // useEffect(() => {
  //   if (cameraRef.current && mapPin && mapPin.latitude && mapPin.longitude && showMap) {
  //     console.log('Setting camera to:', mapPin); // Debug log
  //     cameraRef.current.setCamera({
  //       centerCoordinate: [mapPin.longitude, mapPin.latitude],
  //       zoomLevel: 16,
  //       animationDuration: 500,
  //     });
  //   }
  // }, [showMap, mapPin]);

  const styles = createStyles(theme);
  const headerTitle = type === 'from' ? 'اختر نقطة البداية' : 'اختر الوجهة';

  if (showMap) {
    return (
      <Modal visible={showMap} animationType="slide" presentationStyle="fullScreen">
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            center={currentLocation ? [currentLocation.longitude, currentLocation.latitude] : [31.2357, 30.0444]}
            zoom={16}
            onRegionIsChanging={(e) => {
              console.log('🔄 PlacePicker received onRegionIsChanging:', e);
              setIsMapDragging(true); // Set dragging state to true
              try {
                // Support both native (@rnmapbox/maps) and web wrapper event shapes
                if (e && e.geometry && Array.isArray(e.geometry.coordinates)) {
                  const [lng, lat] = e.geometry.coordinates;
                  console.log('📍 Setting mapPin from onRegionIsChanging:', { lat, lng });
                  debouncedSetMapPin({ latitude: lat, longitude: lng });
                } else if (e && e.nativeEvent && e.nativeEvent.geometry && Array.isArray(e.nativeEvent.geometry.coordinates)) {
                  const [lng, lat] = e.nativeEvent.geometry.coordinates;
                  console.log('📍 Setting mapPin from onRegionIsChanging nativeEvent:', { lat, lng });
                  debouncedSetMapPin({ latitude: lat, longitude: lng });
                } else {
                  console.warn('⚠️ PlacePicker: Could not extract coordinates from onRegionIsChanging event:', e);
                }
              } catch (error) {
                console.log('❌ PlacePicker onRegionIsChanging error:', error);
              }
            }}
            onRegionDidChange={(e) => {
              console.log('🎯 PlacePicker received onRegionDidChange:', e);
              setIsMapDragging(false); // Set dragging state to false
              try {
                // Support both native (@rnmapbox/maps) and web wrapper event shapes
                if (e && e.geometry && Array.isArray(e.geometry.coordinates)) {
                  const [lng, lat] = e.geometry.coordinates;
                  console.log('📍 Setting mapPin from onRegionDidChange:', { lat, lng });
                  setMapPin({ latitude: lat, longitude: lng });
                } else if (e && e.nativeEvent && e.nativeEvent.geometry && Array.isArray(e.nativeEvent.geometry.coordinates)) {
                  const [lng, lat] = e.nativeEvent.geometry.coordinates;
                  console.log('📍 Setting mapPin from onRegionDidChange nativeEvent:', { lat, lng });
                  setMapPin({ latitude: lat, longitude: lng });
                } else {
                  console.warn('⚠️ PlacePicker: Could not extract coordinates from onRegionDidChange event:', e);
                }
              } catch (error) {
                console.log('❌ PlacePicker onRegionDidChange error:', error);
              }
            }}
            onClick={([lng, lat]) => {
              console.log('Map clicked at:', { lat, lng });
              setMapPin({ latitude: lat, longitude: lng });
            }}
          >
            {/* Native-specific children will be rendered only on native platforms */}
            {(currentLocation || { latitude: 30.0444, longitude: 31.2357 }) && (
              <MapboxGL.Camera
                ref={cameraRef}
                centerCoordinate={[currentLocation?.longitude || 31.2357, currentLocation?.latitude || 30.0444]}
                zoomLevel={16}
                animationDuration={0}
                animationType="none"
              />
            )}

            {currentLocation && (
              <MapboxGL.UserLocation
                visible={true}
                showsUserHeadingIndicator={true}
              />
            )}
          </MapView>

          {/* Center Pin */}
          <View style={styles.centerPin}>
            <Ionicons name="location" size={32} color={theme.primary} />
            <View style={[styles.pinLabel, (isAddressLoading || isMapDragging) && styles.pinLabelLoading]}>
              <Text style={styles.pinLabelText} numberOfLines={1}>
                {isMapDragging ? 'جاري التحديث...' : (isAddressLoading ? '...' : pinAddress)}
              </Text>
            </View>
          </View>

          {/* Current Location Button */}
          <TouchableOpacity style={styles.currentLocationButton} onPress={handleCurrentLocation}>
            <Ionicons name="navigate" size={20} color="#3B82F6" />
          </TouchableOpacity>

          {/* Bottom Controls */}
          <View style={styles.mapBottomPanel}>
            <View style={styles.mapBottomContent}>
              {!currentLocation && (
                <View style={styles.locationNotice}>
                  <Ionicons name="information-circle" size={16} color={theme.primary} />
                  <Text style={styles.locationNoticeText}>
                    يمكنك التنقل في الخريطة والبحث عن المواقع يدوياً
                  </Text>
                </View>
              )}
              <View style={styles.locationTitleContainer}>
                <Text style={styles.mapLocationTitle} numberOfLines={2}>
                  {isMapDragging ? 'جاري التحديث...' : (isAddressLoading ? '...' : pinAddress)}
                </Text>
                {(isAddressLoading || isMapDragging) && (
                  <ActivityIndicator size="small" color={theme.primary} style={styles.loadingIndicator} />
                )}
              </View>
              <Text style={styles.mapLocationSubtitle}>
                {isMapDragging ? 'حرك الخريطة لاختيار المكان' : (isAddressLoading ? 'جاري تحديد العنوان...' : 'حرك الخريطة لاختيار المكان')}
              </Text>

              <View style={styles.mapButtonsRow}>
                <TouchableOpacity 
                  style={[styles.mapCancelButton, (isAddressLoading || isMapDragging) && styles.disabledButton]} 
                  onPress={() => setShowMap(false)}
                  disabled={isAddressLoading || isMapDragging}
                >
                  <Text style={[styles.mapCancelButtonText, (isAddressLoading || isMapDragging) && styles.disabledButtonText]}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.mapConfirmButton, (isAddressLoading || isMapDragging) && styles.disabledButton]} 
                  onPress={handleMapLocationSelect}
                  disabled={isAddressLoading || isMapDragging}
                >
                  <Text style={[styles.mapConfirmButtonText, (isAddressLoading || isMapDragging) && styles.disabledButtonText]}>تأكيد الموقع</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-forward" size={20} color={theme.text} style = {styles.backButtonIcon}/>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{headerTitle}</Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Search Section */}
        <View style={styles.searchSection}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن مكان..."
              value={searchQuery}
              onChangeText={handleInputChange}
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </View>

        {/* Map Option */}
        <View style={styles.mapOptionSection}>
          <TouchableOpacity style={styles.mapOptionButton} onPress={openMap}>
            <Ionicons name="map" size={20} color="#3B82F6" style={styles.mapOptionIcon} />
            <Text style={styles.mapOptionText}>اختر من الخريطة</Text>
          </TouchableOpacity>
          {!currentLocation && (
            <Text style={styles.mapOptionSubtext}>
              يمكنك استخدام الخريطة حتى بدون تحديد موقعك الحالي
            </Text>
          )}
        </View>

        {/* Favorite Locations (when no search) */}
        {!searchQuery && (
          <View style={styles.favoritesSection}>
            <View style={styles.sectionHeader}>
              <Ionicons name="heart" size={20} color={theme.primary} />
              <Text style={styles.sectionTitle}>المواقع المفضلة</Text>
            </View>
            {favoritesLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : favorites.length === 0 ? (
              <View style={styles.noFavoritesContainer}>
                <Text style={styles.noFavoritesText}>لا توجد مواقع مفضلة بعد</Text>
                <Text style={styles.noFavoritesSubtext}>ستظهر هنا المواقع التي تضيفها للمفضلة</Text>
              </View>
            ) : (
              <View style={styles.locationsList}>
                {favorites.map((favorite) => {
                  return (
                    <TouchableOpacity
                      key={favorite.id}
                      style={styles.favoriteCard}
                      onPress={() => handleFavoriteLocationSelect(favorite)}
                    >
                      <Text style={styles.locationIcon}>⭐</Text>
                      <View style={styles.locationInfo}>
                        <Text style={styles.locationName} numberOfLines={2}>
                          {favorite.name}
                        </Text>
                        <Text style={styles.locationArea} numberOfLines={1}>
                          موقع مفضل
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={(event) => handleDeleteFavorite(favorite.id, event)}
                      >
                        <Ionicons name="trash" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Loading Indicator */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}

        {/* Search Results */}
        {searchQuery && (
          <View style={styles.resultsSection}>
            <View style={styles.locationsList}>
              {results.map((item, index) => (
                <TouchableOpacity
                  key={item.place_id?.toString() || index}
                  style={styles.locationCard}
                  onPress={() => handleLocationSelect(item)}
                >
                  <Text style={styles.locationIcon}>📍</Text>
                  <View style={styles.locationInfo}>
                    <Text style={styles.locationName} numberOfLines={2}>
                      {item.display_name}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              
              {!loading && results.length === 0 && searchQuery && (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>لا توجد نتائج للبحث "{searchQuery}"</Text>
                </View>
              )}
            </View>
          </View>
        )}
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
    paddingTop: 50,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonIcon: {
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
    paddingBottom: 60, // Add padding for banner ad
  },
  searchSection: {
    padding: 16,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchIcon: {
    marginLeft: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 18,
    color: theme.text,
    paddingVertical: 12,
  },
  mapOptionSection: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  mapOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.border,
  },
  mapOptionIcon: {
    marginLeft: 8,
  },
  mapOptionText: {
    fontSize: 16,
    color: theme.text,
    flex: 1,
  },
  mapOptionSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  favoritesSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.text,
    marginLeft: 8,
  },
  locationsList: {
    gap: 8,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  locationIcon: {
    fontSize: 24,
    marginLeft: 12,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.text,
    marginBottom: 2,
  },
  locationArea: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  favoriteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  noFavoritesContainer: {
    padding: 32,
    alignItems: 'center',
  },
  noFavoritesText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  noFavoritesSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    opacity: 0.7,
  },
  resultsSection: {
    paddingHorizontal: 16,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  noResultsContainer: {
    padding: 32,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  // Map Styles
  mapContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  map: {
    flex: 1,
  },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -16 }, { translateY: -32 }],
    zIndex: 10,
    alignItems: 'center',
    pointerEvents: 'none',
    width: 32,
    height: 32,
    justifyContent: 'center',
  },
  pinLabel: {
    display: 'flex', // Changed from 'none' to 'flex' to show during dragging
    width: '100%',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: 200,
  },
  pinLabelLoading: {
    backgroundColor: '#F0F9FF',
    borderColor: theme.primary,
    borderWidth: 1,
  },
  pinLabelText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.text,
    textAlign: 'center',
  },
  currentLocationButton: {
    position: 'absolute',
    bottom: 140,
    right: 16,
    backgroundColor: '#FFFFFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  mapBottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  mapBottomContent: {
    padding: 16,
  },
  locationTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  mapLocationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.text,
    textAlign: 'center',
    flex: 1,
  },
  loadingIndicator: {
    marginLeft: 8,
  },
  mapLocationSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  mapButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mapCancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  mapCancelButtonText: {
    fontSize: 16,
    color: theme.text,
  },
  mapConfirmButton: {
    flex: 1,
    backgroundColor: theme.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  mapConfirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    opacity: 0.7,
  },
  locationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E0F2FE',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignSelf: 'center',
  },
  locationNoticeText: {
    fontSize: 14,
    color: theme.primary,
    marginLeft: 8,
    fontWeight: '500',
  },
});
