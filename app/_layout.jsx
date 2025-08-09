// _layout.tsx
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Head } from 'expo-router/head';
import 'react-native-reanimated';
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';

import { useColorScheme } from '@/hooks/useColorScheme';
import { ThemeProvider } from '@/constants/ThemeContext';
import { AuthProvider } from '@/constants/AuthContext';
import { FavoritesProvider } from '@/constants/FavoritesContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setupNotificationHandler, getPendingFareResults } from '../services/backgroundTracking';
import locationService from '../services/locationService';
import adService from '../services/adService';
import BannerAdComponent from '../components/BannerAdComponent';

// Wrapper component to add banner ads to all screens
const ScreenWrapper = ({ children }) => {
  return (
    <View style={styles.screenWrapper}>
      <View style={styles.content}>
        {children}
      </View>
      <BannerAdComponent containerStyle={styles.bannerAdContainer} />
    </View>
  );
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Setup notification handler and initialize services
  useEffect(() => {
    setupNotificationHandler();
    locationService.initialize();
    
    // Initialize ad service with a small delay to ensure app is fully loaded
    const initializeAdService = async () => {
      try {
        // Small delay to ensure app is fully loaded before initializing ads
        await new Promise(resolve => setTimeout(resolve, 1000));
        await adService.initialize();
      } catch (error) {
        console.error('Failed to initialize ad service:', error);
      }
    };
    
    initializeAdService();
    
    // Check for pending fare results from notification
    const checkPendingResults = async () => {
      try {
        const pendingData = await getPendingFareResults();
        if (pendingData) {
          console.log('Found pending fare results, navigating...');
          // Navigate to fare results with the data
          router.push({
            pathname: '/(other)/FareResults',
            params: {
              from: pendingData.startLocation?.name || 'Unknown',
              to: pendingData.route?.[pendingData.route.length - 1]?.name || 'Unknown',
              time: new Date(pendingData.startTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
              duration: Math.round((Date.now() - new Date(pendingData.startTime).getTime()) / (1000 * 60)).toString(),
              passengers: '1',
              estimate: '38',
              distance: '0.00',
              governorate: 'Unknown',
              mode: 'track',
              tripData: JSON.stringify(pendingData)
            }
          });
        }
      } catch (error) {
        console.error('Error checking pending results:', error);
      }
    };
    
    checkPendingResults();
  }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <>

      <GestureHandlerRootView style={{ flex: 1 }}>
        <AuthProvider>
          <ThemeProvider>
            <FavoritesProvider>
            <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <Stack
              screenOptions={{
                headerShown: false,
                // Improved smooth transitions
                animation: 'slide_from_right',
                animationDuration: 250, // Shorter for snappier feel
                animationTypeForReplace: 'push',
                // Enhanced gesture handling
                gestureEnabled: true,
                gestureDirection: 'horizontal',
              }}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(other)" options={{ headerShown: false }} />
              <Stack.Screen 
                name="+not-found" 
                options={{
                  animation: 'fade',
                  animationDuration: 200,
                }}
              />
            </Stack>
            <StatusBar style="auto" />
            </NavigationThemeProvider>
          </FavoritesProvider>
        </ThemeProvider>
        </AuthProvider>
      </GestureHandlerRootView>
    </>
  );
}

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  content: {
    flex: 1,
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
});