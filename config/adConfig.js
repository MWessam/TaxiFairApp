// AdMob Configuration for mobile and AdSense for web
// Replace these with your actual AdMob ad unit IDs and AdSense configuration

export const AD_CONFIG = {
  // Test IDs (for development)
  test: {
    banner: 'ca-app-pub-3940256099942544/6300978111',
    interstitial: 'ca-app-pub-3940256099942544/1033173712',
    rewarded: 'ca-app-pub-3940256099942544/5224354917',
  },
  
  // Production IDs (replace with your actual IDs)
  production: {
    // Android
    android: {
      banner: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
      interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ',
      rewarded: 'ca-app-pub-XXXXXXXXXXXXXXXX/WWWWWWWWWW',
    },
    
    // iOS
    ios: {
      banner: 'ca-app-pub-XXXXXXXXXXXXXXXX/YYYYYYYYYY',
      interstitial: 'ca-app-pub-XXXXXXXXXXXXXXXX/ZZZZZZZZZZ',
      rewarded: 'ca-app-pub-XXXXXXXXXXXXXXXX/WWWWWWWWWW',
    },
    
    // Web (AdSense)
    web: {
      // Replace with your actual AdSense publisher ID and ad unit IDs
      publisherId: 'ca-pub-8401949226434611', // ← Your actual Publisher ID
      banner: {
        // Standard banner ad unit
        slot: '6808201836', // ← Your actual Ad Unit ID
        format: 'auto',
        responsive: true,
      },
      // Add more ad formats as needed
      rectangle: {
        slot: 'ZZZZZZZZZZ',
        format: 'rectangle',
        responsive: true,
      },
    },
  },
  
  // AdSense specific configuration for web
  adsense: {
    // Test mode for development
    test: {
      enabled: true,
      publisherId: 'ca-pub-test',
      testSlot: '1234567890',
    },
    
    // AdSense settings
    settings: {
      // Auto ads configuration
      autoAds: {
        enabled: true,
        // Types of auto ads to show
        pageLevel: true,
        anchor: true,
        multiplex: true,
      },
      
      // Manual ad settings
      manualAds: {
        enabled: true,
        lazyLoading: true,
        refreshInterval: 30000, // 30 seconds
      },
      
      // Privacy and compliance
      privacy: {
        nonPersonalizedAds: true,
        cookieConsent: true,
      },
    },
  },
  
  // App ID (replace with your actual AdMob app ID)
  appId: {
    android: 'ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY',
    ios: 'ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY',
  },
  
  // Ad display settings
  settings: {
    // Minimum time between interstitial ads (in milliseconds)
    minAdInterval: 60000, // 1 minute
    
    // Maximum ads per session
    maxAdsPerSession: 5, // Increased for more ad opportunities
    
    // Show ads after specific actions
    showWhenGoingBackFromResults: true,
    showAfterTripEstimation: true,
    showAfterAppLaunch: true, // Show ads immediately on launch
    
    // Banner ad settings
    bannerRefreshInterval: 60000, // 1 minute
    
    // Show banner ads on all screens
    showBannerOnAllScreens: true,
  },
};

// Helper function to get ad unit ID based on platform and type
export const getAdUnitId = (type, platform = null) => {
  // For web environment, we need to handle this differently
  if (typeof window !== 'undefined') {
    // We're in a web environment
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      return AD_CONFIG.adsense.test.testSlot;
    }
    
    return AD_CONFIG.production.web[type]?.slot || AD_CONFIG.production.web.banner.slot;
  }
  
  // For mobile platforms
  const currentPlatform = platform || (typeof Platform !== 'undefined' ? Platform.OS : 'web');
  const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development';
  
  if (isDevelopment) {
    return AD_CONFIG.test[type];
  }
  
  return AD_CONFIG.production[currentPlatform][type];
};

// Helper function to get app ID
export const getAppId = (platform = null) => {
  if (typeof window !== 'undefined') {
    // Web environment - return AdSense publisher ID
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      return AD_CONFIG.adsense.test.publisherId;
    }
    
    return AD_CONFIG.production.web.publisherId;
  }
  
  // Mobile platforms
  const currentPlatform = platform || (typeof Platform !== 'undefined' ? Platform.OS : 'web');
  return AD_CONFIG.appId[currentPlatform];
};

// Helper function to get AdSense configuration
export const getAdSenseConfig = () => {
  const isDevelopment = typeof window !== 'undefined' ? 
    process.env.NODE_ENV === 'development' : 
    (typeof __DEV__ !== 'undefined' ? __DEV__ : false);
    
  return {
    ...AD_CONFIG.adsense.settings,
    publisherId: isDevelopment ? 
      AD_CONFIG.adsense.test.publisherId : 
      AD_CONFIG.production.web.publisherId,
    isDevelopment
  };
}; 