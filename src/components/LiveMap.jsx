import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { 
  Navigation, 
  Crosshair, 
  Layers, 
  Trash2 
} from 'lucide-react';
import { decimalToDMS } from '../services/gpsService';

// Map Tile Providers (100% Free, No API Key Required, No Watermarks)
const TILE_LAYERS = {
  dark: {
    name: 'Tactical Dark',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 16,
      attribution: '&copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
    }
  },
  satellite: {
    name: 'Satellite Hybrid',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 18,
      attribution: '&copy; Esri &mdash; Earthstar Geographics'
    }
  },
  ocean: {
    name: 'Ocean Bathymetry',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 13,
      attribution: '&copy; Esri &mdash; GEBCO, NOAA'
    }
  },
  osm: {
    name: 'Navigational Clean',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }
  }
};

export default function LiveMap({ 
  coordinates = { lat: 15.2993, lng: 73.8243 }, 
  platformId = 'DHRUV-NET-OBS-01',
  waterTemp = '22.6°C',
  depth = '12.8m',
  isFull = false,
  accuracy = 5,
  speedKmh = 0,
  heading = 0,
  satellites = '12 Satellites',
  fixType = 'Autonomous 3D GNSS Fix',
  gpsSource = 'buoy'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const tileLayerRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyCircleRef = useRef(null);
  const trackLineRef = useRef(null);
  const trackPointsRef = useRef([]);

  const [activeLayer, setActiveLayer] = useState('dark');
  const [isFollowing, setIsFollowing] = useState(true);
  const [pointCount, setPointCount] = useState(0);

  // Generate marker HTML with heading arrow and beacon pulse
  const getMarkerHtml = useCallback((hdg, src) => {
    const isMoving = speedKmh > 0.8;
    const pulseColor = src === 'hardware' ? '#10b981' : src === 'device' ? '#38bdf8' : '#00d2ff';
    const coreColor = src === 'hardware' ? '#34d399' : src === 'device' ? '#0284c7' : '#00d2ff';

    return `
      <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 44px; height: 44px; border-radius: 50%; background: ${pulseColor}26; animation: pulse 2.2s infinite ease-out;"></div>
        
        <!-- Heading Indicator Cone/Arrow -->
        <div style="
          position: absolute; 
          width: 32px; 
          height: 32px; 
          display: flex; 
          align-items: flex-start; 
          justify-content: center; 
          transform: rotate(${hdg}deg);
          transition: transform 0.4s ease;
          pointer-events: none;
          opacity: ${isMoving ? 1 : 0.6};
        ">
          <div style="
            width: 0; 
            height: 0; 
            border-left: 6px solid transparent; 
            border-right: 6px solid transparent; 
            border-bottom: 12px solid ${coreColor};
            filter: drop-shadow(0 0 4px ${coreColor});
          "></div>
        </div>

        <!-- Center Node -->
        <div style="
          width: 14px; 
          height: 14px; 
          border-radius: 50%; 
          background: ${coreColor}; 
          border: 2.5px solid #ffffff; 
          box-shadow: 0 0 12px ${coreColor};
          z-index: 2;
        "></div>
      </div>
    `;
  }, [speedKmh]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const lat = coordinates?.lat || 15.2993;
      const lng = coordinates?.lng || 73.8243;

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: isFull ? 12 : 9,
        zoomControl: false,
        attributionControl: false
      });

      // Add Zoom Control to top-right
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Base Tile Layer
      const initialLayerConfig = TILE_LAYERS[activeLayer];
      const tileLayer = L.tileLayer(initialLayerConfig.url, initialLayerConfig.options).addTo(map);
      tileLayerRef.current = tileLayer;

      // Accuracy Circle
      const accCircle = L.circle([lat, lng], {
        radius: accuracy || 15,
        color: '#00d2ff',
        fillColor: '#00d2ff',
        fillOpacity: 0.12,
        weight: 1.5,
        dashArray: '3, 4'
      }).addTo(map);
      accuracyCircleRef.current = accCircle;

      // Polyline for GPS Breadcrumbs track
      const trackLine = L.polyline([[lat, lng]], {
        color: '#00e5ff',
        weight: 3.5,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round',
        dashArray: null
      }).addTo(map);
      trackLineRef.current = trackLine;
      trackPointsRef.current = [[lat, lng]];

      // Custom GPS Marker
      const buoyIcon = L.divIcon({
        className: 'buoy-pulse-marker',
        html: getMarkerHtml(heading, gpsSource),
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      const marker = L.marker([lat, lng], { icon: buoyIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.5; color: #f8fafc; min-width: 190px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">
            <strong style="color: #00d2ff; font-size: 14px;">${platformId}</strong>
            <span style="font-size: 10px; background: rgba(0,210,255,0.2); padding: 2px 6px; border-radius: 4px; color: #38bdf8; text-transform: uppercase;">
              ${gpsSource}
            </span>
          </div>
          <div><strong>GNSS Fix:</strong> ${fixType}</div>
          <div><strong>Satellites:</strong> ${satellites}</div>
          <div><strong>Speed:</strong> ${speedKmh} km/h (${(speedKmh * 0.5399).toFixed(1)} kts)</div>
          <div><strong>Bearing:</strong> ${heading}°</div>
          <div><strong>Accuracy:</strong> &plusmn;${accuracy}m</div>
          ${waterTemp ? `<div><strong>Water Temp:</strong> ${waterTemp}</div>` : ''}
          ${depth ? `<div><strong>Depth:</strong> ${depth}</div>` : ''}
          <div style="margin-top: 6px; font-family: monospace; font-size: 11px; color: #94a3b8;">
            ${lat.toFixed(5)}°N, ${lng.toFixed(5)}°E
          </div>
        </div>
      `);

      mapInstanceRef.current = map;
      markerRef.current = marker;

      // If user drags the map manually, don't jerk it back unless following
      map.on('dragstart', () => {
        // user initiated drag
      });
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isFull]);

  // Handle Layer Switch
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const config = TILE_LAYERS[activeLayer];
    if (config) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
      const newLayer = L.tileLayer(config.url, config.options).addTo(mapInstanceRef.current);
      tileLayerRef.current = newLayer;
    }
  }, [activeLayer]);

  // Update marker, accuracy circle, breadcrumbs on coordinate / heading changes
  useEffect(() => {
    const lat = coordinates?.lat;
    const lng = coordinates?.lng;
    if (lat == null || lng == null) return;

    // Update marker icon with current heading
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      const newIcon = L.divIcon({
        className: 'buoy-pulse-marker',
        html: getMarkerHtml(heading, gpsSource),
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });
      markerRef.current.setIcon(newIcon);
    }

    // Update Accuracy Circle
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng([lat, lng]);
      accuracyCircleRef.current.setRadius(Math.max(5, accuracy || 10));
    }

    // Update Breadcrumb Polyline (store up to 150 points)
    if (trackLineRef.current) {
      const lastPoint = trackPointsRef.current[trackPointsRef.current.length - 1];
      // Only append if moved slightly (avoid redundant points)
      if (!lastPoint || Math.abs(lastPoint[0] - lat) > 0.00002 || Math.abs(lastPoint[1] - lng) > 0.00002) {
        const updated = [...trackPointsRef.current, [lat, lng]];
        if (updated.length > 150) updated.shift();
        trackPointsRef.current = updated;
        trackLineRef.current.setLatLngs(updated);
        setPointCount(updated.length);
      }
    }

    // Pan map if follow mode is active
    if (isFollowing && mapInstanceRef.current) {
      mapInstanceRef.current.panTo([lat, lng], { animate: true, duration: 0.6 });
    }
  }, [coordinates?.lat, coordinates?.lng, heading, accuracy, gpsSource, isFollowing, getMarkerHtml]);

  // Recenter map explicitly
  const handleRecenter = () => {
    if (mapInstanceRef.current && coordinates?.lat && coordinates?.lng) {
      mapInstanceRef.current.setView([coordinates.lat, coordinates.lng], isFull ? 13 : 10, {
        animate: true
      });
      setIsFollowing(true);
    }
  };

  // Clear track breadcrumbs
  const handleClearTrail = () => {
    if (coordinates?.lat && coordinates?.lng) {
      trackPointsRef.current = [[coordinates.lat, coordinates.lng]];
      if (trackLineRef.current) {
        trackLineRef.current.setLatLngs(trackPointsRef.current);
      }
      setPointCount(1);
    }
  };

  const formattedDMS = decimalToDMS(coordinates?.lat, coordinates?.lng);

  return (
    <div className={`map-container-wrapper ${isFull ? 'full-view' : 'dashboard-mini'}`}>
      <div 
        ref={mapContainerRef} 
        style={{ width: '100%', height: '100%', minHeight: isFull ? '550px' : '100%' }} 
      />

      {/* Floating Tactical Map Controls Toolbar - Full view only to prevent dashboard overlap */}
      {isFull && (
        <div className="map-toolbar-floating">
          <button 
            className={`map-tool-btn ${isFollowing ? 'active' : ''}`}
            onClick={() => setIsFollowing(prev => !prev)}
            title={isFollowing ? 'Auto-Center: ON (tracking target)' : 'Auto-Center: OFF'}
          >
            <Crosshair size={16} />
            <span className="tool-btn-text">{isFollowing ? 'Following' : 'Follow Off'}</span>
          </button>

          <button 
            className="map-tool-btn"
            onClick={handleRecenter}
            title="Recenter GPS Position"
          >
            <Navigation size={16} />
            <span className="tool-btn-text">Center</span>
          </button>

          <button 
            className="map-tool-btn"
            onClick={handleClearTrail}
            title={`Clear GPS Trail (${pointCount} points)`}
          >
            <Trash2 size={16} />
            <span className="tool-btn-text">Clear Path</span>
          </button>

          {/* Map Layers Dropdown / Selector */}
          <div className="map-layer-selector">
            <button 
              className="map-tool-btn"
              title="Switch Map Tiles"
              onClick={() => {
                const keys = Object.keys(TILE_LAYERS);
                const nextIdx = (keys.indexOf(activeLayer) + 1) % keys.length;
                setActiveLayer(keys[nextIdx]);
              }}
            >
              <Layers size={16} />
              <span className="tool-btn-text">{TILE_LAYERS[activeLayer].name}</span>
            </button>
          </div>
        </div>
      )}
      
      {/* Telemetry HUD Overlay - Full view only */}
      {isFull && (
        <div className="map-hud-overlay">
          <div className="map-hud-item">
            <span className="map-hud-label">GPS Source</span>
            <span className="map-hud-val" style={{ color: gpsSource === 'hardware' ? '#34d399' : gpsSource === 'device' ? '#38bdf8' : '#00d2ff', textTransform: 'capitalize' }}>
              {gpsSource === 'hardware' ? '🔌 USB GPS (Serial)' : gpsSource === 'device' ? '🛰️ Device GNSS' : '🌊 Ocean Buoy'}
            </span>
          </div>

          <div className="map-hud-item">
            <span className="map-hud-label">Position (Decimal)</span>
            <span className="map-hud-val">
              {coordinates?.lat ? `${coordinates.lat.toFixed(5)}° N, ${coordinates.lng.toFixed(5)}° E` : '--'}
            </span>
          </div>

          <div className="map-hud-item">
            <span className="map-hud-label">Position (DMS)</span>
            <span className="map-hud-val" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              {formattedDMS}
            </span>
          </div>

          <div className="map-hud-item">
            <span className="map-hud-label">Accuracy / HDOP</span>
            <span className="map-hud-val" style={{ color: accuracy <= 5 ? '#34d399' : accuracy <= 15 ? '#fbbf24' : '#f87171' }}>
              &plusmn;{accuracy} m
            </span>
          </div>

          <div className="map-hud-item">
            <span className="map-hud-label">Speed & Bearing</span>
            <span className="map-hud-val">
              {speedKmh} km/h &bull; {heading}°
            </span>
          </div>

          <div className="map-hud-item">
            <span className="map-hud-label">GNSS Satellites</span>
            <span className="map-hud-val" style={{ color: '#38bdf8' }}>
              {satellites}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
