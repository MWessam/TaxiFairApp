import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, Dimensions, ScrollView, Animated, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/constants/ThemeContext';
import { useAuth } from '@/constants/AuthContext';
import { getAvailableGovernorates } from '@/constants/Colors';
import { configureMapbox } from '@/mapboxProvider';
import LocationPermissionRequest from '../../components/LocationPermissionRequest';
import SignInScreen from '../../components/SignInScreen';
import locationService from '../../services/locationService';
import adService from '../../services/adService';
import BannerAdComponent from '../../components/BannerAdComponent';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function Home() {
  const router = useRouter();
  const { theme, currentGovernorate, changeGovernorate } = useTheme();
  const { user, loading: authLoading, isAuthenticated, signOut } = useAuth();
  const [showGovernorateModal, setShowGovernorateModal] = useState(false);
  const [isRouterReady, setIsRouterReady] = useState(false);
  const routerRef = useRef(router);
  const availableGovernorates = getAvailableGovernorates();
  const currentGovData = availableGovernorates.find(gov => gov.key === currentGovernorate);

  useEffect(() => {
    configureMapbox();
    
    // Ensure location service is initialized
    const initLocationService = async () => {
      if (!locationService.isInitialized) {
        console.log('Home: Initializing location service...');
        await locationService.initialize();
        console.log('Home: Location service initialized');
      }
    };
    
    initLocationService();
    
    // Ensure router is ready
    if (router) {
      routerRef.current = router;
      setIsRouterReady(true);
    } else {
      // Fallback: try to get router after a short delay
      const timer = setTimeout(() => {
        if (router) {
          routerRef.current = router;
          setIsRouterReady(true);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [router]);

  // Animation values for buttons
  const buttonScale1 = new Animated.Value(1);
  const buttonScale2 = new Animated.Value(1);
  const buttonScale3 = new Animated.Value(1);

  const handleGovernorateSelect = (governorateKey) => {
    changeGovernorate(governorateKey);
    setShowGovernorateModal(false);
  };

  const animateButton = (buttonScale, callback) => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Immediate navigation for snappy feel
      if (routerRef.current) {
        callback();
      } else {
        console.log('Router not available, retrying...');
        setTimeout(() => {
          if (routerRef.current) {
            callback();
          }
        }, 50);
      }
    });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تسجيل الخروج');
    }
  };

  const styles = createStyles(theme);

  // Show loading screen while auth is initializing
  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>جاري التحميل...</Text>
      </View>
    );
  }

  // Show sign-in screen if not authenticated
  if (!isAuthenticated) {
    return <SignInScreen />;
  }

  return (
    <View style={styles.container}>
      {/* Location Permission Request */}
      <LocationPermissionRequest />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity 
            style={styles.userButton} 
            onPress={handleSignOut}
          >
            <Ionicons name="person-circle" size={24} color={theme.primary} />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.appTitle}>تاكسي مصر</Text>
            <Text style={styles.subtitle}>تتبع أسعار التاكسي في مصر</Text>
            {user && (
              <Text style={styles.userInfo}>
                {user.displayName || user.email || 'مستخدم'}
              </Text>
            )}
          </View>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {/* Main content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.mainContent}>
          {/* Main Track Ride Button */}
          <Animated.View style={{ transform: [{ scale: buttonScale3 }] }}>
            <TouchableOpacity 
              style={styles.mainTrackButton} 
              onPress={() => animateButton(buttonScale3, () => routerRef.current?.push('/(other)/TrackRide'))}
              activeOpacity={0.95}
              delayPressIn={0}
              delayPressOut={0}
            >
              <Text style={styles.mainTrackButtonIcon}>📍</Text>
              <Text style={styles.mainTrackButtonText}>تتبع الرحلة</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Secondary Buttons Grid */}
          <View style={styles.secondaryButtonsGrid}>
            <Animated.View style={[styles.secondaryButtonContainer, { transform: [{ scale: buttonScale1 }] }]}>
              <TouchableOpacity 
                style={styles.secondaryButton} 
                onPress={() => animateButton(buttonScale1, () => routerRef.current?.push('/(other)/SubmitTrip'))}
                activeOpacity={0.95}
                delayPressIn={0}
                delayPressOut={0}
              >
                <Text style={styles.secondaryButtonIcon}>➕</Text>
                <Text style={styles.secondaryButtonText}>إضافة رحلة</Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[styles.secondaryButtonContainer, { transform: [{ scale: buttonScale2 }] }]}>
              <TouchableOpacity 
                style={styles.secondaryButton} 
                onPress={() => animateButton(buttonScale2, () => routerRef.current?.push('/(other)/SubmitTrip?mode=estimate'))}
                activeOpacity={0.95}
                delayPressIn={0}
                delayPressOut={0}
              >
                <Text style={styles.secondaryButtonIcon}>💰</Text>
                <Text style={styles.secondaryButtonText}>تقدير السعر</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>ساعد في تحسين أسعار التاكسي في مصر</Text>
          </View>
        </View>
      </ScrollView>

      {/* Governorate Selection Modal */}
      <Modal
        visible={showGovernorateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGovernorateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>اختر محافظتك</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowGovernorateModal(false)}
              >
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={availableGovernorates}
              keyExtractor={(item) => item.key}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.modalItem,
                    currentGovernorate === item.key && styles.selectedModalItem
                  ]}
                  onPress={() => handleGovernorateSelect(item.key)}
                >
                  <View style={[styles.modalItemColor, { backgroundColor: item.primary }]} />
                  <Text style={[
                    styles.modalItemText,
                    currentGovernorate === item.key && styles.selectedModalItemText
                  ]}>
                    {item.name}
                  </Text>
                  {currentGovernorate === item.key && (
                    <Ionicons name="checkmark" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>

      {/* Banner Ad */}
      <BannerAdComponent containerStyle={styles.bannerAdContainer} />
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5', // Light gray background like web version
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  userButton: {
    padding: 8,
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerSpacer: {
    width: 50, // Space for the user button
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#5C2633', // Primary color from web version
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666', // Secondary text color
    textAlign: 'center',
  },
  userInfo: {
    fontSize: 14,
    color: '#666666',
    marginTop: 5,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 60, // Add padding for banner ad
  },
  bannerAdContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  themeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  themeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  themeCardIcon: {
    fontSize: 20,
    marginRight: 8,
    color: '#5C2633',
  },
  themeCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeButton: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e5e5',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  selectedThemeButton: {
    borderColor: '#5C2633',
    backgroundColor: 'rgba(92, 38, 51, 0.1)',
  },
  themeColorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  themeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  selectedThemeButtonText: {
    color: '#5C2633',
  },
  mainTrackButton: {
    backgroundColor: '#5C2633',
    height: 64,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#5C2633',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  mainTrackButtonIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  mainTrackButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  secondaryButtonsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 40,
  },
  secondaryButtonContainer: {
    flex: 1,
  },
  secondaryButton: {
    width: '100%',
    height: 64, // Match the height of the main track button
    borderWidth: 2,
    borderColor: '#5C2633',
    borderRadius: 16, // Match the border radius of the main track button
    backgroundColor: '#5C2633',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5C2633',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  secondaryButtonIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    textAlignVertical: 'center',
    width: 80,
  },
  footer: {
    alignItems: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: height * 0.7,
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  modalCloseButton: {
    padding: 5,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  selectedModalItem: {
    backgroundColor: '#f5f5f5',
  },
  modalItemColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 15,
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  modalItemText: {
    flex: 1,
    fontSize: 18,
    color: '#1a1a1a',
  },
  selectedModalItemText: {
    fontWeight: 'bold',
    color: '#5C2633',
  },
  checkmark: {
    fontSize: 18,
    color: '#5C2633',
    fontWeight: 'bold',
  },
  premiumButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFD700',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFA500',
  },
  premiumButtonText: {
    fontSize: 14,
    color: '#8B4513',
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
}); 