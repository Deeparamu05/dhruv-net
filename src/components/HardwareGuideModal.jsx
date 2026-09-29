import React, { useState } from 'react';
import { 
  X, 
  Cpu, 
  Radio, 
  Activity, 
  Check, 
  Copy, 
  Terminal, 
  AlertTriangle, 
  Zap, 
  Layers, 
  Sliders,
  CheckCircle2,
  HelpCircle,
  Wifi,
  Globe,
  Send
} from 'lucide-react';
import { sendTestSensorData } from '../services/api';

export default function HardwareGuideModal({ 
  isOpen, 
  onClose, 
  isHardwareConnected, 
  onToggleTestHardware 
}) {
  const [activeTab, setActiveTab] = useState('wifi'); // 'wifi' | 'wiring' | 'firmware' | 'api' | 'lora'
  const [copiedCode, setCopiedCode] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [isSending, setIsSending] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const sampleSensorDataCurl = `curl -X POST http://10.13.245.214:5000/api/sensor-data \\
  -H "Content-Type: application/json" \\
  -d '{
    "deviceId": "DHRUV-01",
    "waterTemperature": 28.2,
    "airTemperature": 29.8,
    "humidity": 75,
    "pressure": 1009.6,
    "depth": 18.6,
    "latitude": 11.6643,
    "longitude": 78.1460,
    "timestamp": "2026-09-28T11:30:00Z"
  }'`;

  const esp8266WifiFirmware = `/**
 * DHRUV-NET Ocean Observation Platform
 * ESP8266 NodeMCU Wi-Fi Telemetry Transmitter Firmware
 * 
 * Sends sensor data via HTTP POST to:
 * http://10.13.245.214:5000/api/sensor-data
 */

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID     = "YOUR_2.4GHZ_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Target Computer LAN IPv4 Address (Port 5000)
// DO NOT use "localhost" or "127.0.0.1" in ESP8266!
const char* SERVER_URL    = "http://10.13.245.214:5000/api/sensor-data";
const char* DEVICE_ID     = "DHRUV-01";

const unsigned long TRANSMIT_INTERVAL_MS = 5000;
unsigned long lastTransmit = 0;

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\\nStarting DHRUV-NET NodeMCU Transmitter...");

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\\nWi-Fi Connected! IP: " + WiFi.localIP().toString());
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    delay(2000);
    return;
  }

  if (millis() - lastTransmit >= TRANSMIT_INTERVAL_MS) {
    lastTransmit = millis();
    sendTelemetry();
  }
}

void sendTelemetry() {
  WiFiClient client;
  HTTPClient http;

  StaticJsonDocument<512> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["waterTemperature"] = 28.2;  // Read from DS18B20 Pin D3
  doc["airTemperature"]   = 29.8;  // Read from DHT22 Pin D4
  doc["humidity"]         = 75.0;  // Read from DHT22 Pin D4
  doc["pressure"]         = 1009.6;// Read from BMP280 Pins D1/D2
  doc["depth"]            = 18.6;  // Subsurface depth placeholder
  doc["latitude"]         = 11.6643;
  doc["longitude"]        = 78.1460;

  String jsonStr;
  serializeJson(doc, jsonStr);

  http.begin(client, SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  int code = http.POST(jsonStr);
  Serial.printf("HTTP POST Response: %d\\n", code);

  http.end();
}`;

  const handleTestPacket = async () => {
    setIsSending(true);
    setTestResult(null);
    try {
      const res = await sendTestSensorData({
        deviceId: "DHRUV-01",
        waterTemperature: +(28.0 + Math.random() * 0.8).toFixed(1),
        airTemperature: +(29.4 + Math.random() * 0.8).toFixed(1),
        humidity: Math.round(73 + Math.random() * 4),
        pressure: +(1009.4 + Math.random() * 0.6).toFixed(1),
        depth: 18.6,
        latitude: 11.6643,
        longitude: 78.1460,
        timestamp: new Date().toISOString()
      });
      setTestResult(res.success ? "Test packet ingested successfully! Check dashboard live status." : `Error: ${res.error}`);
    } catch (e) {
      setTestResult(`Error: ${e.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="hardware-guide-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <Cpu size={22} color="var(--accent-cyan)" />
            <div>
              <h3>Hardware Integration Guide: NodeMCU ESP8266 &rarr; Dashboard</h3>
              <p>Connect your real ESP8266 prototype via Wi-Fi to display real live sensor data</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={20} />
          </button>
        </div>

        {/* Current Connection Status Alert */}
        <div className={`modal-status-banner ${isHardwareConnected ? 'connected' : 'not-connected'}`}>
          <div className="status-banner-left">
            {isHardwareConnected ? (
              <CheckCircle2 size={20} color="#34d399" />
            ) : (
              <AlertTriangle size={20} color="#f59e0b" />
            )}
            <div>
              <strong>Current Status: {isHardwareConnected ? 'CONNECTED (LIVE)' : 'NOT CONNECTED'}</strong>
              <div className="banner-subtext">
                {isHardwareConnected 
                  ? 'ESP8266 hardware is actively streaming live telemetry into the dashboard.' 
                  : 'Waiting for hardware connection at POST http://10.13.245.214:5000/api/sensor-data.'}
              </div>
            </div>
          </div>

          <button 
            className="btn-test-toggle active"
            onClick={handleTestPacket}
            disabled={isSending}
            title="Send test sensor packet directly to backend"
          >
            <Send size={13} />
            <span>{isSending ? 'Sending...' : 'Send Live Test Packet'}</span>
          </button>
        </div>

        {testResult && (
          <div style={{ padding: '8px 16px', background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '0.8rem', color: testResult.includes('successfully') ? '#34d399' : '#f87171' }}>
            {testResult}
          </div>
        )}

        {/* Modal Navigation Tabs */}
        <div className="modal-nav-tabs">
          <button 
            className={`tab-btn ${activeTab === 'wifi' ? 'active' : ''}`}
            onClick={() => setActiveTab('wifi')}
          >
            Wi-Fi Architecture (Step 1)
          </button>
          <button 
            className={`tab-btn ${activeTab === 'wiring' ? 'active' : ''}`}
            onClick={() => setActiveTab('wiring')}
          >
            Sensor Pinouts
          </button>
          <button 
            className={`tab-btn ${activeTab === 'firmware' ? 'active' : ''}`}
            onClick={() => setActiveTab('firmware')}
          >
            ESP8266 Arduino Code (.ino)
          </button>
          <button 
            className={`tab-btn ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            REST API &amp; WebSocket
          </button>
          <button 
            className={`tab-btn ${activeTab === 'lora' ? 'active' : ''}`}
            onClick={() => setActiveTab('lora')}
          >
            Future LoRa RA-02 Uplink
          </button>
        </div>

        {/* Modal Body Tab Content */}
        <div className="modal-body-content">
          {/* TAB 1: Wi-Fi Architecture */}
          {activeTab === 'wifi' && (
            <div className="tab-pane">
              <h4>Direct ESP8266 Wi-Fi Ingestion (Working Version)</h4>
              <p>
                To avoid depending on LoRa hardware for the initial prototype, your ESP8266 connects directly to your local Wi-Fi and sends HTTP POST requests to the backend. The backend immediately broadcasts readings to the dashboard via WebSockets.
              </p>

              <div className="pipeline-visual-box">
                <div className="pipe-box-step">
                  <span className="step-num">1</span>
                  <strong>ESP8266 + Sensors</strong>
                  <span>DS18B20, DHT22, BMP280</span>
                </div>
                <span className="pipe-sep">&rarr;</span>
                <div className="pipe-box-step highlight">
                  <span className="step-num">2</span>
                  <strong>2.4 GHz Wi-Fi</strong>
                  <span>HTTP POST to Port 5000</span>
                </div>
                <span className="pipe-sep">&rarr;</span>
                <div className="pipe-box-step">
                  <span className="step-num">3</span>
                  <strong>Node.js Backend</strong>
                  <span>Validation &amp; SQLite Ingestion</span>
                </div>
                <span className="pipe-sep">&rarr;</span>
                <div className="pipe-box-step">
                  <span className="step-num">4</span>
                  <strong>WebSocket</strong>
                  <span>Instant Broadcast to UI</span>
                </div>
                <span className="pipe-sep">&rarr;</span>
                <div className="pipe-box-step">
                  <span className="step-num">5</span>
                  <strong>Live Dashboard</strong>
                  <span>LIVE status &amp; cards update</span>
                </div>
              </div>

              <div className="instruction-box" style={{ marginTop: '16px' }}>
                <h5>Configuration Details for Your Setup:</h5>
                <ul className="guide-checklist">
                  <li><strong>Detected PC Wi-Fi LAN IP:</strong> <code>10.13.245.214</code></li>
                  <li><strong>Backend Server Port:</strong> <code>5000</code></li>
                  <li><strong>Full Ingestion URL:</strong> <code>http://10.13.245.214:5000/api/sensor-data</code></li>
                  <li><strong>WebSocket URL:</strong> <code>ws://10.13.245.214:5000</code></li>
                  <li><strong>Timeout Threshold:</strong> 30 seconds (after 30s without packet, status automatically switches to <strong>DISCONNECTED</strong>, preserving last known readings).</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 2: Pinout & Wiring */}
          {activeTab === 'wiring' && (
            <div className="tab-pane">
              <h4>NodeMCU ESP8266 Pinout &amp; Wiring Diagram</h4>
              <p>Connect your physical sensors to the corresponding NodeMCU GPIO pins as defined below:</p>

              <table className="guide-table">
                <thead>
                  <tr>
                    <th>Sensor Unit</th>
                    <th>Sensor Pin</th>
                    <th>NodeMCU Pin</th>
                    <th>ESP GPIO</th>
                    <th>Bus / Protocol &amp; Pull-Up</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>DS18B20</strong> (Water Temp)</td>
                    <td>DQ / Data</td>
                    <td><strong>D3</strong></td>
                    <td>GPIO0</td>
                    <td>1-Wire Bus (4.7kΩ pull-up resistor to 3.3V)</td>
                  </tr>
                  <tr>
                    <td><strong>DHT22</strong> (Air Temp &amp; Humidity)</td>
                    <td>Data / Out</td>
                    <td><strong>D4</strong></td>
                    <td>GPIO2</td>
                    <td>Single-Bus Digital (10kΩ pull-up to 3.3V)</td>
                  </tr>
                  <tr>
                    <td><strong>BMP280</strong> (Pressure)</td>
                    <td>SCL / SCK</td>
                    <td><strong>D1</strong></td>
                    <td>GPIO5</td>
                    <td>I2C Clock Bus</td>
                  </tr>
                  <tr>
                    <td><strong>BMP280</strong> (Pressure)</td>
                    <td>SDA / SDI</td>
                    <td><strong>D2</strong></td>
                    <td>GPIO4</td>
                    <td>I2C Data Bus (Address 0x76 / 0x77)</td>
                  </tr>
                  <tr>
                    <td><strong>MPU6050</strong> (Pitch/Roll IMU)</td>
                    <td>SCL / SDA</td>
                    <td><strong>D1 / D2</strong></td>
                    <td>GPIO5 / 4</td>
                    <td>Shared I2C Bus (Address 0x68)</td>
                  </tr>
                  <tr>
                    <td><strong>Battery Voltage Divider</strong></td>
                    <td>V_Sense</td>
                    <td><strong>A0</strong></td>
                    <td>ADC0</td>
                    <td>Analog Input (0–1.0V voltage divider from 3.7V Li-ion)</td>
                  </tr>
                </tbody>
              </table>

              <div className="instruction-box warning">
                <h5>⚠️ Power Supply Reminder</h5>
                <p>
                  NodeMCU ESP8266 operates on <strong>3.3V logic</strong>. Do NOT supply 5V directly to sensor data pins. Power the sensors from the <strong>3V3</strong> pin of the NodeMCU.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Firmware */}
          {activeTab === 'firmware' && (
            <div className="tab-pane">
              <div className="code-header-bar">
                <span>Arduino C++ Sketch: <code>hardware/dhruv_esp8266_wifi.ino</code></span>
                <button 
                  className="btn-copy-code"
                  onClick={() => copyToClipboard(esp8266WifiFirmware, 'firmware')}
                >
                  {copiedCode === 'firmware' ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  <span>{copiedCode === 'firmware' ? 'Copied!' : 'Copy Sketch'}</span>
                </button>
              </div>
              <pre className="code-block-display">{esp8266WifiFirmware}</pre>
            </div>
          )}

          {/* TAB 4: API & Test Ingestion */}
          {activeTab === 'api' && (
            <div className="tab-pane">
              <h4>REST Ingestion Endpoint (POST /api/sensor-data)</h4>
              <p>
                Test sending a real telemetry packet directly from PowerShell, Terminal, or Postman:
              </p>

              <div className="code-header-bar">
                <span>cURL Ingestion Command</span>
                <button 
                  className="btn-copy-code"
                  onClick={() => copyToClipboard(sampleSensorDataCurl, 'curl')}
                >
                  {copiedCode === 'curl' ? <Check size={14} color="#34d399" /> : <Copy size={14} />}
                  <span>{copiedCode === 'curl' ? 'Copied!' : 'Copy cURL'}</span>
                </button>
              </div>
              <pre className="code-block-display">{sampleSensorDataCurl}</pre>

              <h5 style={{ marginTop: '16px', marginBottom: '8px', color: '#ffffff' }}>Validation Rules (HTTP 400 on error):</h5>
              <ul className="guide-checklist">
                <li><code>waterTemperature</code>: numeric (float/integer)</li>
                <li><code>airTemperature</code>: numeric (float/integer)</li>
                <li><code>humidity</code>: numeric (0–100%)</li>
                <li><code>pressure</code>: numeric (hPa)</li>
                <li><code>depth</code>: numeric (meters)</li>
                <li><code>latitude</code>, <code>longitude</code>: numeric coordinates</li>
                <li>If a sensor is disconnected or unplugged, pass <code>null</code> without crashing.</li>
              </ul>
            </div>
          )}

          {/* TAB 5: Future LoRa */}
          {activeTab === 'lora' && (
            <div className="tab-pane">
              <h4>Future LoRa RA-02 Integration (Phase 2)</h4>
              <p>
                The backend already supports LoRa RA-02 via <code>POST /api/telemetry</code> or by attaching a USB serial LoRa receiver bridge. When you are ready to test LoRa:
              </p>
              <ul className="guide-checklist">
                <li>Wire RA-02 SPI pins: NSS (D8), RST (D0), DIO0 (D2), MOSI (D7), MISO (D6), SCK (D5).</li>
                <li>Use standard SX1278 433MHz frequency and spreading factor SF7-SF12.</li>
                <li>The receiver forwards packets to <code>POST http://localhost:5000/api/sensor-data</code> with <code>source: "lora"</code>.</li>
                <li>The dashboard handles both Wi-Fi and LoRa seamlessly without UI differences.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
