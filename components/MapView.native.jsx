import React, { useEffect, useRef } from 'react';
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
  bounds, // { ne: [lng, lat], sw: [lng, lat], padding?: number, animationDuration?: number }
  ...props 
}) {
  const initialCenter = center && Array.isArray(center) ? center : undefined;
  const initialZoom = typeof zoom === 'number' ? zoom : undefined;
  const cameraRef = useRef(null);

  useEffect(() => {
    if (cameraRef.current && Array.isArray(center)) {
      try {
        cameraRef.current.setCamera({
          centerCoordinate: center,
          zoomLevel: initialZoom || 14,
          animationDuration: 800,
        });
      } catch {}
    }
  }, [center?.[0], center?.[1]]);

  useEffect(() => {
    if (cameraRef.current && bounds && Array.isArray(bounds.ne) && Array.isArray(bounds.sw)) {
      try {
        cameraRef.current.setCamera({
          bounds: {
            ne: bounds.ne,
            sw: bounds.sw,
            padding: bounds.padding ?? 40,
          },
          animationDuration: bounds.animationDuration ?? 800,
        });
      } catch {}
    }
  }, [bounds?.ne?.[0], bounds?.ne?.[1], bounds?.sw?.[0], bounds?.sw?.[1]]);

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
        <MapboxGL.Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: initialCenter,
            zoomLevel: initialZoom,
          }}
        />
        {children}
      </MapboxGL.MapView>
    </View>
  );
}
