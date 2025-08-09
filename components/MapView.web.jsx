import React from 'react';
import { View, Text } from 'react-native';

// Web stub for MapboxGL - children using MapboxGL will be ignored on web
export const MapboxGL = new Proxy({}, {
  get() {
    return () => null; // Return null component for any MapboxGL usage
  }
});

export default function MapViewWeb({ 
  center = [31.2357, 30.0444], 
  zoom = 12, 
  onClick, 
  style,
  children 
}) {
  return (
    <View style={[{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f0f0' }, style]}>
      <Text style={{ fontSize: 16, color: '#666' }}>
        Map View (Web Placeholder)
      </Text>
      <Text style={{ fontSize: 12, color: '#999', marginTop: 5 }}>
        Center: {center[1]}, {center[0]} | Zoom: {zoom}
      </Text>
    </View>
  );
}