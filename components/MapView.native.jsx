import React, { useRef } from 'react';
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
  onRegionDidChange,
  ...props 
}) {
  const initialCenter = center && Array.isArray(center) ? center : undefined;
  const initialZoom = typeof zoom === 'number' ? zoom : undefined;

  return (
    <View style={[{ flex: 1 }, style]}>
      <MapboxGL.MapView
        style={{ flex: 1 }}
        onPress={(e) => {
          if (!onClick) return;
          try {
            const coords = e?.geometry?.coordinates;
            if (Array.isArray(coords)) {
              const [lng, lat] = coords;
              onClick([lng, lat]);
            }
          } catch {}
        }}
        onRegionDidChange={(region) => {
          if (!onRegionDidChange) return;
          try {
            // region has properties with centerCoordinate
            if (region && region.properties && (Array.isArray(region.properties.center) || Array.isArray(region.properties.centerCoordinate))) {
              const centerArr = region.properties.center || region.properties.centerCoordinate;
              const [lng, lat] = centerArr;
              onRegionDidChange({ geometry: { coordinates: [lng, lat] } });
            }
          } catch {}
        }}
        {...props}
      >
        {/* Set initial camera only; do not bind to props to allow gestures */}
        {(initialCenter || initialZoom !== undefined) && (
          <MapboxGL.Camera
            defaultSettings={{
              centerCoordinate: initialCenter,
              zoomLevel: initialZoom,
            }}
          />
        )}
        {children}
      </MapboxGL.MapView>
    </View>
  );
}
