// DHRUV-NET API Service Layer
// Hardware Architecture:
// Sensors (DHT22, DS18B20, BMP280, MPU6050, GPS)
//   ↓
// NodeMCU ESP8266 (Main Microcontroller)
//   ↓
// LoRa RA-02 (SX1278 433MHz Wireless Transceiver)
//   ↓
// LoRa Gateway / Receiver
//   ↓
// Node.js + Express Backend
//   ↓
// DHRUV-NET Web Dashboard
//
// NOTE: Main Controller is exclusively NodeMCU ESP8266.

import { 
  PLATFORM_INFO, 
  getSimulatedReading, 
  generateHistoricalData,
  INITIAL_ALERTS,
  INITIAL_SYNC_STATE,
  INITIAL_POWER_STATE,
  setHardwareConnectedState,
  getHardwareConnectedState
} from './mockData';
import { hwWebSocket } from './websocket';

export { setHardwareConnectedState, getHardwareConnectedState, hwWebSocket };

// When backend is running on port 5000, connect to Express + SQLite backend automatically
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * GET /api/sensor-data/latest
 * Fetch raw latest sensor data and connection status
 */
export async function getLatestSensorData() {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/sensor-data/latest`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend /api/sensor-data/latest unavailable:", err.message);
    }
  }
  return { success: false, data: null, connection: null };
}

/**
 * GET /api/debug/status
 * Diagnostic status for developer connection test section
 */
export async function getDebugStatus() {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/debug/status`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend /api/debug/status unavailable:", err.message);
    }
  }
  return {
    backend: "OFFLINE",
    esp8266: "DISCONNECTED",
    sensorStatus: "OFFLINE",
    lastPacket: "Never",
    packetsReceived: 0,
    webSocketClients: 0,
    lastSensorPacket: null
  };
}

/**
 * POST /api/sensor-data
 * Send test hardware sensor packet from dashboard for verification
 */
export async function sendTestSensorData(packet) {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/sensor-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packet)
      });
      return await res.json();
    } catch (err) {
      console.warn("Failed to send test sensor data:", err.message);
      return { success: false, error: err.message };
    }
  }
  return { success: false, error: "Backend API not reachable" };
}

// In-memory state for prototype simulation (allows dynamic alert resolution and sync triggers)
let alertsState = [...INITIAL_ALERTS];
let syncState = { ...INITIAL_SYNC_STATE };


/**
 * GET /api/platform
 * Fetch platform status, ID, NodeMCU status, battery, and location
 */
export async function getPlatformStatus() {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/platform`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend /api/platform unavailable, falling back to local simulation:", err.message);
    }
  }

  const reading = getSimulatedReading();
  return {
    platformId: PLATFORM_INFO.id,
    name: PLATFORM_INFO.name,
    controller: PLATFORM_INFO.controller,
    transceiver: PLATFORM_INFO.transceiver,
    hardwareConnected: reading.hardwareConnected,
    status: reading.nodeMcuStatus.toUpperCase(),
    nodeMcuStatus: reading.nodeMcuStatus,
    nodeMcuMessage: reading.nodeMcuMessage,
    loraStatus: reading.loraStatus,
    loraMessage: reading.loraMessage,
    battery: reading.battery,
    batteryVoltage: reading.batteryVoltage,
    batteryStatus: reading.batteryStatus,
    solarCharging: reading.solarCharging,
    sensorSystem: reading.sensorSystem,
    sensorSystemMessage: reading.sensorSystemMessage,
    coordinates: reading.coordinates,
    lastReceived: reading.timestamp,
    displayTime: reading.displayTime,
    displayDate: reading.displayDate,
    isSimulated: reading.isSimulated,
    simulationNotice: reading.isSimulated ? "SIMULATED DATA" : "LIVE HARDWARE TELEMETRY"
  };
}

/**
 * GET /api/sensors
 * Fetch latest readings from NodeMCU ESP8266 + LoRa payload
 * (DS18B20, DHT22, BMP280, MPU6050, GPS, and Simulated/Future Depth Sensor)
 */
export async function getLatestSensorReadings() {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/sensors`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend /api/sensors unavailable, falling back to local simulation:", err.message);
    }
  }

  return getSimulatedReading();
}

/**
 * GET /api/sensors/history
 * Fetch historical data for all 7 parameters across chosen range
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
      console.warn("Backend /api/sensors/history unavailable, falling back to local simulation:", err.message);
    }
  }

  const customStart = startDate ? new Date(startDate) : null;
  const customEnd = endDate ? new Date(endDate) : null;
  return generateHistoricalData(timeRange, customStart, customEnd);
}

/**
 * GET /api/alerts
 * Fetch active and resolved platform alerts
 */
export async function getAlerts() {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend /api/alerts unavailable, falling back to local simulation:", err.message);
    }
  }

  return [...alertsState];
}

/**
 * PATCH /api/alerts/:id (or local resolution)
 * Mark an alert as resolved
 */
export async function resolveAlert(alertId) {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/alerts/${alertId}/resolve`, { method: 'PATCH' });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend alert resolution failed:", err.message);
    }
  }

  // Update local state
  alertsState = alertsState.map((alt) => 
    alt.id === alertId ? { ...alt, status: 'Resolved' } : alt
  );
  return alertsState;
}

/**
 * GET /api/power
 * Fetch power system metrics (Battery, Solar, Consumption, NodeMCU, LoRa)
 */
export async function getPowerStatus() {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/power`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend /api/power unavailable, falling back to local simulation:", err.message);
    }
  }

  const live = getSimulatedReading();
  return {
    ...INITIAL_POWER_STATE,
    battery: live.battery,
    batteryVoltage: live.batteryVoltage,
    solarCharging: live.solarCharging,
    solarGeneration: live.solarGeneration,
    powerConsumption: live.powerConsumption,
    nodeMcuStatus: live.nodeMcuStatus,
    loraStatus: live.loraStatus,
    sensorSystem: live.sensorSystem,
    lastUpdated: live.timestamp,
    displayTime: live.displayTime,
    isSimulated: true
  };
}

/**
 * GET /api/sync
 * Fetch telemetry data synchronization metrics
 */
export async function getSyncStatus() {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/sync`);
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend /api/sync unavailable, falling back to local simulation:", err.message);
    }
  }

  return { ...syncState };
}

/**
 * POST /api/sync/trigger
 * Trigger manual or online sync of pending records
 */
export async function triggerSync() {
  if (API_BASE_URL) {
    try {
      const res = await fetch(`${API_BASE_URL}/sync/trigger`, { method: 'POST' });
      if (res.ok) return await res.json();
    } catch (err) {
      console.warn("Backend sync trigger failed:", err.message);
    }
  }

  // Simulate local sync completion
  syncState = {
    ...syncState,
    uploadedRecords: syncState.uploadedRecords + syncState.pendingRecords,
    pendingRecords: 0,
    lastSuccessfulSync: new Date().toISOString(),
    connectionStatus: "Connected"
  };
  return { ...syncState };
}

/**
 * Toggle offline status for data sync testing
 */
export function setLocalSyncConnection(isConnected) {
  syncState = {
    ...syncState,
    connectionStatus: isConnected ? "Connected" : "Offline",
    pendingRecords: isConnected ? syncState.pendingRecords : syncState.pendingRecords + 4
  };
  return { ...syncState };
}

/**
 * GET /api/export
 * Generate structured export data matching selected parameters and range
 */
export async function generateExportDataset({ platformId = "DHRUV-01", selectedParams = [], range = "24h" }) {
  const history = await getHistoricalTelemetry(range);
  const now = new Date();

  return history.map((row, idx) => {
    const timestamp = row.timestamp || new Date(now.getTime() - (history.length - idx) * 30 * 60000).toISOString();
    return {
      timestamp,
      platformId,
      gpsLatitude: 11.1271 + (Math.sin(idx * 0.1) * 0.001),
      gpsLongitude: 79.0755 + (Math.cos(idx * 0.1) * 0.001),
      waterTemperature: row.waterTemperature,
      airTemperature: row.airTemperature,
      humidity: row.humidity,
      atmosphericPressure: row.atmosphericPressure,
      depth: row.depth,
      roll: row.roll,
      pitch: row.pitch,
      battery: 82,
      batteryVoltage: 3.9,
      loraStatus: PLATFORM_INFO.loraStatus,
      nodeMcuStatus: PLATFORM_INFO.nodeMcuStatus
    };
  });
}
