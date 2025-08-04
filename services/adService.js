import { Platform } from 'react-native';

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
      
      // Production IDs - real AdMob IDs
      productionIds: {
        banner: Platform.select({
          ios: 'ca-app-pub-8401949226434611/7990084270', // Using Android ID for now
          android: 'ca-app-pub-8401949226434611/7990084270',
        }),
        interstitial: Platform.select({
          ios: 'ca-app-pub-8401949226434611/5012567140', // Using Android ID for now
          android: 'ca-app-pub-8401949226434611/5012567140',
        }),
      }
    };
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('AdService: Starting initialization...');
      
      // Initialize mobile ads with proper error handling
      const initializationStatus = await mobileAds().initialize();
      console.log('AdService: Mobile ads initialized with status:', initializationStatus);
      
      // Load initial interstitial ad
      await this.loadInterstitialAd();
      
      this.isInitialized = true;
      console.log('AdService: Initialized successfully');
    } catch (error) {
      console.error('AdService: Initialization failed:', error);
      // Don't throw the error, just log it and continue
      // This prevents the app from crashing if AdMob fails to initialize
    }
  }



  getAdUnitId(type) {
    // Use production IDs for real ads
    const unitId = this.config.productionIds[type];
    console.log(`AdService: Getting ${type} ad unit ID:`, unitId);
    return unitId;
  }

  async loadInterstitialAd() {
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
    console.log('AdService: Interstitial ad loaded:', this.interstitialAd?.loaded);

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
    console.log('AdService: Getting banner ad');

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
    return true; // Always show ads now
  }
}

// Export singleton instance
const adService = new AdService();
export default adService; 