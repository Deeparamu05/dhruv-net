/**
 * DHRUV-NET Backend Server
 * Technology Stack: Node.js + Express.js + WebSockets + SQLite 3 Database
 * 
 * Hardware Architecture:
 * Real Sensors (DS18B20, DHT22, BMP280, MPU6050, GPS)
 *   ↓
 * ESP8266 NodeMCU Microcontroller
 *   ↓
 * Wi-Fi (HTTP POST) / Future LoRa RA-02 Uplink
 *   ↓
 * Node.js + Express Backend + WebSocket Server (This Server)
 *   ↓
 * SQLite Database (server/dhruv_net.sqlite)
 *   ↓
 * WebSocket Broadcast
 *   ↓
 * DHRUV-NET Web Dashboard (Live Updates)
 */

require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const { WebSocketServer, WebSocket } = require('ws');
const db = require('./db');

const app = express();
const server = http.createServer(app);

// Configuration with environment variable overrides
const PORT = parseInt(process.env.PORT || '5000', 10);
const DEVICE_TIMEOUT = parseInt(process.env.DEVICE_TIMEOUT || '30000', 10); // 30 seconds
const STALE_TIMEOUT = parseInt(process.env.STALE_TIMEOUT || '15000', 10);   // 15 seconds

app.use(cors());
app.use(express.json());

// ==========================================
// In-Memory Hardware Telemetry & State Cache
// ==========================================
let lastSensorData = null;       // Latest validated real hardware sensor packet
let lastPacketTime = null;       // JS Date of last packet arrival
let totalPacketsReceived = 0;    // Counter of received hardware packets
let lastPacketSource = 'none';   // 'wifi' | 'lora' | 'none'
let previousConnectionState = null; // Track transitions to avoid broadcast spam

// ==========================================
// WebSocket Server Initialization
// ==========================================
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`🔌 [WebSocket]: Dashboard client connected from ${clientIp} (Total clients: ${wss.clients.size})`);

  // Send immediate initial state packet on connect
  const connStatus = getConnectionStatus();
  ws.send(JSON.stringify({
    type: 'INIT',
    data: lastSensorData,
    connection: connStatus,
    serverTime: new Date().toISOString()
  }));

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
      }
    } catch (e) {
      // Ignore non-json client pings
    }
  });

  ws.on('close', () => {
    console.log(`🔌 [WebSocket]: Dashboard client disconnected (Remaining clients: ${wss.clients.size})`);
  });

  ws.on('error', (err) => {
    console.error(`⚠️ [WebSocket Error]:`, err.message);
  });
});

/**
 * Broadcast message to all active WebSocket clients
 */
function broadcast(type, payload) {
  const message = JSON.stringify({ type, ...payload, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

/**
 * Compute real-time hardware connection status
 * States:
 * - CONNECTED (elapsed < DEVICE_TIMEOUT)
 * - DISCONNECTED (elapsed >= DEVICE_TIMEOUT or no packet received yet)
 * Sensor States:
 * - LIVE (elapsed < STALE_TIMEOUT)
 * - STALE (STALE_TIMEOUT <= elapsed < DEVICE_TIMEOUT)
 * - OFFLINE (elapsed >= DEVICE_TIMEOUT or never connected)
 */
function getConnectionStatus() {
  if (!lastPacketTime) {
    return {
      status: "DISCONNECTED",
      sensorStatus: "OFFLINE",
      message: "Waiting for hardware connection",
      lastSeen: "Never",
      lastSeenIso: null,
      elapsedSeconds: null,
      packetsReceived: totalPacketsReceived,
      timeoutMs: DEVICE_TIMEOUT,
      staleTimeoutMs: STALE_TIMEOUT,
      source: lastPacketSource
    };
  }

  const elapsedMs = Date.now() - lastPacketTime.getTime();
  const isConnected = elapsedMs < DEVICE_TIMEOUT;
  let sensorStatus = "OFFLINE";
  let message = "Hardware disconnected (timeout)";

  if (elapsedMs < STALE_TIMEOUT) {
    sensorStatus = "LIVE";
    message = "Streaming live physical sensor telemetry";
  } else if (elapsedMs < DEVICE_TIMEOUT) {
    sensorStatus = "STALE";
    message = "Sensor data stale (no packet in >15s)";
  } else {
    message = "Waiting for hardware connection";
  }

  const formattedLastSeen = lastPacketTime.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    hour12: true 
  });

  return {
    status: isConnected ? "CONNECTED" : "DISCONNECTED",
    sensorStatus,
    message,
    lastSeen: formattedLastSeen,
    lastSeenIso: lastPacketTime.toISOString(),
    elapsedSeconds: Math.floor(elapsedMs / 1000),
    packetsReceived: totalPacketsReceived,
    timeoutMs: DEVICE_TIMEOUT,
    staleTimeoutMs: STALE_TIMEOUT,
    source: lastPacketSource
  };
}

// Periodic ticker: Monitor connection timeouts & broadcast state transitions to dashboards
setInterval(() => {
  const current = getConnectionStatus();
  const stateKey = `${current.status}-${current.sensorStatus}`;

  // Broadcast if state transitioned (e.g., LIVE -> STALE or STALE -> OFFLINE) or every 10 seconds heartbeat
  if (previousConnectionState !== stateKey) {
    previousConnectionState = stateKey;
    broadcast('STATUS_UPDATE', { connection: current });
  }
}, 1000);

// Initialize SQLite Database tables and load last hardware telemetry if available
db.initDatabase()
  .then(async () => {
    console.log("💾 SQLite Database initialized successfully.");
    try {
      // Check if any real hardware packet exists in SQLite from previous run
      const realTelemetry = await db.getLatestTelemetry(true);
      if (realTelemetry) {
        lastSensorData = {
          deviceId: realTelemetry.platformId || "DHRUV-01",
          platformId: realTelemetry.platformId || "DHRUV-01",
          waterTemperature: realTelemetry.waterTemperature,
          airTemperature: realTelemetry.airTemperature,
          humidity: realTelemetry.humidity,
          pressure: realTelemetry.atmosphericPressure,
          atmosphericPressure: realTelemetry.atmosphericPressure,
          depth: realTelemetry.depth,
          latitude: realTelemetry.latitude,
          longitude: realTelemetry.longitude,
          roll: realTelemetry.roll,
          pitch: realTelemetry.pitch,
          yaw: realTelemetry.yaw,
          battery: realTelemetry.battery,
          batteryVoltage: realTelemetry.batteryVoltage,
          timestamp: realTelemetry.timestamp,
          source: 'sqlite-cache'
        };
        // NOTE: On server startup, hardware is initially DISCONNECTED until a fresh packet arrives.
        console.log(`ℹ️ [SQLite Cache]: Loaded last known hardware packet (${realTelemetry.platformId}) from SQLite.`);
      }
    } catch (e) {
      console.warn("Could not check SQLite for previous hardware packets:", e.message);
    }
  })
  .catch((err) => {
    console.error("⚠️ SQLite init warning:", err.message);
  });

// ==========================================
// REST API ENDPOINTS
// ==========================================

/**
 * 1. POST /api/sensor-data
 * Primary ingestion endpoint for ESP8266 NodeMCU over Wi-Fi
 * 
 * Expected JSON:
 * {
 *   "deviceId": "DHRUV-01",
 *   "waterTemperature": 28.2,
 *   "airTemperature": 29.8,
 *   "humidity": 75,
 *   "pressure": 1009.6,
 *   "depth": 18.6,
 *   "latitude": 11.6643,
 *   "longitude": 78.1460,
 *   "timestamp": "2026-09-28T11:30:00Z"
 * }
 */
app.post('/api/sensor-data', async (req, res) => {
  try {
    const body = req.body;

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      console.warn("[Validation Error]: Body must be a JSON object");
      return res.status(400).json({ success: false, error: "Invalid JSON payload: body must be an object" });
    }

    // Validate numeric fields if present
    const numericFields = [
      'waterTemperature',
      'airTemperature',
      'humidity',
      'pressure',
      'depth',
      'latitude',
      'longitude',
      'roll',
      'pitch',
      'yaw',
      'battery',
      'batteryVoltage'
    ];

    for (const field of numericFields) {
      const val = body[field];
      if (val !== undefined && val !== null) {
        if (typeof val === 'boolean' || isNaN(Number(val)) || (typeof val === 'string' && val.trim() === '')) {
          console.warn(`[Validation Error]: Field '${field}' has invalid value:`, val);
          return res.status(400).json({
            success: false,
            error: `Invalid sensor value for '${field}': must be a valid number, received ${typeof val}`
          });
        }
      }
    }

    // Device Identifier (defaults to DHRUV-01 if unspecified)
    const deviceId = (body.deviceId && typeof body.deviceId === 'string' && body.deviceId.trim()) 
      ? body.deviceId.trim() 
      : 'DHRUV-01';

    const now = new Date();
    const packetTimestamp = body.timestamp && typeof body.timestamp === 'string' 
      ? body.timestamp 
      : now.toISOString();

    // Construct normalized sensor data packet (never crash if single sensor is absent/null)
    const normalizedData = {
      deviceId,
      platformId: deviceId,
      waterTemperature: body.waterTemperature !== undefined && body.waterTemperature !== null ? Number(body.waterTemperature) : (lastSensorData?.waterTemperature ?? null),
      airTemperature: body.airTemperature !== undefined && body.airTemperature !== null ? Number(body.airTemperature) : (lastSensorData?.airTemperature ?? null),
      humidity: body.humidity !== undefined && body.humidity !== null ? Number(body.humidity) : (lastSensorData?.humidity ?? null),
      pressure: body.pressure !== undefined && body.pressure !== null ? Number(body.pressure) : (lastSensorData?.pressure ?? null),
      atmosphericPressure: body.pressure !== undefined && body.pressure !== null ? Number(body.pressure) : (lastSensorData?.atmosphericPressure ?? null),
      depth: body.depth !== undefined && body.depth !== null ? Number(body.depth) : (lastSensorData?.depth ?? null),
      latitude: body.latitude !== undefined && body.latitude !== null ? Number(body.latitude) : (lastSensorData?.latitude ?? 11.6643),
      longitude: body.longitude !== undefined && body.longitude !== null ? Number(body.longitude) : (lastSensorData?.longitude ?? 78.1460),
      roll: body.roll !== undefined && body.roll !== null ? Number(body.roll) : (lastSensorData?.roll ?? 0.0),
      pitch: body.pitch !== undefined && body.pitch !== null ? Number(body.pitch) : (lastSensorData?.pitch ?? 0.0),
      yaw: body.yaw !== undefined && body.yaw !== null ? Number(body.yaw) : (lastSensorData?.yaw ?? 0.0),
      battery: body.battery !== undefined && body.battery !== null ? Number(body.battery) : (lastSensorData?.battery ?? 85),
      batteryVoltage: body.batteryVoltage !== undefined && body.batteryVoltage !== null ? Number(body.batteryVoltage) : (lastSensorData?.batteryVoltage ?? 4.0),
      timestamp: packetTimestamp,
      source: body.source || 'wifi'
    };

    // Update in-memory cache and heartbeat tracker
    lastSensorData = normalizedData;
    lastPacketTime = now;
    totalPacketsReceived++;
    lastPacketSource = normalizedData.source;

    // Persist to SQLite Database
    const sqlitePayload = {
      ...normalizedData,
      isHardware: 1,
      hardwareConnected: true,
      nodeMcuStatus: 'CONNECTED',
      nodeMcuMessage: `Connected via Wi-Fi (${normalizedData.source.toUpperCase()})`,
      loraStatus: 'NOT CONNECTED',
      loraMessage: 'Waiting for LoRa gateway (Future Uplink)',
      sensorSystem: 'LIVE',
      sensorSystemMessage: 'Streaming live physical sensor telemetry'
    };

    db.insertTelemetry(sqlitePayload).catch(err => {
      console.error("⚠️ SQLite telemetry insert error:", err.message);
    });

    db.updatePlatformState({
      hardwareConnected: true,
      lastHardwareHeartbeat: now.getTime(),
      nodeMcuStatus: 'CONNECTED',
      nodeMcuMessage: `Connected via Wi-Fi (${normalizedData.source.toUpperCase()})`,
      loraStatus: 'NOT CONNECTED',
      loraMessage: 'Waiting for LoRa gateway (Future Uplink)',
      sensorSystem: 'LIVE',
      sensorSystemMessage: 'Streaming live physical sensor telemetry'
    }).catch(err => {
      console.error("⚠️ SQLite platform state update error:", err.message);
    });

    const connStatus = getConnectionStatus();

    // Broadcast to all connected dashboards via WebSocket
    broadcast('SENSOR_UPDATE', {
      data: normalizedData,
      connection: connStatus
    });

    console.log(`📥 [ESP8266 Wi-Fi]: Packet #${totalPacketsReceived} from ${deviceId} | Water: ${normalizedData.waterTemperature}°C, Air: ${normalizedData.airTemperature}°C, Hum: ${normalizedData.humidity}%, Press: ${normalizedData.pressure} hPa`);

    return res.status(200).json({
      success: true,
      message: "Sensor data received"
    });
  } catch (err) {
    console.error("❌ POST /api/sensor-data server error:", err);
    return res.status(500).json({ success: false, error: "Internal server error processing sensor data" });
  }
});

/**
 * 2. GET /api/sensor-data/latest
 * Fetch latest sensor reading and connection health
 */
app.get('/api/sensor-data/latest', (req, res) => {
  const conn = getConnectionStatus();
  res.json({
    success: true,
    data: lastSensorData,
    connection: conn
  });
});

/**
 * 3. GET /api/debug/status
 * Hardware Integration & Connection Test Diagnostic Endpoint
 */
app.get('/api/debug/status', (req, res) => {
  const conn = getConnectionStatus();
  res.json({
    backend: "ONLINE",
    esp8266: conn.status,
    sensorStatus: conn.sensorStatus,
    lastPacket: conn.lastSeen,
    lastPacketIso: conn.lastSeenIso,
    elapsedSeconds: conn.elapsedSeconds,
    packetsReceived: conn.packetsReceived,
    webSocketClients: wss.clients.size,
    lastSensorPacket: lastSensorData,
    config: {
      port: PORT,
      deviceTimeoutMs: DEVICE_TIMEOUT,
      staleTimeoutMs: STALE_TIMEOUT,
      database: "SQLite 3"
    }
  });
});

/**
 * 4. GET /api/platform
 * Platform overview, device connection status, coordinates, battery
 */
app.get('/api/platform', async (req, res) => {
  try {
    const conn = getConnectionStatus();
    const isConn = conn.status === "CONNECTED";
    const hasData = lastSensorData !== null;

    res.json({
      platformId: (lastSensorData && lastSensorData.deviceId) || "DHRUV-01",
      name: "DHRUV-NET Autonomous Ocean Observation Platform",
      controller: "NodeMCU ESP8266",
      transceiver: "Wi-Fi (802.11 b/g/n) & LoRa RA-02 Ready",
      hardwareConnected: isConn,

      // Connection Status fields
      status: conn.status,
      nodeMcuStatus: conn.status, // "CONNECTED" or "DISCONNECTED"
      nodeMcuMessage: isConn 
        ? `Hardware connected via Wi-Fi (Last Seen: ${conn.lastSeen})` 
        : (hasData ? `Hardware disconnected (Last Seen: ${conn.lastSeen})` : "Waiting for hardware connection"),
      lastSeen: conn.lastSeen,
      lastSeenIso: conn.lastSeenIso,
      packetsReceived: conn.packetsReceived,

      // Sensor Status fields: LIVE | STALE | OFFLINE
      sensorSystem: conn.sensorStatus,
      sensorSystemMessage: conn.message,

      // LoRa Status
      loraStatus: "NOT CONNECTED",
      loraMessage: "Waiting for LoRa gateway (Future Uplink)",

      battery: lastSensorData?.battery ?? 82,
      batteryVoltage: lastSensorData?.batteryVoltage ?? 3.9,
      coordinates: {
        lat: lastSensorData?.latitude ?? 11.1271,
        lng: lastSensorData?.longitude ?? 79.0755,
        formatted: `${(lastSensorData?.latitude ?? 11.1271).toFixed(4)}° N, ${(lastSensorData?.longitude ?? 79.0755).toFixed(4)}° E`
      },
      lastReceived: conn.lastSeenIso || new Date().toISOString(),
      isSimulated: conn.packetsReceived === 0,
      simulationNotice: conn.packetsReceived > 0 ? (conn.sensorStatus === 'LIVE' ? "LIVE HARDWARE TELEMETRY" : "LAST KNOWN HARDWARE DATA") : "SIMULATED DATA",
      database: "SQLite 3"
    });
  } catch (err) {
    console.error("GET /api/platform error:", err);
    res.status(500).json({ error: "Database error fetching platform state" });
  }
});

/**
 * 5. GET /api/sensors
 * Latest readings from all physical sensors
 */
app.get('/api/sensors', async (req, res) => {
  try {
    const conn = getConnectionStatus();
    const isConn = conn.status === "CONNECTED";
    const sensorStatus = conn.sensorStatus; // LIVE | STALE | OFFLINE

    // If real data exists, use real data. Else fall back to baseline.
    const waterTemp = lastSensorData?.waterTemperature ?? 27.4;
    const airTemp = lastSensorData?.airTemperature ?? 29.1;
    const humidity = lastSensorData?.humidity ?? 72;
    const pressure = lastSensorData?.pressure ?? lastSensorData?.atmosphericPressure ?? 1008.4;
    const depth = lastSensorData?.depth ?? 18.6;
    const roll = lastSensorData?.roll ?? 1.8;
    const pitch = lastSensorData?.pitch ?? -0.7;
    const yaw = lastSensorData?.yaw ?? 42.5;
    const lat = lastSensorData?.latitude ?? 11.1271;
    const lng = lastSensorData?.longitude ?? 79.0755;

    res.json({
      timestamp: lastSensorData?.timestamp || new Date().toISOString(),
      platformId: lastSensorData?.deviceId || "DHRUV-01",
      controller: "NodeMCU ESP8266",
      hardwareConnected: isConn,
      connection: conn,
      battery: lastSensorData?.battery ?? null,
      batteryVoltage: lastSensorData?.batteryVoltage ?? null,
      coordinates: {
        lat: lat,
        lng: lng,
        formatted: `${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E`
      },
      sensors: {
        waterTemperature: {
          name: "Water Temperature",
          value: waterTemp,
          unit: "°C",
          source: "DS18B20",
          status: sensorStatus === 'LIVE' ? "Normal" : (sensorStatus === 'STALE' ? "STALE" : "OFFLINE"),
          lastUpdated: conn.lastSeen !== "Never" ? conn.lastSeen : "Waiting for hardware"
        },
        airTemperature: {
          name: "Air Temperature",
          value: airTemp,
          unit: "°C",
          source: "DHT22",
          status: sensorStatus === 'LIVE' ? "Normal" : (sensorStatus === 'STALE' ? "STALE" : "OFFLINE"),
          lastUpdated: conn.lastSeen !== "Never" ? conn.lastSeen : "Waiting for hardware"
        },
        humidity: {
          name: "Humidity",
          value: humidity,
          unit: "%",
          source: "DHT22",
          status: sensorStatus === 'LIVE' ? "Normal" : (sensorStatus === 'STALE' ? "STALE" : "OFFLINE"),
          lastUpdated: conn.lastSeen !== "Never" ? conn.lastSeen : "Waiting for hardware"
        },
        atmosphericPressure: {
          name: "Atmospheric Pressure",
          value: pressure,
          unit: "hPa",
          source: "BMP280",
          status: sensorStatus === 'LIVE' ? "Normal" : (sensorStatus === 'STALE' ? "STALE" : "OFFLINE"),
          lastUpdated: conn.lastSeen !== "Never" ? conn.lastSeen : "Waiting for hardware"
        },
        depth: {
          name: "Ocean Depth",
          value: depth,
          unit: "m",
          source: "Simulated / Future Sensor",
          status: "Normal",
          simulationNotice: "SIMULATED / FUTURE SENSOR",
          lastUpdated: "Just now"
        },
        orientation: {
          name: "Platform Orientation",
          roll: roll,
          pitch: pitch,
          yaw: yaw,
          unit: "°",
          source: "MPU6050",
          status: sensorStatus === 'LIVE' ? "Normal" : (sensorStatus === 'STALE' ? "STALE" : "OFFLINE"),
          lastUpdated: conn.lastSeen !== "Never" ? conn.lastSeen : "Waiting for hardware"
        },
        lora: {
          name: "LoRa Communication",
          status: "NOT CONNECTED",
          message: "Waiting for LoRa gateway (Future Uplink)",
          source: "LoRa RA-02",
          rssi: "Standby (Disconnected)",
          snr: "N/A",
          lastUpdated: "Waiting for gateway"
        },
        gps: {
          name: "GPS Positioning",
          latitude: lat,
          longitude: lng,
          source: "GPS",
          satellites: isConn ? 12 : 0,
          status: sensorStatus === 'LIVE' ? "Normal" : (sensorStatus === 'STALE' ? "STALE" : "OFFLINE"),
          lastUpdated: conn.lastSeen !== "Never" ? conn.lastSeen : "Waiting for hardware"
        }
      }
    });
  } catch (err) {
    console.error("GET /api/sensors error:", err);
    res.status(500).json({ error: "Database error fetching sensor readings" });
  }
});

/**
 * 6. POST /api/telemetry
 * Retained for LoRa RA-02 Gateway compatibility.
 * Accepts LoRa payload and bridges into WebSocket + SQLite
 */
app.post('/api/telemetry', async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || (!payload.platformId && !payload.deviceId)) {
      return res.status(400).json({ error: "Invalid telemetry packet: missing platformId or deviceId" });
    }

    const deviceId = payload.deviceId || payload.platformId || "DHRUV-01";
    const now = new Date();

    const normalizedData = {
      deviceId,
      platformId: deviceId,
      waterTemperature: payload.waterTemperature !== undefined ? Number(payload.waterTemperature) : null,
      airTemperature: payload.airTemperature !== undefined ? Number(payload.airTemperature) : null,
      humidity: payload.humidity !== undefined ? Number(payload.humidity) : null,
      pressure: payload.atmosphericPressure ?? payload.pressure ?? null,
      atmosphericPressure: payload.atmosphericPressure ?? payload.pressure ?? null,
      depth: payload.depth !== undefined ? Number(payload.depth) : null,
      latitude: payload.latitude !== undefined ? Number(payload.latitude) : 11.1271,
      longitude: payload.longitude !== undefined ? Number(payload.longitude) : 79.0755,
      roll: payload.roll !== undefined ? Number(payload.roll) : 0,
      pitch: payload.pitch !== undefined ? Number(payload.pitch) : 0,
      yaw: payload.yaw !== undefined ? Number(payload.yaw) : 0,
      battery: payload.battery !== undefined ? Number(payload.battery) : 85,
      batteryVoltage: payload.batteryVoltage !== undefined ? Number(payload.batteryVoltage) : 4.0,
      timestamp: payload.timestamp || now.toISOString(),
      source: payload.source || 'lora'
    };

    lastSensorData = normalizedData;
    lastPacketTime = now;
    totalPacketsReceived++;
    lastPacketSource = 'lora';

    await db.insertTelemetry({
      ...normalizedData,
      isHardware: 1,
      nodeMcuStatus: 'CONNECTED',
      loraStatus: 'CONNECTED',
      sensorSystem: 'LIVE'
    });

    const connStatus = getConnectionStatus();
    broadcast('SENSOR_UPDATE', {
      data: normalizedData,
      connection: connStatus
    });

    res.json({
      success: true,
      receivedAt: normalizedData.timestamp,
      storedInSqlite: true,
      hardwareConnected: true
    });
  } catch (err) {
    console.error("POST /api/telemetry error:", err);
    res.status(500).json({ error: "Database error ingesting telemetry packet" });
  }
});

/**
 * 7. GET /api/sensors/history
 * Historical telemetry for charts & analytics from SQLite
 */
app.get('/api/sensors/history', async (req, res) => {
  try {
    const range = req.query.range || '24h';
    const limit = range === '1h' ? 60 : range === '7d' ? 168 : 48;
    const history = await db.getTelemetryHistory(range, limit);
    res.json(history);
  } catch (err) {
    console.error("GET /api/sensors/history error:", err);
    res.status(500).json({ error: "Database error fetching telemetry history" });
  }
});

/**
 * 8. GET /api/alerts
 * Alerts list stored in SQLite
 */
app.get('/api/alerts', async (req, res) => {
  try {
    const alertsList = await db.getAlerts();
    res.json(alertsList);
  } catch (err) {
    console.error("GET /api/alerts error:", err);
    res.status(500).json({ error: "Database error fetching alerts" });
  }
});

/**
 * 9. PATCH /api/alerts/:id/resolve
 */
app.patch('/api/alerts/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedAlerts = await db.resolveAlert(id);
    res.json({ success: true, alerts: updatedAlerts });
  } catch (err) {
    console.error("PATCH /api/alerts/:id/resolve error:", err);
    res.status(500).json({ error: "Database error resolving alert" });
  }
});

/**
 * 10. GET /api/power
 */
app.get('/api/power', async (req, res) => {
  try {
    const conn = getConnectionStatus();
    const isConn = conn.status === "CONNECTED";
    res.json({
      battery: lastSensorData?.battery || 82,
      batteryVoltage: lastSensorData?.batteryVoltage || 3.9,
      solarCharging: isConn ? "Active" : "Standby",
      solarGeneration: isConn ? 4.8 : 0.0,
      powerConsumption: isConn ? 1.7 : 0.4,
      hardwareConnected: isConn,
      nodeMcuStatus: conn.status,
      loraStatus: "NOT CONNECTED",
      sensorSystem: conn.sensorStatus,
      deepSleep: "Inactive",
      platformState: isConn ? "Active" : "Standby",
      lastUpdated: conn.lastSeenIso || new Date().toISOString()
    });
  } catch (err) {
    console.error("GET /api/power error:", err);
    res.status(500).json({ error: "Database error fetching power metrics" });
  }
});

/**
 * 11. GET /api/sync
 */
app.get('/api/sync', async (req, res) => {
  try {
    const syncStats = await db.getSyncStats();
    res.json(syncStats);
  } catch (err) {
    console.error("GET /api/sync error:", err);
    res.status(500).json({ error: "Database error fetching sync metrics" });
  }
});

/**
 * 12. POST /api/sync/trigger
 */
app.post('/api/sync/trigger', async (req, res) => {
  try {
    const current = await db.getSyncStats();
    const updated = await db.updateSyncStats({
      uploadedRecords: (current.uploadedRecords || 0) + (current.pendingRecords || 0),
      pendingRecords: 0,
      lastSuccessfulSync: new Date().toISOString()
    });
    res.json({ success: true, ...updated });
  } catch (err) {
    console.error("POST /api/sync/trigger error:", err);
    res.status(500).json({ error: "Database error triggering sync" });
  }
});

/**
 * 13. GET /api/export
 */
app.get('/api/export', async (req, res) => {
  try {
    const range = req.query.range || '24h';
    const limit = range === '1h' ? 60 : range === '7d' ? 168 : 100;
    const history = await db.getTelemetryHistory(range, limit);

    res.json(history.map(pt => ({
      timestamp: pt.timestamp,
      platformId: pt.platformId,
      gpsLatitude: pt.latitude,
      gpsLongitude: pt.longitude,
      waterTemperature: pt.waterTemperature,
      airTemperature: pt.airTemperature,
      humidity: pt.humidity,
      atmosphericPressure: pt.atmosphericPressure,
      depth: pt.depth,
      roll: pt.roll,
      pitch: pt.pitch,
      battery: pt.battery,
      batteryVoltage: pt.batteryVoltage,
      loraStatus: pt.loraStatus,
      nodeMcuStatus: pt.nodeMcuStatus
    })));
  } catch (err) {
    console.error("GET /api/export error:", err);
    res.status(500).json({ error: "Database error exporting telemetry" });
  }
});

/**
 * 14. GET /api/database/stats
 */
app.get('/api/database/stats', async (req, res) => {
  try {
    const stats = await db.getDatabaseStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve SQLite database statistics" });
  }
});

/**
 * 15. GET /api/health
 */
app.get('/api/health', async (req, res) => {
  const dbStats = await db.getDatabaseStats();
  const conn = getConnectionStatus();
  res.json({
    status: "ok",
    service: "DHRUV-NET Ocean Observation Platform Backend",
    architecture: "ESP8266 (Wi-Fi) -> Express + WebSocket -> SQLite 3 -> Dashboard",
    timestamp: new Date().toISOString(),
    hardware: conn,
    database: dbStats
  });
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 DHRUV-NET Backend & WebSocket Server active`);
    console.log(`Port: ${PORT} | Device Timeout: ${DEVICE_TIMEOUT}ms | Stale Timeout: ${STALE_TIMEOUT}ms`);
    console.log(`REST Ingestion: POST http://localhost:${PORT}/api/sensor-data`);
    console.log(`REST Status:    GET  http://localhost:${PORT}/api/sensor-data/latest`);
    console.log(`WebSocket URL:  ws://localhost:${PORT}`);
    console.log(`Diagnostic:     GET  http://localhost:${PORT}/api/debug/status`);
    console.log(`Database File:  ${db.DB_PATH}`);
    console.log(`====================================================`);
  });
}

module.exports = { app, server };
