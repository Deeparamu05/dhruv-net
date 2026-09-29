// DHRUV-NET Autonomous Ocean Observation Platform
// Hardware Controller: NodeMCU ESP8266 Main Microcontroller
// Wireless Uplink: LoRa RA-02 (433MHz / 868MHz)
// Telemetry Data Layer & Realistic Oceanographic Simulation

export const PLATFORM_INFO = {
  id: "DHRUV-01",
  name: "DHRUV-NET Autonomous Ocean Observation Platform",
  status: "NOT CONNECTED",
  hardwareConnected: false,
  nodeMcuStatus: "NOT CONNECTED",
  nodeMcuMessage: "Waiting for hardware connection",
  loraStatus: "NOT CONNECTED",
  loraMessage: "Waiting for LoRa gateway",
  sensorSystem: "SIMULATED",
  sensorSystemMessage: "Using simulated sensor data",
  controller: "NodeMCU ESP8266",
  transceiver: "LoRa RA-02 (SX1278 433MHz)",
  model: "Autonomous Ocean Observation Platform Mk-II",
  deploymentLocation: "Bay of Bengal Coastal Sector (Coromandel Coast)",
  firmwareVersion: "ESP8266-DHRUV-v2.8.4",
  isSimulated: true,
  simulationNotice: "SIMULATED DATA",
  defaultCoordinates: {
    lat: 11.1271,
    lng: 79.0755,
    formatted: "11.1271° N, 79.0755° E"
  }
};

let isHardwareConnectedState = false;

// Current baseline telemetry state matching exact hardware requirements
let currentTelemetry = {
  // Platform & Hardware Status
  platformId: "DHRUV-01",
  hardwareConnected: false,
  nodeMcuStatus: "NOT CONNECTED",
  nodeMcuMessage: "Waiting for hardware connection",
  loraStatus: "NOT CONNECTED",
  loraMessage: "Waiting for LoRa gateway",
  sensorSystem: "SIMULATED",
  sensorSystemMessage: "Using simulated sensor data",
  loraRssi: null, // dBm
  loraSnr: null, // dB
  loraFrequency: "433.0 MHz (Standby)",
  loraPacketCounter: 0,
  lastTxTime: "Waiting for gateway",
  battery: 82, // %
  batteryVoltage: 3.9, // V (Nominal Li-ion 3.7V - 4.2V)
  solarCharging: "Active",
  solarGeneration: 4.8, // W
  powerConsumption: 1.7, // W
  deepSleep: "Inactive",
  platformState: "Standby / Simulated",

  // Physical Sensors
  // 1. Waterproof DS18B20: Water Temperature
  waterTemperature: 27.4, // °C
  // 2. DHT22: Air Temperature & Humidity
  airTemperature: 29.1, // °C
  humidity: 72, // %
  // 3. BMP280: Atmospheric Pressure
  atmosphericPressure: 1008.4, // hPa
  // 4. MPU6050: Platform Orientation
  roll: 1.8, // degrees
  pitch: -0.7, // degrees
  yaw: 42.5, // degrees
  // 5. GPS: Coordinates
  lat: 11.1271,
  lng: 79.0755,
  altitude: "0.8 m",
  satellites: 12,
  fixType: "3D GNSS Fix",

  // 6. Depth: Marked explicitly as Simulated / Future Sensor
  depth: 18.6, // m
  depthLabel: "Simulated / Future Depth Sensor Data",

  // Data Sync Status
  localRecords: 248,
  uploadedRecords: 230,
  pendingRecords: 18,
  lastSuccessfulSync: new Date(Date.now() - 45000).toISOString(),
  connectionStatus: "Connected"
};

/**
 * Generate a realistic drifted live reading from NodeMCU ESP8266 + LoRa payload
 */
export function getSimulatedReading() {
  const now = new Date();

  // Subtle natural ocean & atmospheric random walks
  const waterDrift = (Math.random() - 0.49) * 0.08;
  const airDrift = (Math.random() - 0.48) * 0.12;
  const humDrift = (Math.random() - 0.5) * 0.4;
  const pressDrift = (Math.random() - 0.49) * 0.2;
  const depthDrift = (Math.random() - 0.5) * 0.05;

  // Wave dynamics on platform (MPU6050 6-DOF)
  const waveCycle = Math.sin(now.getTime() / 2400);
  const rollVal = +(1.8 + waveCycle * 1.4 + (Math.random() - 0.5) * 0.3).toFixed(1);
  const pitchVal = +(-0.7 + Math.cos(now.getTime() / 2100) * 1.1 + (Math.random() - 0.5) * 0.2).toFixed(1);
  const yawVal = +((42.5 + (Math.random() - 0.5) * 0.2) % 360).toFixed(1);

  // Micro GPS drift with ocean coastal currents
  const latDrift = (Math.random() - 0.49) * 0.00004;
  const lngDrift = (Math.random() - 0.49) * 0.00004;

  // Battery subtle fluctuation
  const solarGen = +(4.8 + (Math.random() - 0.5) * 0.3).toFixed(1);
  const powerCons = +(1.7 + (Math.random() - 0.5) * 0.1).toFixed(1);

  currentTelemetry = {
    ...currentTelemetry,
    waterTemperature: +(currentTelemetry.waterTemperature + waterDrift).toFixed(1),
    airTemperature: +(currentTelemetry.airTemperature + airDrift).toFixed(1),
    humidity: +Math.min(99, Math.max(40, currentTelemetry.humidity + humDrift)).toFixed(0),
    atmosphericPressure: +(currentTelemetry.atmosphericPressure + pressDrift).toFixed(1),
    depth: +(currentTelemetry.depth + depthDrift).toFixed(1),
    roll: rollVal,
    pitch: pitchVal,
    yaw: yawVal,
    lat: +(currentTelemetry.lat + latDrift).toFixed(5),
    lng: +(currentTelemetry.lng + lngDrift).toFixed(5),
    solarGeneration: solarGen,
    powerConsumption: powerCons,
    loraRssi: Math.min(-72, Math.max(-98, Math.round(currentTelemetry.loraRssi + (Math.random() - 0.5) * 2))),
    loraPacketCounter: currentTelemetry.loraPacketCounter + 1,
    lastTxTime: "Just now"
  };

  return {
    timestamp: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    displayDate: now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    platformId: "DHRUV-01",
    controller: "NodeMCU ESP8266",
    isSimulated: true,
    simulationLabel: "SIMULATED DATA",

    // Platform Health & Power
    battery: currentTelemetry.battery,
    batteryVoltage: currentTelemetry.batteryVoltage,
    batteryStatus: "Nominal (Solar Charging Active)",
    solarCharging: currentTelemetry.solarCharging,
    solarGeneration: currentTelemetry.solarGeneration,
    powerConsumption: currentTelemetry.powerConsumption,
    deepSleep: currentTelemetry.deepSleep,
    platformState: currentTelemetry.platformState,
    hardwareConnected: currentTelemetry.hardwareConnected,
    nodeMcuStatus: currentTelemetry.nodeMcuStatus,
    nodeMcuMessage: currentTelemetry.nodeMcuMessage,
    loraStatus: currentTelemetry.loraStatus,
    loraMessage: currentTelemetry.loraMessage,
    loraRssi: currentTelemetry.loraRssi,
    loraSnr: currentTelemetry.loraSnr,
    loraFrequency: currentTelemetry.loraFrequency,
    loraPacketCounter: currentTelemetry.loraPacketCounter,
    lastTxTime: currentTelemetry.lastTxTime,
    sensorSystem: currentTelemetry.sensorSystem,
    sensorSystemMessage: currentTelemetry.sensorSystemMessage,

    // GPS Telemetry
    coordinates: {
      lat: currentTelemetry.lat,
      lng: currentTelemetry.lng,
      formatted: `${currentTelemetry.lat.toFixed(4)}° N, ${currentTelemetry.lng.toFixed(4)}° E`
    },
    altitude: currentTelemetry.altitude,
    satellites: currentTelemetry.satellites,
    fixType: currentTelemetry.fixType,

    // Sensor Readings with Hardware Attribution
    sensors: {
      waterTemperature: {
        name: "Water Temperature",
        value: currentTelemetry.waterTemperature,
        unit: "°C",
        source: "DS18B20",
        sourceType: "Waterproof DS18B20",
        status: "Normal",
        isSimulated: true,
        simulationTag: "SIMULATED DATA",
        lastUpdated: "Just now",
        trend: waterDrift >= 0 ? "up" : "down"
      },
      airTemperature: {
        name: "Air Temperature",
        value: currentTelemetry.airTemperature,
        unit: "°C",
        source: "DHT22",
        sourceType: "DHT22 Digital Probe",
        status: "Normal",
        isSimulated: true,
        simulationTag: "SIMULATED DATA",
        lastUpdated: "Just now",
        trend: airDrift >= 0 ? "up" : "down"
      },
      humidity: {
        name: "Humidity",
        value: currentTelemetry.humidity,
        unit: "%",
        source: "DHT22",
        sourceType: "DHT22 Capacitive",
        status: "Normal",
        isSimulated: true,
        simulationTag: "SIMULATED DATA",
        lastUpdated: "Just now",
        trend: humDrift >= 0 ? "up" : "down"
      },
      atmosphericPressure: {
        name: "Atmospheric Pressure",
        value: currentTelemetry.atmosphericPressure,
        unit: "hPa",
        source: "BMP280",
        sourceType: "BMP280 I2C Barometer",
        status: "Normal",
        isSimulated: true,
        simulationTag: "SIMULATED DATA",
        lastUpdated: "Just now",
        trend: pressDrift >= 0 ? "up" : "down"
      },
      depth: {
        name: "Ocean Depth",
        value: currentTelemetry.depth,
        unit: "m",
        source: "Simulated / Future Sensor",
        sourceType: "Simulated / Future Depth Sensor Data",
        status: "Normal",
        isSimulated: true,
        simulationTag: "SIMULATED / FUTURE SENSOR",
        lastUpdated: "Just now",
        trend: depthDrift >= 0 ? "up" : "down"
      },
      orientation: {
        name: "Platform Orientation",
        roll: currentTelemetry.roll,
        pitch: currentTelemetry.pitch,
        yaw: currentTelemetry.yaw,
        unit: "°",
        source: "MPU6050",
        sourceType: "MPU6050 6-Axis IMU",
        status: "Normal",
        isSimulated: true,
        simulationTag: "SIMULATED DATA",
        lastUpdated: "Just now",
        trend: "steady"
      },
      lora: {
        name: "LoRa Communication",
        status: currentTelemetry.loraStatus,
        message: currentTelemetry.loraMessage,
        lastTx: currentTelemetry.lastTxTime,
        dataTransmissionState: currentTelemetry.hardwareConnected 
          ? "Nominal (Uplink ACK)" 
          : "Standby (Waiting for LoRa gateway)",
        source: "LoRa RA-02",
        sourceType: "SX1278 433MHz Transceiver",
        rssi: currentTelemetry.loraRssi !== null ? `${currentTelemetry.loraRssi} dBm` : "N/A (Disconnected)",
        snr: currentTelemetry.loraSnr !== null ? `+${currentTelemetry.loraSnr} dB` : "N/A",
        unit: "dBm",
        lastUpdated: currentTelemetry.hardwareConnected ? "Just now" : "Waiting for gateway"
      },
      gps: {
        name: "GPS Positioning",
        latitude: currentTelemetry.lat,
        longitude: currentTelemetry.lng,
        source: "GPS",
        sourceType: "NEO-6M UART Module",
        status: "Normal",
        satellites: currentTelemetry.satellites,
        unit: "deg",
        lastUpdated: "Just now"
      }
    },

    // Synchronization state
    sync: {
      localRecords: currentTelemetry.localRecords,
      uploadedRecords: currentTelemetry.uploadedRecords,
      pendingRecords: currentTelemetry.pendingRecords,
      lastSuccessfulSync: currentTelemetry.lastSuccessfulSync,
      connectionStatus: currentTelemetry.connectionStatus
    }
  };
}

/**
 * Generate historical time-series for all 7 required analytics parameters
 * 1. Water Temperature (DS18B20)
 * 2. Air Temperature (DHT22)
 * 3. Humidity (DHT22)
 * 4. Atmospheric Pressure (BMP280)
 * 5. Depth (Simulated / Future Sensor)
 * 6. Roll (MPU6050)
 * 7. Pitch (MPU6050)
 */
export function generateHistoricalData(range = '24h', customStart = null, customEnd = null) {
  const points = [];
  const now = new Date();
  let stepMs = 60 * 1000;
  let totalSteps = 60;
  let startTime = new Date(now.getTime() - 60 * 60 * 1000);

  if (range === '1h') {
    totalSteps = 60;
    stepMs = 60 * 1000;
    startTime = new Date(now.getTime() - 60 * 60 * 1000);
  } else if (range === '24h') {
    totalSteps = 48; // every 30 minutes
    stepMs = 30 * 60 * 1000;
    startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (range === '7d') {
    totalSteps = 56; // 8 points per day
    stepMs = 3 * 60 * 60 * 1000;
    startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (range === 'custom' && customStart && customEnd) {
    const diff = Math.max(60000, customEnd.getTime() - customStart.getTime());
    totalSteps = Math.min(60, Math.max(10, Math.floor(diff / (1000 * 60 * 15))));
    stepMs = Math.floor(diff / totalSteps);
    startTime = new Date(customStart);
  }

  for (let i = 0; i <= totalSteps; i++) {
    const t = new Date(startTime.getTime() + i * stepMs);
    const hourVal = t.getHours() + t.getMinutes() / 60;
    const hourCycle = Math.sin((hourVal * Math.PI) / 12);
    const tidalCycle = Math.sin((hourVal * Math.PI) / 6);
    const waveNoise = Math.sin(i * 0.45);

    // Realistic tropical marine ranges
    const waterTemp = +(27.4 + hourCycle * 1.2 + (Math.random() - 0.5) * 0.25).toFixed(1);
    const airTemp = +(29.1 + hourCycle * 2.8 + (Math.random() - 0.5) * 0.4).toFixed(1);
    const humidity = +Math.min(96, Math.max(55, 72 - hourCycle * 8 + (Math.random() - 0.5) * 2)).toFixed(0);
    const pressure = +(1008.4 + hourCycle * 2.1 + (Math.random() - 0.5) * 0.3).toFixed(1);
    const depth = +(18.6 + tidalCycle * 1.1 + (Math.random() - 0.5) * 0.15).toFixed(1);
    const roll = +(1.8 + waveNoise * 1.6 + (Math.random() - 0.5) * 0.3).toFixed(1);
    const pitch = +(-0.7 + Math.cos(i * 0.45) * 1.2 + (Math.random() - 0.5) * 0.2).toFixed(1);

    let timeLabel = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (range === '7d' || (range === 'custom' && (customEnd - customStart > 86400000))) {
      timeLabel = `${t.getDate()} ${t.toLocaleString('default', { month: 'short' })} ${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    points.push({
      timestamp: t.toISOString(),
      timeLabel,
      waterTemperature: waterTemp,
      airTemperature: airTemp,
      humidity: humidity,
      atmosphericPressure: pressure,
      depth: depth,
      roll: roll,
      pitch: pitch
    });
  }

  return points;
}

// Initial realistic alerts database
export const INITIAL_ALERTS = [
  {
    id: "ALT-1082",
    alertType: "Abnormal Atmospheric Pressure",
    platformId: "DHRUV-01",
    date: "2026-09-27",
    time: "17:42:10",
    currentValue: "998.2 hPa",
    reason: "Rapid barometric pressure drop > 4 hPa/3hr detected by BMP280, indicating convective squall/depression.",
    severity: "Critical",
    status: "Active",
    source: "BMP280"
  },
  {
    id: "ALT-1081",
    alertType: "Excessive Platform Tilt",
    platformId: "DHRUV-01",
    date: "2026-09-27",
    time: "16:15:33",
    currentValue: "Roll: 6.8°, Pitch: -4.2°",
    reason: "Swell-induced platform oscillation exceeded nominal 5.0° threshold monitored via MPU6050.",
    severity: "Warning",
    status: "Active",
    source: "MPU6050"
  },
  {
    id: "ALT-1080",
    alertType: "LoRa Communication Loss",
    platformId: "DHRUV-01",
    date: "2026-09-27",
    time: "14:20:00",
    currentValue: "RSSI: -112 dBm",
    reason: "Temporary RF attenuation observed during heavy ocean precipitation spray. Recovered after 2 frames.",
    severity: "Warning",
    status: "Resolved",
    source: "LoRa RA-02"
  },
  {
    id: "ALT-1079",
    alertType: "Low Battery",
    platformId: "DHRUV-01",
    date: "2026-09-26",
    time: "23:55:18",
    currentValue: "3.58 V (24%)",
    reason: "Prolonged overcast overnight period depleted battery before morning solar recharge cycle.",
    severity: "Warning",
    status: "Resolved",
    source: "Power Management"
  },
  {
    id: "ALT-1078",
    alertType: "Abnormal Water Temperature",
    platformId: "DHRUV-01",
    date: "2026-09-26",
    time: "13:10:45",
    currentValue: "31.4 °C",
    reason: "Surface solar heating transient spike detected by DS18B20 waterproof probe in shallow boundary layer.",
    severity: "Warning",
    status: "Resolved",
    source: "DS18B20"
  },
  {
    id: "ALT-1077",
    alertType: "Sensor Failure",
    platformId: "DHRUV-01",
    date: "2026-09-25",
    time: "08:14:02",
    currentValue: "1-Wire Timeout",
    reason: "Temporary I/O bus contention during simultaneous LoRa SPI burst and 1-Wire read. Auto-recovered.",
    severity: "Critical",
    status: "Resolved",
    source: "NodeMCU ESP8266"
  }
];

// Initial sync records state
export const INITIAL_SYNC_STATE = {
  localRecords: 248,
  uploadedRecords: 230,
  pendingRecords: 18,
  lastSuccessfulSync: new Date(Date.now() - 42000).toISOString(),
  connectionStatus: "Connected"
};

// Power telemetry baseline
export const INITIAL_POWER_STATE = {
  battery: 82,
  batteryVoltage: 3.9,
  solarCharging: "Active",
  solarGeneration: 4.8,
  powerConsumption: 1.7,
  hardwareConnected: false,
  nodeMcuStatus: "NOT CONNECTED",
  nodeMcuMessage: "Waiting for hardware connection",
  loraStatus: "NOT CONNECTED",
  loraMessage: "Waiting for LoRa gateway",
  sensorSystem: "SIMULATED",
  sensorSystemMessage: "Using simulated sensor data",
  deepSleep: "Inactive",
  platformState: "Standby / Simulated",
  lastUpdated: new Date().toISOString()
};

/**
 * Toggle or set simulated hardware connection test state.
 * When real hardware or test packets arrive, all statuses automatically update.
 */
export function setHardwareConnectedState(connected) {
  isHardwareConnectedState = Boolean(connected);
  currentTelemetry.hardwareConnected = isHardwareConnectedState;
  if (isHardwareConnectedState) {
    currentTelemetry.nodeMcuStatus = "ONLINE";
    currentTelemetry.nodeMcuMessage = "Hardware connected & streaming";
    currentTelemetry.loraStatus = "CONNECTED";
    currentTelemetry.loraMessage = "LoRa gateway link active (433MHz)";
    currentTelemetry.sensorSystem = "LIVE";
    currentTelemetry.sensorSystemMessage = "Streaming live physical sensor telemetry";
    currentTelemetry.loraRssi = -84;
    currentTelemetry.loraSnr = 9.2;
    currentTelemetry.lastTxTime = "Just now";
    currentTelemetry.isSimulated = false;
  } else {
    currentTelemetry.nodeMcuStatus = "NOT CONNECTED";
    currentTelemetry.nodeMcuMessage = "Waiting for hardware connection";
    currentTelemetry.loraStatus = "NOT CONNECTED";
    currentTelemetry.loraMessage = "Waiting for LoRa gateway";
    currentTelemetry.sensorSystem = "SIMULATED";
    currentTelemetry.sensorSystemMessage = "Using simulated sensor data";
    currentTelemetry.loraRssi = null;
    currentTelemetry.loraSnr = null;
    currentTelemetry.lastTxTime = "Waiting for gateway";
    currentTelemetry.isSimulated = true;
  }
  return {
    hardwareConnected: currentTelemetry.hardwareConnected,
    nodeMcuStatus: currentTelemetry.nodeMcuStatus,
    nodeMcuMessage: currentTelemetry.nodeMcuMessage,
    loraStatus: currentTelemetry.loraStatus,
    loraMessage: currentTelemetry.loraMessage,
    sensorSystem: currentTelemetry.sensorSystem,
    sensorSystemMessage: currentTelemetry.sensorSystemMessage
  };
}

export function getHardwareConnectedState() {
  return isHardwareConnectedState;
}
