import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Constants from 'expo-constants';

// Minimal Mapbox GL JS wrapper for web
export const MapboxGL = new Proxy({}, {
  get() {
    return () => null;
  },
});

export default function MapViewWeb({
  center = [31.2357, 30.0444],
  zoom = 12,
  onClick,
  onRegionDidChange,
  style,
  children,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    const cleanupFns = [];

    const ensureMapboxLoaded = () => new Promise((resolve, reject) => {
      if (window.mapboxgl) return resolve(window.mapboxgl);
      // Inject CSS
      const cssId = 'mapbox-gl-css';
      if (!document.getElementById(cssId)) {
        const link = document.createElement('link');
        link.id = cssId;
        link.rel = 'stylesheet';
        link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css';
        document.head.appendChild(link);
        cleanupFns.push(() => { try { link.parentNode?.removeChild(link); } catch {} });
      }
      // Inject JS
      const scriptId = 'mapbox-gl-js';
      if (document.getElementById(scriptId)) {
        const checkLoaded = () => window.mapboxgl ? resolve(window.mapboxgl) : setTimeout(checkLoaded, 50);
        return checkLoaded();
      }
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js';
      script.async = true;
      script.onload = () => resolve(window.mapboxgl);
      script.onerror = (e) => reject(e);
      document.body.appendChild(script);
      cleanupFns.push(() => { try { script.parentNode?.removeChild(script); } catch {} });
    });

    (async () => {
      try {
        const mapboxgl = await ensureMapboxLoaded();
        if (!isMounted || !mapContainerRef.current) return;
        const token = Constants.expoConfig?.extra?.MAPBOX_ACCESS_TOKEN;
        if (token) mapboxgl.accessToken = token;

        mapRef.current = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/streets-v11',
          center,
          zoom,
        });

        if (onClick) {
          mapRef.current.on('click', (e) => {
            const { lng, lat } = e.lngLat;
            onClick([lng, lat]);
          });
        }
        if (onRegionDidChange) {
          mapRef.current.on('moveend', () => {
            const c = mapRef.current.getCenter();
            onRegionDidChange({ geometry: { coordinates: [c.lng, c.lat] } });
          });
        }
      } catch (err) {
        // Keep silent to avoid crashing; no map if CDN fails
      }
    })();

    return () => {
      isMounted = false;
      try { mapRef.current?.remove(); } catch {}
      cleanupFns.forEach((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (mapRef.current && Array.isArray(center)) {
      mapRef.current.setCenter(center);
    }
  }, [center?.[0], center?.[1]]);

  return (
    <View style={[{ flex: 1 }, style]}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      {children}
    </View>
  );
}