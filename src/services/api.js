// DHRUV-NET API Service Layer
// Cleanly structured to connect with future Node.js / Express backend / Raspberry Pi telemetry collector.

import { PLATFORM_INFO, getSimulatedReading, generateHistoricalData } from './mockData';

// When backend is deployed, configure VITE_API_BASE_URL in .env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || null;

/**
 * Fetch platform health, battery, GPS coordinates, and online status
 */
export async function getPlatformStatus() {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/status`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend unavailable, falling back to local simulation:", err.message);
    }
  }

  // Fallback to realistic local telemetry
  const reading = getSimulatedReading();
  return {
    platformId: PLATFORM_INFO.id,
    name: PLATFORM_INFO.name,
    status: PLATFORM_INFO.status,
    battery: reading.battery,
    batteryStatus: "Nominal (Solar Array Active)",
    coordinates: reading.coordinates,
    lastReceived: reading.timestamp,
    displayTime: reading.displayTime
  };
}

/**
 * Fetch latest sensor readings (Water Temperature, Salinity, Pressure, Depth, Humidity)
 */
export async function getLatestSensorReadings() {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/sensors/latest`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend unavailable, falling back to local simulation:", err.message);
    }
  }

  const simulated = getSimulatedReading();
  return simulated;
}

/**
 * Fetch historical parameter series for graphs & analytics
 * @param {'1h' | '24h' | '7d' | 'custom'} timeRange
 * @param {string} [startDate]
 * @param {string} [endDate]
 */
export async function getHistoricalTelemetry(timeRange = '24h', startDate = null, endDate = null) {
  if (API_BASE_URL) {
    try {
      const params = new URLSearchParams({ range: timeRange });
      if (startDate) params.append('start', startDate);
      if (endDate) params.append('end', endDate);
      
      const res = await fetch(`${API_BASE_URL}/sensors/history?${params.toString()}`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend unavailable, falling back to local simulation:", err.message);
    }
  }

  const customStart = startDate ? new Date(startDate) : null;
  const customEnd = endDate ? new Date(endDate) : null;
  return generateHistoricalData(timeRange, customStart, customEnd);
}
