/**
 * DHRUV-NET GPS Service Layer
 * Supports:
 *  1. Hardware GPS Module via Web Serial API (NEO-6M, NEO-7M, NEO-M8N, Quectel, ESP32, Arduino)
 *  2. Device GPS via HTML5 Geolocation API (Phone/Laptop GNSS)
 *  3. Simulated NMEA Stream for testing & validation
 *  4. Robust NMEA 0183 Parser ($GPGGA, $GNGGA, $GPRMC, $GNRMC, etc.)
 */

// Convert NMEA raw coordinate (ddmm.mmmm or dddmm.mmmm) to decimal degrees
export function nmeaToDecimal(nmeaCoord, direction) {
  if (!nmeaCoord || !direction) return null;
  
  const val = parseFloat(nmeaCoord);
  if (isNaN(val)) return null;

  // Latitude is ddmm.mmmm (2 digit degrees), Longitude is dddmm.mmmm (3 digit degrees)
  let degrees = 0;
  let minutes = 0;
  
  if (direction === 'N' || direction === 'S') {
    degrees = Math.floor(val / 100);
    minutes = val - (degrees * 100);
  } else {
    degrees = Math.floor(val / 100);
    minutes = val - (degrees * 100);
  }

  let decimal = degrees + (minutes / 60);
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  return parseFloat(decimal.toFixed(6));
}

// Convert decimal degrees to formatted DMS string (e.g., 15°17'57.5"N, 73°49'27.5"E)
export function decimalToDMS(lat, lng) {
  if (lat == null || lng == null) return '--';
  
  const formatCoord = (coord, posChar, negChar) => {
    const dir = coord >= 0 ? posChar : negChar;
    const absCoord = Math.abs(coord);
    const deg = Math.floor(absCoord);
    const minFloat = (absCoord - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(1);
    return `${deg}°${min}'${sec}"${dir}`;
  };

  return `${formatCoord(lat, 'N', 'S')} ${formatCoord(lng, 'E', 'W')}`;
}

// Fix quality map for NMEA GGA
const GGA_FIX_TYPES = {
  '0': 'No Fix / Invalid',
  '1': 'Autonomous GPS (3D Fix)',
  '2': 'Differential GPS (DGPS)',
  '3': 'PPS Fix',
  '4': 'Real Time Kinematic (RTK)',
  '5': 'Float RTK',
  '6': 'Estimated / Dead Reckoning',
  '7': 'Manual Input',
  '8': 'Simulation Mode'
};

/**
 * NMEA 0183 Sentence Parser
 */
export function parseNMEASentence(sentence) {
  const trimmed = sentence.trim();
  if (!trimmed.startsWith('$')) return null;

  // Split sentence from checksum
  const starIndex = trimmed.indexOf('*');
  const body = starIndex !== -1 ? trimmed.substring(1, starIndex) : trimmed.substring(1);
  const parts = body.split(',');
  const type = parts[0];

  const result = {
    type,
    raw: trimmed,
    timestamp: new Date().toISOString()
  };

  // $GPGGA or $GNGGA (Global Positioning System Fix Data)
  if (type === 'GPGGA' || type === 'GNGGA') {
    const rawTime = parts[1];
    const rawLat = parts[2];
    const latDir = parts[3];
    const rawLng = parts[4];
    const lngDir = parts[5];
    const fixQuality = parts[6];
    const satCount = parseInt(parts[7], 10);
    const hdop = parseFloat(parts[8]);
    const altitude = parseFloat(parts[9]);
    const altUnit = parts[10] || 'M';

    const lat = nmeaToDecimal(rawLat, latDir);
    const lng = nmeaToDecimal(rawLng, lngDir);

    result.lat = lat;
    result.lng = lng;
    result.time = rawTime;
    result.fixQuality = fixQuality;
    result.fixType = GGA_FIX_TYPES[fixQuality] || 'Unknown';
    result.satellites = isNaN(satCount) ? 0 : satCount;
    result.hdop = isNaN(hdop) ? null : hdop;
    result.altitude = isNaN(altitude) ? null : `${altitude} ${altUnit}`;
    result.isValid = fixQuality !== '0' && lat != null && lng != null;
    return result;
  }

  // $GPRMC or $GNRMC (Recommended Minimum Specific GNSS Data)
  if (type === 'GPRMC' || type === 'GNRMC') {
    const rawTime = parts[1];
    const status = parts[2]; // A = Active / Valid, V = Void / Navigation receiver warning
    const rawLat = parts[3];
    const latDir = parts[4];
    const rawLng = parts[5];
    const lngDir = parts[6];
    const speedKnots = parseFloat(parts[7]);
    const trackAngle = parseFloat(parts[8]); // Course over ground (degrees True)
    const rawDate = parts[9];

    const lat = nmeaToDecimal(rawLat, latDir);
    const lng = nmeaToDecimal(rawLng, lngDir);

    result.lat = lat;
    result.lng = lng;
    result.time = rawTime;
    result.date = rawDate;
    result.status = status === 'A' ? 'Valid' : 'Warning/Void';
    result.speedKnots = isNaN(speedKnots) ? 0 : speedKnots;
    result.speedKmh = isNaN(speedKnots) ? 0 : parseFloat((speedKnots * 1.852).toFixed(1));
    result.heading = isNaN(trackAngle) ? 0 : parseFloat(trackAngle.toFixed(1));
    result.isValid = status === 'A' && lat != null && lng != null;
    return result;
  }

  // $GPVTG or $GNVTG (Course over ground and ground speed)
  if (type === 'GPVTG' || type === 'GNVTG') {
    const trackTrue = parseFloat(parts[1]);
    const speedKnots = parseFloat(parts[5]);
    const speedKmh = parseFloat(parts[7]);

    result.heading = isNaN(trackTrue) ? null : trackTrue;
    result.speedKnots = isNaN(speedKnots) ? null : speedKnots;
    result.speedKmh = isNaN(speedKmh) ? null : speedKmh;
    result.isValid = true;
    return result;
  }

  // Other sentences (GSV, GSA) - pass-through
  return result;
}

/**
 * Check if Web Serial API is supported in current browser
 */
export function isWebSerialSupported() {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

/**
 * Hardware Serial GPS Controller
 */
export class SerialGPSModule {
  constructor(options = {}) {
    this.baudRate = options.baudRate || 9600;
    this.port = null;
    this.reader = null;
    this.keepReading = false;
    this.onSentence = options.onSentence || (() => {});
    this.onFixUpdate = options.onFixUpdate || (() => {});
    this.onError = options.onError || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    
    // Aggregated state
    this.lastState = {
      lat: null,
      lng: null,
      altitude: null,
      speedKnots: 0,
      speedKmh: 0,
      heading: 0,
      satellites: 0,
      hdop: null,
      fixType: 'Waiting for Fix...',
      isValid: false,
      lastUpdated: null
    };
  }

  async connect(baudRate) {
    if (baudRate) this.baudRate = parseInt(baudRate, 10);

    if (!isWebSerialSupported()) {
      const err = new Error("Web Serial API is not supported in this browser. Please use Chrome, Edge, or Opera.");
      this.onError(err);
      throw err;
    }

    try {
      this.onStatusChange('requesting');
      // Prompt user to select COM / USB serial port
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: this.baudRate });
      this.keepReading = true;
      this.onStatusChange('connected');

      this._readLoop();
      return true;
    } catch (err) {
      this.onStatusChange('error');
      this.onError(err);
      throw err;
    }
  }

  async _readLoop() {
    let lineBuffer = '';
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.port.readable.pipeTo(textDecoder.writable);
    this.reader = textDecoder.readable.getReader();

    try {
      while (this.keepReading) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) {
          lineBuffer += value;
          const lines = lineBuffer.split(/\r\n|\n/);
          // Keep the last partial line in the buffer
          lineBuffer = lines.pop();

          for (const line of lines) {
            if (line.trim().startsWith('$')) {
              this._handleRawLine(line.trim());
            }
          }
        }
      }
    } catch (err) {
      if (this.keepReading) {
        this.onError(err);
        this.onStatusChange('error');
      }
    } finally {
      if (this.reader) {
        try {
          this.reader.releaseLock();
        } catch (_) {}
      }
    }
  }

  _handleRawLine(rawLine) {
    this.onSentence(rawLine);
    const parsed = parseNMEASentence(rawLine);
    if (!parsed) return;

    let updated = false;

    if (parsed.type === 'GPGGA' || parsed.type === 'GNGGA') {
      if (parsed.lat != null && parsed.lng != null) {
        this.lastState.lat = parsed.lat;
        this.lastState.lng = parsed.lng;
        updated = true;
      }
      this.lastState.fixType = parsed.fixType;
      this.lastState.satellites = parsed.satellites;
      this.lastState.hdop = parsed.hdop;
      this.lastState.altitude = parsed.altitude;
      this.lastState.isValid = parsed.isValid;
      this.lastState.lastUpdated = new Date().toISOString();
    } else if (parsed.type === 'GPRMC' || parsed.type === 'GNRMC') {
      if (parsed.lat != null && parsed.lng != null) {
        this.lastState.lat = parsed.lat;
        this.lastState.lng = parsed.lng;
        updated = true;
      }
      this.lastState.speedKnots = parsed.speedKnots;
      this.lastState.speedKmh = parsed.speedKmh;
      this.lastState.heading = parsed.heading;
      if (parsed.isValid) this.lastState.isValid = true;
      this.lastState.lastUpdated = new Date().toISOString();
    } else if (parsed.type === 'GPVTG' || parsed.type === 'GNVTG') {
      if (parsed.heading != null) this.lastState.heading = parsed.heading;
      if (parsed.speedKmh != null) this.lastState.speedKmh = parsed.speedKmh;
    }

    if (updated || parsed.isValid) {
      this.onFixUpdate({ ...this.lastState });
    }
  }

  async disconnect() {
    this.keepReading = false;
    try {
      if (this.reader) {
        await this.reader.cancel();
      }
      if (this.port) {
        await this.port.close();
      }
    } catch (err) {
      console.warn("Serial disconnect error:", err);
    } finally {
      this.port = null;
      this.reader = null;
      this.onStatusChange('disconnected');
    }
  }
}

/**
 * Device GPS Tracker using Browser Geolocation API
 */
export class DeviceGPSTracker {
  constructor(options = {}) {
    this.watchId = null;
    this.onPosition = options.onPosition || (() => {});
    this.onError = options.onError || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
  }

  start() {
    if (!navigator.geolocation) {
      const err = new Error("Geolocation is not supported by your browser");
      this.onError(err);
      return false;
    }

    this.onStatusChange('acquiring');

    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, altitude, accuracy, altitudeAccuracy, heading, speed } = pos.coords;
        const fix = {
          lat: parseFloat(latitude.toFixed(6)),
          lng: parseFloat(longitude.toFixed(6)),
          altitude: altitude != null ? `${altitude.toFixed(1)} m` : '--',
          accuracy: accuracy ? Math.round(accuracy) : 5, // meters
          heading: heading != null && !isNaN(heading) ? Math.round(heading) : 0,
          speedKnots: speed != null ? parseFloat((speed * 1.94384).toFixed(1)) : 0,
          speedKmh: speed != null ? parseFloat((speed * 3.6).toFixed(1)) : 0,
          satellites: 'GNSS (Native OS)',
          fixType: 'Device 3D Position Fix',
          isValid: true,
          timestamp: new Date(pos.timestamp).toISOString(),
          formatted: decimalToDMS(latitude, longitude)
        };
        this.onStatusChange('active');
        this.onPosition(fix);
      },
      (err) => {
        this.onStatusChange('error');
        this.onError(err);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 1000
      }
    );
    return true;
  }

  stop() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.onStatusChange('stopped');
    }
  }
}

/**
 * Simulated GPS Hardware Generator
 * Emits realistic NMEA 0183 sentences ($GPGGA, $GPRMC) streaming every 1s
 */
export class SimulatedGPSModule {
  constructor(options = {}) {
    this.onSentence = options.onSentence || (() => {});
    this.onFixUpdate = options.onFixUpdate || (() => {});
    this.intervalId = null;
    this.lat = options.startLat || 15.2993;
    this.lng = options.startLng || 73.8243;
    this.speedKnots = 4.2;
    this.heading = 215; // heading southwest
  }

  start() {
    if (this.intervalId) return;

    this.intervalId = setInterval(() => {
      // Simulate subtle forward motion along heading
      const rad = (this.heading * Math.PI) / 180;
      const step = 0.00015; // movement step
      this.lat += Math.cos(rad) * step + (Math.random() - 0.5) * 0.00004;
      this.lng += Math.sin(rad) * step + (Math.random() - 0.5) * 0.00004;
      this.heading = (this.heading + (Math.random() - 0.5) * 2 + 360) % 360;
      this.speedKnots = Math.max(0.5, this.speedKnots + (Math.random() - 0.5) * 0.2);

      // Generate NMEA coordinate strings
      const absLat = Math.abs(this.lat);
      const latDeg = Math.floor(absLat);
      const latMin = (absLat - latDeg) * 60;
      const nmeaLat = `${String(latDeg).padStart(2, '0')}${latMin.toFixed(4).padStart(7, '0')}`;
      const latDir = this.lat >= 0 ? 'N' : 'S';

      const absLng = Math.abs(this.lng);
      const lngDeg = Math.floor(absLng);
      const lngMin = (absLng - lngDeg) * 60;
      const nmeaLng = `${String(lngDeg).padStart(3, '0')}${lngMin.toFixed(4).padStart(7, '0')}`;
      const lngDir = this.lng >= 0 ? 'E' : 'W';

      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '') + '.00';
      const dateStr = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;

      // $GPGGA,time,lat,N,lng,E,fixQuality,numSats,hdop,alt,M,...
      const sats = 11;
      const gga = `$GPGGA,${timeStr},${nmeaLat},${latDir},${nmeaLng},${lngDir},1,${sats},0.9,12.4,M,-58.2,M,,*47`;
      // $GPRMC,time,status,lat,N,lng,E,speed,heading,date,...
      const rmc = `$GPRMC,${timeStr},A,${nmeaLat},${latDir},${nmeaLng},${lngDir},${this.speedKnots.toFixed(1)},${this.heading.toFixed(1)},${dateStr},,,A*7A`;

      this.onSentence(gga);
      this.onSentence(rmc);

      const fix = {
        lat: parseFloat(this.lat.toFixed(6)),
        lng: parseFloat(this.lng.toFixed(6)),
        altitude: '12.4 M',
        speedKnots: parseFloat(this.speedKnots.toFixed(1)),
        speedKmh: parseFloat((this.speedKnots * 1.852).toFixed(1)),
        heading: parseFloat(this.heading.toFixed(1)),
        satellites: sats,
        hdop: 0.9,
        fixType: 'Simulated 3D GNSS Fix',
        accuracy: 3,
        isValid: true,
        lastUpdated: now.toISOString(),
        formatted: decimalToDMS(this.lat, this.lng)
      };

      this.onFixUpdate(fix);
    }, 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
