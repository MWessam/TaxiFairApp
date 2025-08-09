import React from 'react';
import { View } from 'react-native';
import MapboxGL from '@rnmapbox/maps';

// Export MapboxGL for use in children components
export { MapboxGL };

export default function MapViewNative({ 
  children, 
  style, 
  center, 
  zoom, 
  onClick,
  ...props 
}) {
  return (
    <View style={[{ flex: 1 }, style]}>
      <MapboxGL.MapView style={{ flex: 1 }} {...props}>
        {children}
      </MapboxGL.MapView>
    </View>
  );
}
