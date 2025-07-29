// AdMob Configuration
// Replace these with your actual AdMob ad unit IDs

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
    maxAdsPerSession: 3,
    
             // Show ads after specific actions
         showWhenGoingBackFromResults: true,
         showAfterTripEstimation: true,
         showAfterAppLaunch: false, // Don't show immediately on launch
    
    // Banner ad settings
    bannerRefreshInterval: 60000, // 1 minute
  },
};

// Helper function to get ad unit ID based on platform and type
export const getAdUnitId = (type, platform = null) => {
  const currentPlatform = platform || Platform.OS;
  const isDevelopment = __DEV__;
  
  if (isDevelopment) {
    return AD_CONFIG.test[type];
  }
  
  return AD_CONFIG.production[currentPlatform][type];
};

// Helper function to get app ID
export const getAppId = (platform = null) => {
  const currentPlatform = platform || Platform.OS;
  return AD_CONFIG.appId[currentPlatform];
}; 