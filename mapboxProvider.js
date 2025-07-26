// src/providers/MapboxProvider.js or similar
import MapboxGL from '@rnmapbox/maps';
import Constants from 'expo-constants';

export function configureMapbox() {
  const token = Constants.expoConfig.extra?.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    console.warn('⚠️ Mapbox access token not found!');
    return;
  }
  MapboxGL.setAccessToken(token);
}
