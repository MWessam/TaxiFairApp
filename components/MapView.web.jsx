import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Constants from 'expo-constants';

// Add spinner animation CSS
const spinnerCSS = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

// Inject spinner CSS once
if (typeof document !== 'undefined' && !document.getElementById('mapview-spinner-css')) {
  const style = document.createElement('style');
  style.id = 'mapview-spinner-css';
  style.textContent = spinnerCSS;
  document.head.appendChild(style);
}

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
  onRegionIsChanging,
  bounds, // { ne: [lng, lat], sw: [lng, lat], padding?: number }
  webMarkers = [], // [{ lng, lat, color? }]
  webLineCoords = [], // [[lng, lat], ...]
  style,
  children,
}) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [loadError, setLoadError] = useState(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [containerReady, setContainerReady] = useState(false);
  const [initializationStarted, setInitializationStarted] = useState(false);
  const markersRef = useRef([]);

  // Simple container readiness check
  useEffect(() => {
    
    // Give the component a moment to render, then check
    const timer = setTimeout(() => {
      if (mapContainerRef.current) {
        const rect = mapContainerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setContainerReady(true);
        } else {
          // Force ready after a short delay even if dimensions are 0
          setTimeout(() => setContainerReady(true), 500);
        }
      } else {
        setContainerReady(true);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!containerReady) return;
    
    setInitializationStarted(true);
    
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
        link.href = 'https://unpkg.com/mapbox-gl@2.15.0/dist/mapbox-gl.css';
        document.head.appendChild(link);
        cleanupFns.push(() => { try { link.parentNode?.removeChild(link); } catch {} });
      }
      // Inject JS
      const scriptId = 'mapbox-gl-js';
      if (document.getElementById(scriptId)) {
        const checkLoaded = () => window.mapboxgl ? resolve(window.mapboxgl) : setTimeout(checkLoaded, 50);
        let x = checkLoaded();
        return x;
      }
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://unpkg.com/mapbox-gl@2.15.0/dist/mapbox-gl.js';
      script.crossOrigin = 'anonymous';
      script.async = true;
      script.onload = () => {
        let x = resolve(window.mapboxgl);
        return x;
      }
      script.onerror = (e) => {
        reject(e);
      }
      document.body.appendChild(script);
      cleanupFns.push(() => { 
        try { script.parentNode?.removeChild(script); } catch {} 
      });
    });

    (async () => {
      try {
        const mapboxgl = await ensureMapboxLoaded();
        if (!isMounted || !mapContainerRef.current) return;
        const token =
          Constants.expoConfig?.extra?.MAPBOX_ACCESS_TOKEN ||
          (globalThis?.expo?.expoConfig?.extra?.MAPBOX_ACCESS_TOKEN) ||
          (typeof process !== 'undefined' ? process.env?.MAPBOX_ACCESS_TOKEN : undefined);
        if (!token) {
          setLoadError('Missing MAPBOX_ACCESS_TOKEN');
          return;
        }
        if (token) mapboxgl.accessToken = token;
        // Validate center coordinates
        const validCenter = Array.isArray(center) && 
                           center.length === 2 && 
                           Number.isFinite(center[0]) && 
                           Number.isFinite(center[1]) ? center : [31.2357, 30.0444];

        mapRef.current = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: 'mapbox://styles/mapbox/streets-v11',
          center: validCenter,
          zoom,
        });
        mapRef.current.on('load', () => {
          // Small delay to ensure container is fully rendered
          setTimeout(() => {
            try { 
              mapRef.current.resize(); 
              setMapLoaded(true);
            } catch (e) {
              setMapLoaded(true); // Set loaded anyway
            }
          }, 100);
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
        if (onRegionIsChanging) {
          mapRef.current.on('move', () => {
            const c = mapRef.current.getCenter();
            onRegionIsChanging({ geometry: { coordinates: [c.lng, c.lat] } });
          });
        }
      } catch (err) {
        setLoadError('Failed to load Mapbox GL');
      }
    })();

    return () => {
      isMounted = false;
      try { mapRef.current?.remove(); } catch (e) {
      }
      cleanupFns.forEach((fn) => fn());
    };
  }, [containerReady]);

  useEffect(() => {
    if (mapRef.current && mapLoaded && Array.isArray(center) && center.length === 2 && Number.isFinite(center[0]) && Number.isFinite(center[1])) {
      try {
        mapRef.current.setCenter(center);
        // Ensure map renders correctly if container size changed
        mapRef.current.resize();
      } catch (e) {
      }
    }
  }, [mapLoaded, center?.[0], center?.[1]]);

  useEffect(() => {
    if (mapRef.current && mapLoaded && bounds && Array.isArray(bounds.ne) && Array.isArray(bounds.sw)) {
      const ne = bounds.ne;
      const sw = bounds.sw;
      const isValid = (arr) => Array.isArray(arr) && arr.length === 2 && Number.isFinite(arr[0]) && Number.isFinite(arr[1]);
      if (isValid(sw) && isValid(ne)) {
        try {
          // Mapbox GL JS v2 expects a LngLatBoundsLike: [[swLng, swLat], [neLng, neLat]]
          mapRef.current.fitBounds([sw, ne], { padding: bounds.padding ?? 40, duration: 800 });
          mapRef.current.resize();
        } catch (e) {
        }
      }
    }
  }, [mapLoaded, bounds?.ne?.[0], bounds?.ne?.[1], bounds?.sw?.[0], bounds?.sw?.[1]]);

  // Keep map sized correctly if the container changes size
  useEffect(() => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!map || !container) return;
    let ro;
    const onWindowResize = () => { try { map.resize(); } catch {} };
    try {
      if ('ResizeObserver' in window) {
        ro = new ResizeObserver(() => { try { map.resize(); } catch {} });
        ro.observe(container);
      }
    } catch (e) {
    }
    window.addEventListener('resize', onWindowResize);
    return () => {
      try { ro && ro.disconnect(); } catch {}
      window.removeEventListener('resize', onWindowResize);
    };
  }, [mapLoaded]);

  // Render/update polyline
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    try {
      const sourceId = 'route-source';
      const layerId = 'route-layer';
      const coords = Array.isArray(webLineCoords) ? webLineCoords.filter(c => Array.isArray(c) && Number.isFinite(c[0]) && Number.isFinite(c[1])) : [];
      const data = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
      };
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: 'geojson', data });
        if (!map.getLayer(layerId)) {
          map.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            paint: { 'line-color': '#5C2633', 'line-width': 4 },
          });
        }
      } else {
        map.getSource(sourceId).setData(data);
      }
    } catch (e) {
    }
  }, [mapLoaded, JSON.stringify(webLineCoords)]);

  // Render/update markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    try {
      // clear existing
      markersRef.current.forEach(m => { try { m.remove(); } catch {} });
      markersRef.current = [];
      (webMarkers || []).forEach(({ lng, lat, color }) => {
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
        const el = document.createElement('div');
        el.style.width = '14px';
        el.style.height = '14px';
        el.style.borderRadius = '7px';
        el.style.border = '2px solid #fff';
        el.style.boxShadow = '0 0 2px rgba(0,0,0,0.3)';
        el.style.background = color || '#5C2633';
        const marker = new window.mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
        markersRef.current.push(marker);
      });
    } catch (e) {
    }
  }, [mapLoaded, JSON.stringify(webMarkers)]);


  return (
    <View style={[{ flex: 1 }, style]}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      
      {loadError && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.8)', color: '#444', fontSize: 14, zIndex: 1000
        }}>
          {loadError === 'Missing MAPBOX_ACCESS_TOKEN' ? 'Map unavailable: missing Mapbox access token' : 'Map failed to load'}
        </div>
      )}
      
      {(!containerReady || (containerReady && !mapLoaded)) && !loadError && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(255,255,255,0.9)', color: '#666', fontSize: 14, zIndex: 1000
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              width: 24, height: 24, border: '3px solid #f3f3f3', borderTop: '3px solid #3498db',
              borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 8px'
            }} />
            {!containerReady ? 'Preparing map...' : 'Loading map...'}
          </div>
        </div>
      )}
      
      {children}
    </View>
  );
}