import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import mobileAds, {
  BannerAd,
  BannerAdSize,
  TestIds,
  InterstitialAd,
  AdEventType,
} from 'react-native-google-mobile-ads';

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
      
      // Test IDs for development
      testIds: {
        banner: TestIds.BANNER,
        interstitial: TestIds.INTERSTITIAL,
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
      
      // Initialize mobile ads
      await mobileAds().initialize();
      console.log('AdService: Mobile ads initialized');
      
      // Check if user is premium
      await this.checkPremiumStatus();
      console.log('AdService: Premium status checked:', this.isPremiumUser);
      
      // Load initial interstitial ad
      if (!this.isPremiumUser) {
        await this.loadInterstitialAd();
      }
      
      this.isInitialized = true;
      console.log('AdService: Initialized successfully');
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
    // Force test IDs for now to ensure ads show
    const isDevelopment = __DEV__;
    const unitId = isDevelopment ? this.config.testIds[type] : this.config.productionIds[type];
    console.log(`AdService: Getting ${type} ad unit ID:`, unitId, 'Development:', isDevelopment);
    return unitId;
  }

  async loadInterstitialAd() {
    if (this.isPremiumUser) {
      console.log('AdService: Skipping ad load - user is premium');
      return;
    }

    try {
      console.log('AdService: Loading interstitial ad...');
      this.interstitialAd = InterstitialAd.createForAdRequest(
        this.getAdUnitId('interstitial'),
        {
          requestNonPersonalizedAdsOnly: true,
          keywords: ['taxi', 'transportation', 'travel'],
        }
      );

      const unsubscribeLoaded = this.interstitialAd.addAdEventListener(
        AdEventType.LOADED,
        () => {
          console.log('AdService: Interstitial ad loaded successfully');
        }
      );

      const unsubscribeClosed = this.interstitialAd.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          console.log('AdService: Interstitial ad closed');
          // Load the next ad
          this.loadInterstitialAd();
        }
      );

      const unsubscribeError = this.interstitialAd.addAdEventListener(
        AdEventType.ERROR,
        (error) => {
          console.error('AdService: Interstitial ad error:', error);
        }
      );

      await this.interstitialAd.load();
      console.log('AdService: Interstitial ad load request sent');
      
      return () => {
        unsubscribeLoaded();
        unsubscribeClosed();
        unsubscribeError();
      };
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

    const bannerAd = (
      <BannerAd
        unitId={this.getAdUnitId('banner')}
        size={BannerAdSize.BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
          keywords: ['taxi', 'transportation', 'travel'],
        }}
        onAdLoaded={() => {
          console.log('AdService: Banner ad loaded successfully');
        }}
        onAdFailedToLoad={(error) => {
          console.error('AdService: Banner ad failed to load:', error);
        }}
      />
    );
    
    console.log('AdService: Banner ad component created');
    return bannerAd;
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