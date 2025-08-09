// Web AdSense service for displaying Google AdSense ads
import React from 'react';
import { getAdSenseConfig, getAdUnitId, getAppId } from '../config/adConfig';

class AdService {
  constructor() {
    this.isInitialized = false;
    this.adCount = 0;
    this.lastAdTime = 0;
    this.hasShownLaunchAd = false;
    this.config = getAdSenseConfig();
    this.adsenseLoaded = false;
    
    // Track ad refresh intervals
    this.bannerRefreshIntervals = new Map();
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('AdService (web): Initializing AdSense...');
      
      // Load AdSense script
      await this.loadAdSenseScript();
      
      // Initialize AdSense
      if (window.adsbygoogle) {
        // Configure AdSense
        if (this.config.autoAds.enabled) {
          window.adsbygoogle.push({
            google_ad_client: this.config.publisherId,
            enable_page_level_ads: this.config.autoAds.pageLevel,
            overlays: { bottom: this.config.autoAds.anchor },
            vignettes: { unhideOnResize: this.config.autoAds.multiplex }
          });
        }
        
        this.isInitialized = true;
        console.log('AdService (web): AdSense initialized successfully');
        
        // Show launch ad after initialization
        setTimeout(() => {
          this.showLaunchAd();
        }, 2000);
      }
    } catch (error) {
      console.error('AdService (web): Failed to initialize AdSense:', error);
    }
  }

  async loadAdSenseScript() {
    return new Promise((resolve, reject) => {
      // Check if AdSense is already loaded
      if (window.adsbygoogle) {
        this.adsenseLoaded = true;
        resolve();
        return;
      }

      // Check if script already exists
      if (document.querySelector('script[src*="adsbygoogle.js"]')) {
        // Wait for it to load
        const checkLoaded = () => {
          if (window.adsbygoogle) {
            this.adsenseLoaded = true;
            resolve();
          } else {
            setTimeout(checkLoaded, 100);
          }
        };
        checkLoaded();
        return;
      }

      // Create and load the script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.config.publisherId}`;
      script.crossOrigin = 'anonymous';
      
      script.onload = () => {
        this.adsenseLoaded = true;
        console.log('AdService (web): AdSense script loaded');
        resolve();
      };
      
      script.onerror = (error) => {
        console.error('AdService (web): Failed to load AdSense script:', error);
        reject(error);
      };
      
      document.head.appendChild(script);
    });
  }

  getBannerAd() {
    if (!this.shouldShowAds()) {
      return null;
    }

    const adSlot = getAdUnitId('banner');
    const publisherId = getAppId();
    const adId = `banner-ad-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    console.log('AdService (web): Creating banner ad');

    // Create AdSense banner component
    const BannerAd = () => {
      React.useEffect(() => {
        const initAd = () => {
          try {
            // Ensure AdSense is loaded
            if (window.adsbygoogle && this.adsenseLoaded) {
              const adElement = document.getElementById(adId);
              if (adElement && !adElement.getAttribute('data-ad-status')) {
                // Push ad to AdSense
                (window.adsbygoogle = window.adsbygoogle || []).push({});
                console.log('AdService (web): Banner ad initialized');
                
                // Set up refresh interval if enabled
                if (this.config.manualAds.refreshInterval > 0) {
                  const refreshInterval = setInterval(() => {
                    this.refreshBannerAd(adId);
                  }, this.config.manualAds.refreshInterval);
                  
                  this.bannerRefreshIntervals.set(adId, refreshInterval);
                }
              }
            } else {
              // Retry after a short delay
              setTimeout(initAd, 500);
            }
          } catch (error) {
            console.error('AdService (web): Error initializing banner ad:', error);
          }
        };

        // Initialize after a short delay to ensure DOM is ready
        setTimeout(initAd, 100);

        // Cleanup function
        return () => {
          const interval = this.bannerRefreshIntervals.get(adId);
          if (interval) {
            clearInterval(interval);
            this.bannerRefreshIntervals.delete(adId);
          }
        };
      }, []);

      const adStyle = {
        display: 'block',
        width: '100%',
        minHeight: '90px',
        textAlign: 'center',
        backgroundColor: '#f5f5f5',
        border: '1px solid #ddd',
        borderRadius: '4px',
        margin: '10px 0'
      };

      return React.createElement('ins', {
        id: adId,
        className: 'adsbygoogle',
        style: adStyle,
        'data-ad-client': publisherId,
        'data-ad-slot': adSlot,
        'data-ad-format': 'auto',
        'data-full-width-responsive': 'true'
      });
    };

    return React.createElement(BannerAd);
  }

  refreshBannerAd(adId) {
    try {
      const adElement = document.getElementById(adId);
      if (adElement && window.adsbygoogle) {
        // Clear the ad
        adElement.innerHTML = '';
        adElement.removeAttribute('data-ad-status');
        
        // Reinitialize
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        console.log('AdService (web): Banner ad refreshed');
      }
    } catch (error) {
      console.error('AdService (web): Error refreshing banner ad:', error);
    }
  }

  async showInterstitialAd() {
    console.log('AdService (web): Attempting to show interstitial ad...');
    
    const now = Date.now();
    
    // Check rate limiting
    if (now - this.lastAdTime < this.config.manualAds.refreshInterval) {
      console.log('AdService (web): Ad shown too recently, skipping');
      return false;
    }

    // Check session limits
    if (this.adCount >= 5) { // Max 5 interstitial-style ads per session
      console.log('AdService (web): Maximum ads per session reached');
      return false;
    }

    try {
      // For web, we can create a modal-style ad or use auto ads
      if (this.config.autoAds.enabled && window.adsbygoogle) {
        // Trigger auto ads
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        this.adCount++;
        this.lastAdTime = now;
        console.log('AdService (web): Auto ad triggered');
        return true;
      }
    } catch (error) {
      console.error('AdService (web): Error showing interstitial ad:', error);
    }
    
    return false;
  }

  async showLaunchAd() {
    if (this.hasShownLaunchAd) {
      console.log('AdService (web): Launch ad already shown this session');
      return false;
    }
    
    console.log('AdService (web): Showing launch ad...');
    const success = await this.showInterstitialAd();
    if (success) {
      this.hasShownLaunchAd = true;
      console.log('AdService (web): Launch ad shown successfully');
    }
    return success;
  }

  async showAdWhenGoingBackFromResults() {
    console.log('AdService (web): Showing ad when going back from results');
    return await this.showInterstitialAd();
  }

  async showAdAfterTripEstimation() {
    console.log('AdService (web): Showing ad after trip estimation');
    return await this.showInterstitialAd();
  }

  resetAdCount() {
    this.adCount = 0;
    this.lastAdTime = 0;
    this.hasShownLaunchAd = false;
    console.log('AdService (web): Ad count reset');
  }

  shouldShowAds() {
    // Always show ads on web (you can add premium user checks here)
    return true;
  }
}

// Export singleton instance
const adService = new AdService();
export default adService;
