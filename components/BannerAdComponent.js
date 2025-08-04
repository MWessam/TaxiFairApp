import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import adService from '../services/adService';

const BannerAdComponent = ({ style, containerStyle }) => {
  const [adStatus, setAdStatus] = useState('Loading...');

  useEffect(() => {
    const checkAdStatus = async () => {
      try {
        const showAds = adService.shouldShowAds();
        setAdStatus(showAds ? 'Ads enabled' : 'Ads disabled');
        
        console.log('BannerAdComponent: Ad status checked:', {
          shouldShowAds: showAds
        });
      } catch (error) {
        console.error('BannerAdComponent: Error checking ad status:', error);
        setAdStatus('Error checking status');
      }
    };

    checkAdStatus();
  }, []);

  const bannerAd = adService.getBannerAd();

  if (!bannerAd) {
    return (
      <View>
      </View>
    );
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {bannerAd}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  debugContainer: {
    padding: 5,
    backgroundColor: '#f0f0f0',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  debugText: {
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
});

export default BannerAdComponent; 