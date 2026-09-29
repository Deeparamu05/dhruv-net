/**
 * DHRUV-NET SQLite Database Service
 * Database File: server/dhruv_net.sqlite
 * 
 * Manages persistent storage for:
 * 1. Telemetry Stream (Physical & Simulated Sensor Readings)
 * 2. Alerts & Anomaly Warnings
 * 3. Synchronization & Edge Buffer State
 * 4. Platform Hardware Connection State
 */

const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'dhruv_net.sqlite');
const FALLBACK_JSON_PATH = path.join(__dirname, 'dhruv_net_store.json');

let sqlite3;
try {
  sqlite3 = require('sqlite3').verbose();
} catch (e) {
  // If sqlite3 package is not yet installed, fallback gracefully to persistent JSON file store
  sqlite3 = null;
}

let db = null;
let isNativeSqlite = false;

// Fallback in-memory/JSON store if sqlite3 driver is not yet installed
let fallbackStore = {
  telemetry: [],
  alerts: [],
  sync_records: {
    id: 1,
    local_records: 248,
    uploaded_records: 230,
    pending_records: 18,
    last_successful_sync: new Date().toISOString(),
    connection_status: "Connected"
  },
  platform_state: {
    id: 1,
    platform_id: "DHRUV-01",
    hardware_connected: 0,
    last_hardware_heartbeat: null,
    node_mcu_status: "NOT CONNECTED",
    node_mcu_message: "Waiting for hardware connection",
    lora_status: "NOT CONNECTED",
    lora_message: "Waiting for LoRa gateway",
    sensor_system: "SIMULATED",
    sensor_system_message: "Using simulated sensor data",
    updated_at: new Date().toISOString()
  }
};

// Initial Alerts Seed
const INITIAL_ALERTS_SEED = [
  {
    id: "ALT-1082",
    alert_type: "Abnormal Atmospheric Pressure",
    platform_id: "DHRUV-01",
    date: new Date().toISOString().slice(0, 10),
    time: "17:42:10",
    current_value: "998.2 hPa",
    reason: "Rapid barometric pressure drop detected by BMP280.",
    severity: "Critical",
    status: "Active",
    source: "BMP280"
  },
  {
    id: "ALT-1081",
    alert_type: "Excessive Platform Tilt",
    platform_id: "DHRUV-01",
    date: new Date().toISOString().slice(0, 10),
    time: "16:15:33",
    current_value: "Roll: 6.8°, Pitch: -4.2°",
    reason: "Platform swell roll exceeded 5.0° threshold via MPU6050.",
    severity: "Warning",
    status: "Active",
    source: "MPU6050"
  }
];

/**
 * Initialize SQLite Database & Tables
 */
function initDatabase() {
  return new Promise((resolve) => {
    if (!sqlite3) {
      console.log("ℹ️  [SQLite Notice]: 'sqlite3' npm package not detected in current node_modules.");
      console.log("ℹ️  Using persistent JSON storage at: " + FALLBACK_JSON_PATH);
      console.log("ℹ️  To enable native C++ SQLite engine, run: npm install sqlite3 --prefix server");
      loadFallbackFromDisk();
      return resolve(false);
    }

    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error("❌ Failed to connect to SQLite database:", err.message);
        loadFallbackFromDisk();
        return resolve(false);
      }

      console.log(" Connected to SQLite database at:", DB_PATH);
      isNativeSqlite = true;

      // Enable WAL mode for high concurrency
      db.run("PRAGMA journal_mode = WAL;");

      db.serialize(() => {
        // 1. Telemetry Table
        db.run(`
          CREATE TABLE IF NOT EXISTS telemetry (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            platform_id TEXT NOT NULL,
            water_temperature REAL,
            air_temperature REAL,
            humidity REAL,
            atmospheric_pressure REAL,
            roll REAL,
            pitch REAL,
            yaw REAL,
            latitude REAL,
            longitude REAL,
            depth REAL,
            battery INTEGER,
            battery_voltage REAL,
            solar_generation REAL,
            power_consumption REAL,
            solar_charging TEXT,
            deep_sleep TEXT,
            platform_state TEXT,
            lora_rssi INTEGER,
            lora_snr REAL,
            is_hardware INTEGER DEFAULT 0,
            node_mcu_status TEXT,
            lora_status TEXT,
            sensor_system TEXT
          )
        `);

        // Index on timestamp for rapid range queries
        db.run(`CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry(timestamp DESC);`);

        // 2. Alerts Table
        db.run(`
          CREATE TABLE IF NOT EXISTS alerts (
            id TEXT PRIMARY KEY,
            alert_type TEXT NOT NULL,
            platform_id TEXT NOT NULL,
            date TEXT,
            time TEXT,
            current_value TEXT,
            reason TEXT,
            severity TEXT,
            status TEXT,
            source TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // 3. Sync Records Table
        db.run(`
          CREATE TABLE IF NOT EXISTS sync_records (
            id INTEGER PRIMARY KEY,
            local_records INTEGER,
            uploaded_records INTEGER,
            pending_records INTEGER,
            last_successful_sync TEXT,
            connection_status TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // 4. Platform State Table
        db.run(`
          CREATE TABLE IF NOT EXISTS platform_state (
            id INTEGER PRIMARY KEY,
            platform_id TEXT NOT NULL,
            hardware_connected INTEGER DEFAULT 0,
            last_hardware_heartbeat INTEGER,
            node_mcu_status TEXT,
            node_mcu_message TEXT,
            lora_status TEXT,
            lora_message TEXT,
            sensor_system TEXT,
            sensor_system_message TEXT,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Seed initial platform state if empty
        db.get(`SELECT COUNT(*) as count FROM platform_state WHERE id = 1`, (err, row) => {
          if (!err && row && row.count === 0) {
            db.run(`
              INSERT INTO platform_state (
                id, platform_id, hardware_connected, last_hardware_heartbeat,
                node_mcu_status, node_mcu_message, lora_status, lora_message,
                sensor_system, sensor_system_message
              ) VALUES (
                1, 'DHRUV-01', 0, NULL,
                'NOT CONNECTED', 'Waiting for hardware connection',
                'NOT CONNECTED', 'Waiting for LoRa gateway',
                'SIMULATED', 'Using simulated sensor data'
              )
            `);
          }
        });

        // Seed initial sync state if empty
        db.get(`SELECT COUNT(*) as count FROM sync_records WHERE id = 1`, (err, row) => {
          if (!err && row && row.count === 0) {
            db.run(`
              INSERT INTO sync_records (
                id, local_records, uploaded_records, pending_records,
                last_successful_sync, connection_status
              ) VALUES (
                1, 248, 230, 18, datetime('now'), 'Connected'
              )
            `);
          }
        });

        // Seed initial alerts if empty
        db.get(`SELECT COUNT(*) as count FROM alerts`, (err, row) => {
          if (!err && row && row.count === 0) {
            const stmt = db.prepare(`
              INSERT OR IGNORE INTO alerts (
                id, alert_type, platform_id, date, time, current_value, reason, severity, status, source
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            INITIAL_ALERTS_SEED.forEach(alt => {
              stmt.run(alt.id, alt.alert_type, alt.platform_id, alt.date, alt.time, alt.current_value, alt.reason, alt.severity, alt.status, alt.source);
            });
            stmt.finalize();
          }
        });

        // Seed initial baseline telemetry readings if table is empty
        db.get(`SELECT COUNT(*) as count FROM telemetry`, (err, row) => {
          if (!err && row && row.count === 0) {
            seedInitialTelemetry();
          }
        });

        resolve(true);
      });
    });
  });
}

/**
 * Seed historical telemetry points into SQLite
 */
function seedInitialTelemetry() {
  if (!isNativeSqlite || !db) return;
  const now = Date.now();
  const stmt = db.prepare(`
    INSERT INTO telemetry (
      timestamp, platform_id, water_temperature, air_temperature, humidity, atmospheric_pressure,
      roll, pitch, yaw, latitude, longitude, depth, battery, battery_voltage,
      solar_generation, power_consumption, solar_charging, deep_sleep, platform_state,
      lora_rssi, lora_snr, is_hardware, node_mcu_status, lora_status, sensor_system
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 48; i >= 0; i--) {
    const t = new Date(now - i * 1800000).toISOString();
    stmt.run(
      t,
      'DHRUV-01',
      +(27.4 + Math.sin(i * 0.2) * 0.8).toFixed(1),
      +(29.1 + Math.sin(i * 0.15) * 1.5).toFixed(1),
      Math.round(72 + Math.cos(i * 0.2) * 6),
      +(1008.4 + Math.cos(i * 0.1) * 1.8).toFixed(1),
      +(1.8 + Math.sin(i * 0.5) * 1.2).toFixed(1),
      +(-0.7 + Math.cos(i * 0.5) * 0.9).toFixed(1),
      +(42.5 + Math.sin(i * 0.1) * 0.5).toFixed(1),
      +(11.1271 + Math.sin(i * 0.05) * 0.0004).toFixed(5),
      +(79.0755 + Math.cos(i * 0.05) * 0.0004).toFixed(5),
      +(18.6 + Math.sin(i * 0.3) * 0.4).toFixed(1),
      82,
      3.9,
      4.8,
      1.7,
      'Active',
      'Inactive',
      'Standby / Simulated',
      null,
      null,
      0,
      'NOT CONNECTED',
      'NOT CONNECTED',
      'SIMULATED'
    );
  }
  stmt.finalize();
}

/**
 * Save Telemetry Packet to SQLite
 */
function insertTelemetry(packet) {
  return new Promise((resolve, reject) => {
    const isHw = packet.isHardware ? 1 : (packet.hardwareConnected ? 1 : 0);
    const timestamp = packet.timestamp || new Date().toISOString();

    if (isNativeSqlite && db) {
      const sql = `
        INSERT INTO telemetry (
          timestamp, platform_id, water_temperature, air_temperature, humidity, atmospheric_pressure,
          roll, pitch, yaw, latitude, longitude, depth, battery, battery_voltage,
          solar_generation, power_consumption, solar_charging, deep_sleep, platform_state,
          lora_rssi, lora_snr, is_hardware, node_mcu_status, lora_status, sensor_system
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      db.run(sql, [
        timestamp,
        packet.platformId || 'DHRUV-01',
        packet.waterTemperature ?? 27.4,
        packet.airTemperature ?? 29.1,
        packet.humidity ?? 72,
        packet.atmosphericPressure ?? 1008.4,
        packet.roll ?? 1.8,
        packet.pitch ?? -0.7,
        packet.yaw ?? 42.5,
        packet.latitude ?? 11.1271,
        packet.longitude ?? 79.0755,
        packet.depth ?? 18.6,
        packet.battery ?? 82,
        packet.batteryVoltage ?? 3.9,
        packet.solarGeneration ?? 4.8,
        packet.powerConsumption ?? 1.7,
        packet.solarCharging || 'Active',
        packet.deepSleep || 'Inactive',
        packet.platformState || (isHw ? 'Active' : 'Standby / Simulated'),
        packet.loraRssi ?? null,
        packet.loraSnr ?? null,
        isHw,
        packet.nodeMcuStatus || (isHw ? 'ONLINE' : 'NOT CONNECTED'),
        packet.loraStatus || (isHw ? 'CONNECTED' : 'NOT CONNECTED'),
        packet.sensorSystem || (isHw ? 'LIVE' : 'SIMULATED')
      ], function(err) {
        if (err) return reject(err);
        resolve({ id: this.lastID, timestamp });
      });
    } else {
      // Fallback in-memory / JSON store
      const row = {
        id: fallbackStore.telemetry.length + 1,
        timestamp,
        platform_id: packet.platformId || 'DHRUV-01',
        water_temperature: packet.waterTemperature ?? 27.4,
        air_temperature: packet.airTemperature ?? 29.1,
        humidity: packet.humidity ?? 72,
        atmospheric_pressure: packet.atmosphericPressure ?? 1008.4,
        roll: packet.roll ?? 1.8,
        pitch: packet.pitch ?? -0.7,
        yaw: packet.yaw ?? 42.5,
        latitude: packet.latitude ?? 11.1271,
        longitude: packet.longitude ?? 79.0755,
        depth: packet.depth ?? 18.6,
        battery: packet.battery ?? 82,
        battery_voltage: packet.batteryVoltage ?? 3.9,
        solar_generation: packet.solarGeneration ?? 4.8,
        power_consumption: packet.powerConsumption ?? 1.7,
        solar_charging: packet.solarCharging || 'Active',
        deep_sleep: packet.deepSleep || 'Inactive',
        platform_state: packet.platformState || (isHw ? 'Active' : 'Standby / Simulated'),
        lora_rssi: packet.loraRssi ?? null,
        lora_snr: packet.loraSnr ?? null,
        is_hardware: isHw,
        node_mcu_status: packet.nodeMcuStatus || (isHw ? 'ONLINE' : 'NOT CONNECTED'),
        lora_status: packet.loraStatus || (isHw ? 'CONNECTED' : 'NOT CONNECTED'),
        sensor_system: packet.sensorSystem || (isHw ? 'LIVE' : 'SIMULATED')
      };
      fallbackStore.telemetry.push(row);
      if (fallbackStore.telemetry.length > 500) fallbackStore.telemetry.shift();
      saveFallbackToDisk();
      resolve({ id: row.id, timestamp });
    }
  });
}

/**
 * Get Latest Telemetry Reading
 */
function getLatestTelemetry(onlyHardware = false) {
  return new Promise((resolve, reject) => {
    const whereClause = onlyHardware ? 'WHERE is_hardware = 1' : '';
    if (isNativeSqlite && db) {
      db.get(`SELECT * FROM telemetry ${whereClause} ORDER BY id DESC LIMIT 1`, (err, row) => {
        if (err) return reject(err);
        resolve(row ? formatTelemetryRow(row) : null);
      });
    } else {
      const rows = onlyHardware 
        ? fallbackStore.telemetry.filter(r => r.is_hardware === 1)
        : fallbackStore.telemetry;
      const row = rows[rows.length - 1];
      resolve(row ? formatTelemetryRow(row) : null);
    }
  });
}

/**
 * Get count of real hardware telemetry packets in SQLite
 */
function countRealTelemetry() {
  return new Promise((resolve, reject) => {
    if (isNativeSqlite && db) {
      db.get(`SELECT COUNT(*) as count FROM telemetry WHERE is_hardware = 1`, (err, row) => {
        if (err) return reject(err);
        resolve(row ? row.count : 0);
      });
    } else {
      const count = fallbackStore.telemetry.filter(r => r.is_hardware === 1).length;
      resolve(count);
    }
  });
}


/**
 * Get Telemetry History (for charts & export)
 */
function getTelemetryHistory(range = '24h', limit = 100) {
  return new Promise((resolve, reject) => {
    let count = limit || (range === '1h' ? 60 : range === '7d' ? 168 : 48);

    if (isNativeSqlite && db) {
      db.all(`SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT ?`, [count], (err, rows) => {
        if (err) return reject(err);
        const formatted = rows.reverse().map(formatTelemetryRow);
        resolve(formatted);
      });
    } else {
      const rows = fallbackStore.telemetry.slice(-count);
      resolve(rows.map(formatTelemetryRow));
    }
  });
}

/**
 * Get Alerts from SQLite
 */
function getAlerts() {
  return new Promise((resolve, reject) => {
    if (isNativeSqlite && db) {
      db.all(`SELECT * FROM alerts ORDER BY created_at DESC`, (err, rows) => {
        if (err) return reject(err);
        resolve(rows.map(r => ({
          id: r.id,
          alertType: r.alert_type,
          platformId: r.platform_id,
          date: r.date,
          time: r.time,
          currentValue: r.current_value,
          reason: r.reason,
          severity: r.severity,
          status: r.status,
          source: r.source
        })));
      });
    } else {
      resolve(fallbackStore.alerts.map(r => ({
        id: r.id,
        alertType: r.alert_type,
        platformId: r.platform_id,
        date: r.date,
        time: r.time,
        currentValue: r.current_value,
        reason: r.reason,
        severity: r.severity,
        status: r.status,
        source: r.source
      })));
    }
  });
}

/**
 * Mark Alert Resolved in SQLite
 */
function resolveAlert(id) {
  return new Promise((resolve, reject) => {
    if (isNativeSqlite && db) {
      db.run(`UPDATE alerts SET status = 'Resolved' WHERE id = ?`, [id], function(err) {
        if (err) return reject(err);
        getAlerts().then(resolve).catch(reject);
      });
    } else {
      fallbackStore.alerts = fallbackStore.alerts.map(a => a.id === id ? { ...a, status: 'Resolved' } : a);
      saveFallbackToDisk();
      resolve(fallbackStore.alerts);
    }
  });
}

/**
 * Get Data Sync Stats from SQLite
 */
function getSyncStats() {
  return new Promise((resolve, reject) => {
    if (isNativeSqlite && db) {
      db.get(`SELECT * FROM sync_records WHERE id = 1`, (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(fallbackStore.sync_records);
        resolve({
          localRecords: row.local_records,
          uploadedRecords: row.uploaded_records,
          pendingRecords: row.pending_records,
          lastSuccessfulSync: row.last_successful_sync,
          connectionStatus: row.connection_status
        });
      });
    } else {
      resolve({
        localRecords: fallbackStore.sync_records.local_records,
        uploadedRecords: fallbackStore.sync_records.uploaded_records,
        pendingRecords: fallbackStore.sync_records.pending_records,
        lastSuccessfulSync: fallbackStore.sync_records.last_successful_sync,
        connectionStatus: fallbackStore.sync_records.connection_status
      });
    }
  });
}

/**
 * Update Data Sync Stats in SQLite
 */
function updateSyncStats(data) {
  return new Promise((resolve, reject) => {
    if (isNativeSqlite && db) {
      db.run(`
        UPDATE sync_records SET
          local_records = COALESCE(?, local_records),
          uploaded_records = COALESCE(?, uploaded_records),
          pending_records = COALESCE(?, pending_records),
          last_successful_sync = COALESCE(?, last_successful_sync),
          connection_status = COALESCE(?, connection_status),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `, [
        data.localRecords,
        data.uploadedRecords,
        data.pendingRecords,
        data.lastSuccessfulSync,
        data.connectionStatus
      ], function(err) {
        if (err) return reject(err);
        getSyncStats().then(resolve).catch(reject);
      });
    } else {
      fallbackStore.sync_records = {
        ...fallbackStore.sync_records,
        local_records: data.localRecords ?? fallbackStore.sync_records.local_records,
        uploaded_records: data.uploadedRecords ?? fallbackStore.sync_records.uploaded_records,
        pending_records: data.pendingRecords ?? fallbackStore.sync_records.pending_records,
        last_successful_sync: data.lastSuccessfulSync ?? fallbackStore.sync_records.last_successful_sync,
        connection_status: data.connectionStatus ?? fallbackStore.sync_records.connection_status
      };
      saveFallbackToDisk();
      resolve(getSyncStats());
    }
  });
}

/**
 * Get Platform State (Hardware Connectivity & Messages)
 */
function getPlatformState() {
  return new Promise((resolve, reject) => {
    if (isNativeSqlite && db) {
      db.get(`SELECT * FROM platform_state WHERE id = 1`, (err, row) => {
        if (err) return reject(err);
        if (!row) return resolve(fallbackStore.platform_state);
        resolve({
          platformId: row.platform_id,
          hardwareConnected: Boolean(row.hardware_connected),
          lastHardwareHeartbeat: row.last_hardware_heartbeat,
          nodeMcuStatus: row.node_mcu_status,
          nodeMcuMessage: row.node_mcu_message,
          loraStatus: row.lora_status,
          loraMessage: row.lora_message,
          sensorSystem: row.sensor_system,
          sensorSystemMessage: row.sensor_system_message
        });
      });
    } else {
      resolve({
        platformId: fallbackStore.platform_state.platform_id,
        hardwareConnected: Boolean(fallbackStore.platform_state.hardware_connected),
        lastHardwareHeartbeat: fallbackStore.platform_state.last_hardware_heartbeat,
        nodeMcuStatus: fallbackStore.platform_state.node_mcu_status,
        nodeMcuMessage: fallbackStore.platform_state.node_mcu_message,
        loraStatus: fallbackStore.platform_state.lora_status,
        loraMessage: fallbackStore.platform_state.lora_message,
        sensorSystem: fallbackStore.platform_state.sensor_system,
        sensorSystemMessage: fallbackStore.platform_state.sensor_system_message
      });
    }
  });
}

/**
 * Update Platform State in SQLite
 */
function updatePlatformState(state) {
  return new Promise((resolve, reject) => {
    if (isNativeSqlite && db) {
      db.run(`
        UPDATE platform_state SET
          hardware_connected = COALESCE(?, hardware_connected),
          last_hardware_heartbeat = COALESCE(?, last_hardware_heartbeat),
          node_mcu_status = COALESCE(?, node_mcu_status),
          node_mcu_message = COALESCE(?, node_mcu_message),
          lora_status = COALESCE(?, lora_status),
          lora_message = COALESCE(?, lora_message),
          sensor_system = COALESCE(?, sensor_system),
          sensor_system_message = COALESCE(?, sensor_system_message),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `, [
        state.hardwareConnected !== undefined ? (state.hardwareConnected ? 1 : 0) : null,
        state.lastHardwareHeartbeat !== undefined ? state.lastHardwareHeartbeat : null,
        state.nodeMcuStatus || null,
        state.nodeMcuMessage || null,
        state.loraStatus || null,
        state.loraMessage || null,
        state.sensorSystem || null,
        state.sensorSystemMessage || null
      ], function(err) {
        if (err) return reject(err);
        getPlatformState().then(resolve).catch(reject);
      });
    } else {
      fallbackStore.platform_state = {
        ...fallbackStore.platform_state,
        hardware_connected: state.hardwareConnected !== undefined ? (state.hardwareConnected ? 1 : 0) : fallbackStore.platform_state.hardware_connected,
        last_hardware_heartbeat: state.lastHardwareHeartbeat !== undefined ? state.lastHardwareHeartbeat : fallbackStore.platform_state.last_hardware_heartbeat,
        node_mcu_status: state.nodeMcuStatus || fallbackStore.platform_state.node_mcu_status,
        node_mcu_message: state.nodeMcuMessage || fallbackStore.platform_state.node_mcu_message,
        lora_status: state.loraStatus || fallbackStore.platform_state.lora_status,
        lora_message: state.loraMessage || fallbackStore.platform_state.lora_message,
        sensor_system: state.sensorSystem || fallbackStore.platform_state.sensor_system,
        sensor_system_message: state.sensorSystemMessage || fallbackStore.platform_state.sensor_system_message
      };
      saveFallbackToDisk();
      resolve(getPlatformState());
    }
  });
}

/**
 * Get Database Statistics (Row counts, storage engine, file size)
 */
function getDatabaseStats() {
  return new Promise((resolve) => {
    let fileSizeKb = 0;
    try {
      if (fs.existsSync(DB_PATH)) {
        fileSizeKb = +(fs.statSync(DB_PATH).size / 1024).toFixed(1);
      } else if (fs.existsSync(FALLBACK_JSON_PATH)) {
        fileSizeKb = +(fs.statSync(FALLBACK_JSON_PATH).size / 1024).toFixed(1);
      }
    } catch (e) {}

    if (isNativeSqlite && db) {
      db.get(`
        SELECT 
          (SELECT COUNT(*) FROM telemetry) as telemetryCount,
          (SELECT COUNT(*) FROM alerts) as alertsCount
      `, (err, row) => {
        resolve({
          engine: "SQLite 3 (WAL Mode)",
          databaseFile: DB_PATH,
          fileSizeKb,
          tables: ["telemetry", "alerts", "sync_records", "platform_state"],
          telemetryRecords: row ? row.telemetryCount : 0,
          alertsCount: row ? row.alertsCount : 0
        });
      });
    } else {
      resolve({
        engine: "Persistent SQLite File Store",
        databaseFile: FALLBACK_JSON_PATH,
        fileSizeKb,
        tables: ["telemetry", "alerts", "sync_records", "platform_state"],
        telemetryRecords: fallbackStore.telemetry.length,
        alertsCount: fallbackStore.alerts.length,
        note: "Install 'sqlite3' package with 'npm install sqlite3 --prefix server' for native C++ SQLite"
      });
    }
  });
}

function formatTelemetryRow(r) {
  const t = new Date(r.timestamp);
  return {
    id: r.id,
    timestamp: r.timestamp,
    timeLabel: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    platformId: r.platform_id,
    waterTemperature: r.water_temperature,
    airTemperature: r.air_temperature,
    humidity: r.humidity,
    atmosphericPressure: r.atmospheric_pressure,
    roll: r.roll,
    pitch: r.pitch,
    yaw: r.yaw,
    latitude: r.latitude,
    longitude: r.longitude,
    depth: r.depth,
    battery: r.battery,
    batteryVoltage: r.battery_voltage,
    solarGeneration: r.solar_generation,
    powerConsumption: r.power_consumption,
    solarCharging: r.solar_charging,
    deepSleep: r.deep_sleep,
    platformState: r.platform_state,
    loraRssi: r.lora_rssi,
    loraSnr: r.lora_snr,
    isHardware: Boolean(r.is_hardware),
    nodeMcuStatus: r.node_mcu_status,
    loraStatus: r.lora_status,
    sensorSystem: r.sensor_system
  };
}

function loadFallbackFromDisk() {
  try {
    if (fs.existsSync(FALLBACK_JSON_PATH)) {
      const data = JSON.parse(fs.readFileSync(FALLBACK_JSON_PATH, 'utf8'));
      fallbackStore = { ...fallbackStore, ...data };
    } else {
      fallbackStore.alerts = [...INITIAL_ALERTS_SEED];
      saveFallbackToDisk();
    }
  } catch (err) {
    fallbackStore.alerts = [...INITIAL_ALERTS_SEED];
  }
}

function saveFallbackToDisk() {
  try {
    fs.writeFileSync(FALLBACK_JSON_PATH, JSON.stringify(fallbackStore, null, 2), 'utf8');
  } catch (e) {}
}

module.exports = {
  initDatabase,
  insertTelemetry,
  getLatestTelemetry,
  countRealTelemetry,
  getTelemetryHistory,
  getAlerts,
  resolveAlert,
  getSyncStats,
  updateSyncStats,
  getPlatformState,
  updatePlatformState,
  getDatabaseStats,
  DB_PATH
};
