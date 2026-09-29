/**
 * ==============================================================================
 * DHRUV-NET Ocean Observation Platform
 * Firmware: NodeMCU ESP8266 Wi-Fi Real-Time Telemetry Transmitter
 * Target Board: NodeMCU 1.0 (ESP-12E Module) / ESP8266 80MHz/160MHz
 * ==============================================================================
 * 
 * Pipeline:
 * Physical Sensors (DS18B20, DHT22, BMP280, MPU6050, NEO-6M GPS)
 *    ↓
 * NodeMCU ESP8266 (Reads pins, serializes JSON)
 *    ↓
 * Local 2.4 GHz Wi-Fi (HTTP POST)
 *    ↓
 * Node.js / Express Backend (http://YOUR_PC_IP:5000/api/sensor-data)
 *    ↓
 * WebSocket Broadcast (ws://YOUR_PC_IP:5000)
 *    ↓
 * DHRUV-NET Ocean Observation Dashboard (LIVE STATUS & READINGS)
 * 
 * REQUIRED ARDUINO LIBRARIES:
 * 1. ESP8266WiFi (Built into ESP8266 Board Core)
 * 2. ESP8266HTTPClient (Built into ESP8266 Board Core)
 * 3. ArduinoJson (v6.x or v7.x by Benoit Blanchon)
 * 4. (Optional Physical Sensors):
 *    - OneWire & DallasTemperature (for DS18B20 Water Temp on Pin D3 / GPIO0)
 *    - DHT sensor library (by Adafruit for DHT22 Air Temp & Humidity on Pin D4 / GPIO2)
 *    - Adafruit BMP280 Library (for Barometric Pressure on I2C: D1 SCL / D2 SDA)
 * ==============================================================================
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>

// ==========================================
// 1. WI-FI CREDENTIALS
// ==========================================
// IMPORTANT: ESP8266 only connects to 2.4 GHz Wi-Fi networks (not 5 GHz).
const char* WIFI_SSID     = "ESP";
const char* WIFI_PASSWORD = "Cheyon@2025";

// ==========================================
// 2. BACKEND API URL CONFIGURATION
// ==========================================
// IMPORTANT:
// DO NOT use "localhost" or "127.0.0.1" here!
// Replace the IP below with your computer's local Wi-Fi IPv4 address.
// Run 'ipconfig' in Windows Command Prompt to find your IPv4 Address.
// Example: "http://192.168.1.105:5000/api/sensor-data"
// Current detected PC LAN IP: 10.13.245.214
const char* SERVER_URL = "http://10.13.245.214:5000/api/sensor-data";

// Platform Device Identifier
const char* DEVICE_ID = "DHRUV-01";

// Transmission Interval in milliseconds (5000ms = 5 seconds)
const unsigned long TRANSMIT_INTERVAL_MS = 200;
unsigned long lastTransmitTime = 0;

// Packet Counter
unsigned long packetSeq = 0;

// ==========================================
// 3. PHYSICAL SENSOR HARDWARE PIN DEFINITIONS
// ==========================================
// Pin D3 (GPIO0) -> DS18B20 One-Wire Bus (with 4.7kΩ pull-up resistor to 3.3V)
// Pin D4 (GPIO2) -> DHT22 Digital Data Pin (with 10kΩ pull-up resistor to 3.3V)
// Pin D1 (GPIO5) -> BMP280 / MPU6050 I2C SCL
// Pin D2 (GPIO4) -> BMP280 / MPU6050 I2C SDA
// Pin D7 (GPIO13)-> NEO-6M GPS Tx (NodeMCU Rx)
// Pin D8 (GPIO15)-> NEO-6M GPS Rx (NodeMCU Tx)

// Toggle this flag if you have physical DS18B20, DHT22, or BMP280 sensors wired:
#define HAS_PHYSICAL_SENSORS true

#if HAS_PHYSICAL_SENSORS
  #include <OneWire.h>
  #include <DallasTemperature.h>
  #include <DHT.h>
  #include <Wire.h>
  #include <Adafruit_BMP280.h>

  #define ONE_WIRE_BUS 0 // D3 / GPIO0
  OneWire oneWire(ONE_WIRE_BUS);
  DallasTemperature ds18b20(&oneWire);

  #define DHTPIN 2       // D4 / GPIO2
  #define DHTTYPE DHT22
  DHT dht(DHTPIN, DHTTYPE);

  Adafruit_BMP280 bmp;
  bool isBmpAvailable = false;
#endif

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n");
  Serial.println("==================================================");
  Serial.println("  DHRUV-NET Ocean Observation Platform");
  Serial.println("  NodeMCU ESP8266 Wi-Fi Telemetry Transmitter");
  Serial.println("==================================================");

  // Initialize sensors if physically present
#if HAS_PHYSICAL_SENSORS
  Serial.println("[Sensors]: Initializing physical probe buses...");
  ds18b20.begin();
  dht.begin();
  Wire.begin(4, 5); // SDA = D2 (GPIO4), SCL = D1 (GPIO5)
  if (bmp.begin(0x76) || bmp.begin(0x77)) {
    isBmpAvailable = true;
    Serial.println("[Sensors]: BMP280 Barometer detected.");
  } else {
    Serial.println("[Sensors]: BMP280 not found, checking raw I2C...");
  }
#else
  Serial.println("[Sensors]: Running in Hardware Prototype Mode.");
  Serial.println("[Sensors]: Connect physical probes to GPIO pins D1-D4.");
#endif

  // Connect to Wi-Fi
  connectWiFi();
}

void loop() {
  // Ensure Wi-Fi remains connected
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[Wi-Fi]: Connection dropped! Reconnecting...");
    connectWiFi();
  }

  // Periodic transmission
  unsigned long currentMillis = millis();
  if (currentMillis - lastTransmitTime >= TRANSMIT_INTERVAL_MS) {
    lastTransmitTime = currentMillis;
    sendTelemetryPacket();
  }
}

/**
 * Connect to 2.4 GHz Wi-Fi Network with Timeout & Retry
 */
void connectWiFi() {
  Serial.print("[Wi-Fi]: Connecting to SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("==================================================");
    Serial.println(" Wi-Fi Connected Successfully!");
    Serial.print(" ESP8266 Local IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print(" Subnet Mask: ");
    Serial.println(WiFi.subnetMask());
    Serial.print(" Wi-Fi Gateway: ");
    Serial.println(WiFi.gatewayIP());
    Serial.print(" Signal Strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    Serial.print(" Target Ingestion Endpoint: ");
    Serial.println(SERVER_URL);
    Serial.println("==================================================");
  } else {
    Serial.println("❌ [Wi-Fi]: Failed to connect to Wi-Fi.");
    Serial.println("   - Verify 2.4 GHz network (ESP8266 does not support 5 GHz)");
    Serial.println("   - Check SSID and password in code");
    Serial.println("   - Will retry in next loop iteration...");
  }
}

/**
 * Acquire Sensor Readings, Serialize JSON, and HTTP POST to Backend
 */
void sendTelemetryPacket() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️ [HTTP]: Cannot send packet - Wi-Fi is disconnected.");
    return;
  }

  packetSeq++;
  Serial.println("\n--------------------------------------------------");
  Serial.print("📡 [Transmitter]: Preparing Telemetry Packet #");
  Serial.println(packetSeq);

  // 1. Read Sensor Values
  float waterTemp = 0.0;
  bool waterTempValid = false;

  float airTemp = 0.0;
  bool airTempValid = false;

  float humidity = 0.0;
  bool humidityValid = false;

  float pressure = 0.0;
  bool pressureValid = false;

  float depth = 18.6; // Subsurface depth placeholder
  float latitude = 11.6643;
  float longitude = 78.1460;

#if HAS_PHYSICAL_SENSORS
  // Read DS18B20 Water Temperature
  ds18b20.requestTemperatures();
  float rawWater = ds18b20.getTempCByIndex(0);
  if (rawWater > -55.0 && rawWater < 125.0 && rawWater != DEVICE_DISCONNECTED_C) {
    waterTemp = rawWater;
    waterTempValid = true;
  }

  // Read DHT22 Air Temp & Humidity
  float rawAir = dht.readTemperature();
  float rawHum = dht.readHumidity();
  if (!isnan(rawAir)) { airTemp = rawAir; airTempValid = true; }
  if (!isnan(rawHum)) { humidity = rawHum; humidityValid = true; }

  // Read BMP280 Barometer
  if (isBmpAvailable) {
    float rawPress = bmp.readPressure() / 100.0F; // Pa to hPa
    if (!isnan(rawPress) && rawPress > 800.0 && rawPress < 1200.0) {
      pressure = rawPress;
      pressureValid = true;
    }
  }
#else
  // PROTOTYPE SENSOR READINGS:
  // When physical probes are connected, set HAS_PHYSICAL_SENSORS to true.
  // For the initial prototype, read analog A0 / ADC or provide real measured values:
  waterTemp = 28.2;
  waterTempValid = true;

  airTemp = 29.8;
  airTempValid = true;

  humidity = 75.0;
  humidityValid = true;

  pressure = 1009.6;
  pressureValid = true;
#endif

  // 2. Build JSON Payload using ArduinoJson
  StaticJsonDocument<512> doc;
  doc["deviceId"] = DEVICE_ID;

  if (waterTempValid) doc["waterTemperature"] = waterTemp;
  else doc["waterTemperature"] = nullptr;

  if (airTempValid) doc["airTemperature"] = airTemp;
  else doc["airTemperature"] = nullptr;

  if (humidityValid) doc["humidity"] = humidity;
  else doc["humidity"] = nullptr;

  if (pressureValid) doc["pressure"] = pressure;
  else doc["pressure"] = nullptr;

  doc["depth"] = depth;
  doc["latitude"] = latitude;
  doc["longitude"] = longitude;

  // Add battery reading from NodeMCU ADC Pin A0 (0-1.0V voltage divider)
  int rawAdc = analogRead(A0);
  float batteryVolts = (rawAdc / 1023.0) * 4.2; // Calibrated for 4.2V max Li-ion
  int batteryPct = map(constrain(rawAdc, 700, 1023), 700, 1023, 10, 100);
  doc["battery"] = batteryPct;
  doc["batteryVoltage"] = serialized(String(batteryVolts, 2));

  // Serialize JSON to String
  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.println("[JSON Payload]: " + jsonPayload);

  // 3. Send HTTP POST Request
  WiFiClient client;
  HTTPClient http;

  Serial.print("[HTTP]: Connecting to ");
  Serial.println(SERVER_URL);

  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(4000); // 4-second timeout

  int httpResponseCode = http.POST(jsonPayload);

  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print(" HTTP Response Code: ");
    Serial.println(httpResponseCode);
    Serial.print(" Server Response: ");
    Serial.println(response);

    if (httpResponseCode == 200) {
      Serial.println("✅ [Success]: Telemetry ingested into DHRUV-NET Backend & WebSocket broadcasted!");
    } else {
      Serial.print("⚠️ [Warning]: Unexpected status code: ");
      Serial.println(httpResponseCode);
    }
  } else {
    Serial.print("❌ [HTTP Error]: Failed to send POST request. Error code: ");
    Serial.println(httpResponseCode);
    Serial.print("   Error Details: ");
    Serial.println(http.errorToString(httpResponseCode).c_str());
    Serial.println("   Troubleshooting:");
    Serial.println("   1. Verify your PC and ESP8266 are on the exact same Wi-Fi network.");
    Serial.println("   2. Check if the Node.js backend is running on port 5000.");
    Serial.println("   3. Allow Port 5000 in Windows Defender Firewall.");
    Serial.print("   4. Ping PC IP from another phone/device: ");
    Serial.println(SERVER_URL);
  }

  http.end();
}
