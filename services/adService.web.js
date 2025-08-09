// Web stub for adService - no mobile ads on web
export default {
  initialize: async () => {
    console.log('AdService (web): No-op initialization');
  },
  getBannerAd: () => {
    console.log('AdService (web): No banner ads on web');
    return null;
  },
  showInterstitialAd: async () => {
    console.log('AdService (web): No interstitial ads on web');
    return false;
  },
  showLaunchAd: async () => {
    console.log('AdService (web): No launch ads on web');
    return false;
  },
  showAdWhenGoingBackFromResults: async () => {
    console.log('AdService (web): No ads on web');
    return false;
  },
  showAdAfterTripEstimation: async () => {
    console.log('AdService (web): No ads on web');
    return false;
  },
  resetAdCount: () => {
    console.log('AdService (web): No-op reset');
  },
  shouldShowAds: () => {
    return false;
  },
};
