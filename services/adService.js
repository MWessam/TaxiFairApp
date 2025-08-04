import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// AdMob package is uninstalled - using placeholder implementation
// import mobileAds, {
//   BannerAd,
//   BannerAdSize,
//   TestIds,
//   InterstitialAd,
//   AdEventType,
// } from 'react-native-google-mobile-ads';

class AdService {
  constructor() {
    this.isInitialized = false;
    this.interstitialAd = null;
    this.adCount = 0;
    this.lastAdTime = 0;
    this.isPremiumUser = false;
    
    // Ad configuration - adjust these for your needs
    this.config = {
      // Minimum time between interstitial ads (in milliseconds)
      minAdInterval: 60000, // 1 minute
      
      // Maximum ads per session
      maxAdsPerSession: 3,
      
      // Test IDs for development (placeholder since AdMob is uninstalled)
      testIds: {
        banner: 'placeholder-banner-id',
        interstitial: 'placeholder-interstitial-id',
      },
      
      // Production IDs - replace with your actual AdMob IDs
      productionIds: {
        banner: Platform.select({
          ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
          android: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
        }),
        interstitial: Platform.select({
          ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ',
          android: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ',
        }),
      }
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('AdService: Starting initialization...');
      
      // AdMob is uninstalled - skip mobile ads initialization
      // await mobileAds().initialize();
      console.log('AdService: Mobile ads initialization skipped (AdMob uninstalled)');
      
      // Check if user is premium
      await this.checkPremiumStatus();
      console.log('AdService: Premium status checked:', this.isPremiumUser);
      
      // Load initial interstitial ad
      if (!this.isPremiumUser) {
        await this.loadInterstitialAd();
      }
      
      this.isInitialized = true;
      console.log('AdService: Initialized successfully (AdMob disabled)');
    } catch (error) {
      console.error('AdService: Initialization failed:', error);
    }
  }

  async checkPremiumStatus() {
    try {
      const premiumStatus = await AsyncStorage.getItem('isPremiumUser');
      this.isPremiumUser = premiumStatus === 'true';
      console.log('AdService: Premium status from storage:', premiumStatus);
    } catch (error) {
      console.error('AdService: Error checking premium status:', error);
      this.isPremiumUser = false;
    }
  }

  async setPremiumStatus(isPremium) {
    try {
      await AsyncStorage.setItem('isPremiumUser', isPremium.toString());
      this.isPremiumUser = isPremium;
      console.log('AdService: Premium status set to:', isPremium);
      
      if (isPremium) {
        // Clean up ads for premium users
        this.interstitialAd = null;
      } else {
        // Load ads for non-premium users
        await this.loadInterstitialAd();
      }
    } catch (error) {
      console.error('AdService: Error setting premium status:', error);
    }
  }

  getAdUnitId(type) {
    // Return placeholder IDs since AdMob is uninstalled
    console.log(`AdService: Getting ${type} ad unit ID (AdMob uninstalled)`);
    return 'placeholder-ad-unit-id';
  }

  async loadInterstitialAd() {
    if (this.isPremiumUser) {
      console.log('AdService: Skipping ad load - user is premium');
      return;
    }

    try {
      console.log('AdService: Loading interstitial ad (AdMob uninstalled)');
      // Create placeholder interstitial ad object
      this.interstitialAd = { loaded: false };
      console.log('AdService: Interstitial ad load skipped (AdMob uninstalled)');
    } catch (error) {
      console.error('AdService: Error loading interstitial ad:', error);
    }
  }

  async showInterstitialAd() {
    console.log('AdService: Attempting to show interstitial ad...');
    console.log('AdService: Premium user:', this.isPremiumUser);
    console.log('AdService: Interstitial ad loaded:', this.interstitialAd?.loaded);
    
    if (this.isPremiumUser) {
      console.log('AdService: Skipping ad - user is premium');
      return false;
    }

    const now = Date.now();
    
    // Check if enough time has passed since last ad
    if (now - this.lastAdTime < this.config.minAdInterval) {
      console.log('AdService: Ad shown too recently, skipping');
      return false;
    }

    // Check if we've shown too many ads this session
    if (this.adCount >= this.config.maxAdsPerSession) {
      console.log('AdService: Maximum ads per session reached');
      return false;
    }

    if (this.interstitialAd && this.interstitialAd.loaded) {
      try {
        await this.interstitialAd.show();
        this.adCount++;
        this.lastAdTime = now;
        console.log('AdService: Interstitial ad shown successfully');
        return true;
      } catch (error) {
        console.error('AdService: Error showing interstitial ad:', error);
        return false;
      }
    } else {
      console.log('AdService: Interstitial ad not ready, attempting to load new ad');
      // Try to load a new ad
      await this.loadInterstitialAd();
      return false;
    }
  }

  // Show ad when user tries to go back from fare results
  async showAdWhenGoingBackFromResults() {
    console.log('AdService: Showing ad when going back from results');
    return await this.showInterstitialAd();
  }

  // Show ad after trip estimation (not tracking)
  async showAdAfterTripEstimation() {
    console.log('AdService: Showing ad after trip estimation');
    return await this.showInterstitialAd();
  }

  // Reset ad count for new session
  resetAdCount() {
    this.adCount = 0;
    this.lastAdTime = 0;
    console.log('AdService: Ad count reset');
  }

  // Get banner ad component
  getBannerAd() {
    console.log('AdService: Getting banner ad, premium user:', this.isPremiumUser);
    
    if (this.isPremiumUser) {
      console.log('AdService: Skipping banner ad - user is premium');
      return null;
    }

    // Return null since AdMob is uninstalled
    console.log('AdService: Banner ad disabled (AdMob uninstalled)');
    return null;
  }

  // Check if user should see ads
  shouldShowAds() {
    const shouldShow = !this.isPremiumUser;
    console.log('AdService: Should show ads:', shouldShow);
    return shouldShow;
  }
}

// Export singleton instance
const adService = new AdService();
export default adService; 