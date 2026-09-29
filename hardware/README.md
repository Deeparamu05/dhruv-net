# DHRUV-NET Hardware Integration Guide: ESP8266 NodeMCU -> Wi-Fi -> Backend -> Dashboard

This directory contains the firmware and instructions to connect a real **NodeMCU ESP8266** microcontroller to the **DHRUV-NET Ocean Observation Platform**.

---

## 1. System Architecture

```
Physical Sensors (DS18B20, DHT22, BMP280, MPU6050, GPS)
    ↓
NodeMCU ESP8266 Microcontroller
    ↓  (2.4 GHz Wi-Fi)
Node.js + Express Backend (`POST /api/sensor-data`)
    ↓  (WebSocket ws://localhost:5000)
DHRUV-NET Web Dashboard (Reactive Live Telemetry)
```

---

## 2. Hardware Wiring & Pin Mapping

| Sensor | Sensor Pin | NodeMCU Pin | GPIO | Description / Notes |
|---|---|---|---|---|
| **DS18B20** | Data | **D3** | GPIO0 | Waterproof Water Temp. Requires 4.7kΩ pull-up to 3.3V. |
| **DS18B20** | VCC | **3V3** | - | 3.3V Power |
| **DS18B20** | GND | **GND** | - | Ground |
| **DHT22** | Data | **D4** | GPIO2 | Ambient Air Temp & Relative Humidity. 10kΩ pull-up. |
| **DHT22** | VCC | **3V3** | - | 3.3V Power |
| **DHT22** | GND | **GND** | - | Ground |
| **BMP280** | SCL | **D1** | GPIO5 | Barometric Pressure I2C Clock |
| **BMP280** | SDA | **D2** | GPIO4 | Barometric Pressure I2C Data |
| **BMP280** | VCC | **3V3** | - | 3.3V Power |
| **BMP280** | GND | **GND** | - | Ground |
| **MPU6050** | SCL / SDA | **D1 / D2** | GPIO5/4 | Shared I2C Bus with BMP280 (Address 0x68) |
| **Battery Divider** | Output | **A0** | ADC0 | 0-1.0V Analog Input for 3.7V Li-ion battery monitoring |

---

## 3. Arduino IDE Setup & Required Libraries

1. **Install ESP8266 Board Package in Arduino IDE**:
   - Go to `File` -> `Preferences`.
   - In "Additional Boards Manager URLs", add:
     ```
     http://arduino.esp8266.com/stable/package_esp8266com_index.json
     ```
   - Go to `Tools` -> `Board` -> `Boards Manager...`.
   - Search for **esp8266** and click **Install**.
   - Select Board: **NodeMCU 1.0 (ESP-12E Module)**.
   - Upload Speed: **115200**.

2. **Install Required Libraries via Library Manager** (`Sketch` -> `Include Library` -> `Manage Libraries...`):
   - **ArduinoJson** (by Benoit Blanchon, install version 6.x or 7.x)
   - *(Optional for physical probes)*:
     - **OneWire** (by Jim Studt)
     - **DallasTemperature** (by Miles Burton)
     - **DHT sensor library** (by Adafruit)
     - **Adafruit BMP280 Library** (by Adafruit)

---

## 4. Configuring the Arduino Sketch (`dhruv_esp8266_wifi.ino`)

Open [`hardware/dhruv_esp8266_wifi.ino`](file:///d:/Dhruv%20Net/hardware/dhruv_esp8266_wifi.ino) and edit lines 38-48:

```cpp
// 1. Your 2.4 GHz Wi-Fi credentials
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// 2. Your Computer's LAN IPv4 Address
// IMPORTANT: Do NOT use "localhost" or "127.0.0.1"!
// Current computer LAN IP: 10.13.245.214
const char* SERVER_URL = "http://10.13.245.214:5000/api/sensor-data";
```

---

## 5. Finding Your Computer's LAN IPv4 Address

In Windows:
1. Open PowerShell or Command Prompt.
2. Run:
   ```powershell
   ipconfig
   ```
3. Locate your active Wi-Fi adapter:
   ```
   Wireless LAN adapter Wi-Fi:
      IPv4 Address. . . . . . . . . . . : 10.13.245.214
   ```
4. Put `http://YOUR_IPV4_ADDRESS:5000/api/sensor-data` in the Arduino sketch.

---

## 6. Windows Defender Firewall Configuration

If the ESP8266 cannot connect to your PC (HTTP Error -1), Windows Firewall may be blocking inbound traffic on port 5000.

Run PowerShell as Administrator and execute:

```powershell
New-NetFirewallRule -DisplayName "DHRUV-NET Backend Port 5000" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

---

## 7. Starting the System

### Start Backend (Port 5000):
```bash
npm run server
```

### Start Frontend Dashboard (Port 5173):
```bash
npm run dev
```

---

## 8. Verifying the Integration Manually

You can test the API manually from another computer, phone, or local terminal using curl or PowerShell:

```bash
curl -X POST http://localhost:5000/api/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "DHRUV-01",
    "waterTemperature": 28.2,
    "airTemperature": 29.8,
    "humidity": 75,
    "pressure": 1009.6,
    "depth": 18.6,
    "latitude": 11.6643,
    "longitude": 78.1460
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "Sensor data received"
}
```

Check the dashboard in your browser (`http://localhost:5173`). The status will instantly switch from **DISCONNECTED** to **CONNECTED**, the sensor cards will update in real time via WebSocket, and the status tag will switch to **LIVE**!
