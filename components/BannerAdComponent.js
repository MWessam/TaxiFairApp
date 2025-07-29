import React from 'react';
import { View, StyleSheet } from 'react-native';
import adService from '../services/adService';

const BannerAdComponent = ({ style, containerStyle }) => {
  const bannerAd = adService.getBannerAd();

  if (!bannerAd) {
    return null; // Don't render anything for premium users
  }

  return (
    <View style={[styles.container, containerStyle]}>
      {bannerAd}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});

export default BannerAdComponent; 