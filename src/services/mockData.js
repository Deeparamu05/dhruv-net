// Realistic Oceanographic & Atmospheric Sensor Data Simulation for DHRUV-NET

export const PLATFORM_INFO = {
  id: "DHRUV-NET-OBS-01",
  name: "Autonomous Ocean Observer",
  status: "ONLINE", // ONLINE or OFFLINE
  model: "Marine Buoy MK-IV",
  deploymentLocation: "Arabian Sea Research Corridor",
  firmwareVersion: "v2.4.1-rc3",
  defaultCoordinates: {
    lat: 15.2993,
    lng: 73.8243,
    formatted: "15°17'57.5\"N 73°49'27.5\"E"
  }
};

// Base baseline values for realistic ocean physics
const SENSOR_BASES = {
  temperature: { base: 22.4, unit: "°C", minVal: 18.0, maxVal: 28.0, variance: 0.15 },
  salinity: { base: 35.15, unit: "PSU", minVal: 34.0, maxVal: 36.5, variance: 0.04 },
  pressure: { base: 1013.4, unit: "dbar", minVal: 1005.0, maxVal: 1025.0, variance: 0.3 },
  depth: { base: 12.8, unit: "m", minVal: 10.0, maxVal: 15.0, variance: 0.1 },
  humidity: { base: 82.5, unit: "% RH", minVal: 60.0, maxVal: 98.0, variance: 0.5 }
};

let currentTelemetry = {
  temperature: 22.65,
  salinity: 35.22,
  pressure: 1013.45,
  depth: 12.84,
  humidity: 82.6,
  battery: 89,
  batteryStatus: "Discharging (Solar Standby)",
  lat: 15.2993,
  lng: 73.8243,
  lastReceived: new Date().toISOString()
};

/**
 * Generate a slightly drifted realistic live reading
 */
export function getSimulatedReading() {
  const now = new Date();
  
  // Random small walk
  const drift = (Math.random() - 0.49) * 0.08;
  const temp = +(currentTelemetry.temperature + drift).toFixed(2);
  const sal = +(currentTelemetry.salinity + (Math.random() - 0.49) * 0.02).toFixed(2);
  const press = +(currentTelemetry.pressure + (Math.random() - 0.49) * 0.15).toFixed(2);
  const depth = +(currentTelemetry.depth + (Math.random() - 0.49) * 0.05).toFixed(2);
  const hum = +(Math.min(98, Math.max(65, currentTelemetry.humidity + (Math.random() - 0.5) * 0.3))).toFixed(1);
  
  // Subtle GPS drift with ocean current
  const latDrift = (Math.random() - 0.48) * 0.00008;
  const lngDrift = (Math.random() - 0.48) * 0.00008;
  
  currentTelemetry = {
    ...currentTelemetry,
    temperature: temp,
    salinity: sal,
    pressure: press,
    depth: depth,
    humidity: hum,
    lat: +(currentTelemetry.lat + latDrift).toFixed(5),
    lng: +(currentTelemetry.lng + lngDrift).toFixed(5),
    lastReceived: now.toISOString()
  };

  return {
    timestamp: now.toISOString(),
    displayTime: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    battery: currentTelemetry.battery,
    coordinates: {
      lat: currentTelemetry.lat,
      lng: currentTelemetry.lng,
      formatted: `${Math.abs(currentTelemetry.lat).toFixed(4)}° N, ${Math.abs(currentTelemetry.lng).toFixed(4)}° E`
    },
    sensors: {
      temperature: {
        value: temp,
        unit: "°C",
        label: "Water Temperature",
        status: "Normal",
        trend: drift >= 0 ? "up" : "down"
      },
      salinity: {
        value: sal,
        unit: "PSU",
        label: "Salinity",
        status: "Normal",
        trend: "steady"
      },
      pressure: {
        value: press,
        unit: "dbar",
        label: "Pressure",
        status: "Optimal",
        trend: "steady"
      },
      depth: {
        value: depth,
        unit: "m",
        label: "Depth",
        status: "Normal",
        trend: "steady"
      },
      humidity: {
        value: hum,
        unit: "% RH",
        label: "Humidity",
        status: "Nominal",
        trend: "up"
      }
    }
  };
}

/**
 * Generate historical sensor data for line charts based on range
 * @param {'1h' | '24h' | '7d' | 'custom'} range
 * @param {Date} [customStart]
 * @param {Date} [customEnd]
 */
export function generateHistoricalData(range = '24h', customStart = null, customEnd = null) {
  const points = [];
  const now = new Date();
  let stepMs = 60 * 1000; // 1 minute default
  let totalSteps = 60;
  let startTime = new Date(now.getTime() - 60 * 60 * 1000);

  if (range === '1h') {
    totalSteps = 60;
    stepMs = 60 * 1000;
    startTime = new Date(now.getTime() - 60 * 60 * 1000);
  } else if (range === '24h') {
    totalSteps = 48; // every 30 mins
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
    // Ocean physics sinusoidal variations + random noise
    const hourCycle = Math.sin((t.getHours() + t.getMinutes() / 60) * (Math.PI / 12));
    const tidalCycle = Math.sin((t.getHours() + t.getMinutes() / 60) * (Math.PI / 6));

    const temp = +(21.5 + hourCycle * 1.8 + (Math.random() - 0.5) * 0.4).toFixed(2);
    const sal = +(35.05 + tidalCycle * 0.35 + (Math.random() - 0.5) * 0.1).toFixed(2);
    const press = +(1013.2 + hourCycle * 2.2 + (Math.random() - 0.5) * 0.5).toFixed(2);
    const depth = +(12.5 + tidalCycle * 1.2 + (Math.random() - 0.5) * 0.2).toFixed(2);
    const hum = +(79.0 - hourCycle * 6.5 + (Math.random() - 0.5) * 1.5).toFixed(1);

    let timeLabel = t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (range === '7d' || (range === 'custom' && (customEnd - customStart > 86400000))) {
      timeLabel = `${t.getDate()} ${t.toLocaleString('default', { month: 'short' })} ${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    points.push({
      timestamp: t.toISOString(),
      timeLabel,
      temperature: temp,
      salinity: sal,
      pressure: press,
      depth: depth,
      humidity: hum
    });
  }

  return points;
}
