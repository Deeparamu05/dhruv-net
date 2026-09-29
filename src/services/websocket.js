/**
 * DHRUV-NET WebSocket Client Service
 * Establishes persistent real-time duplex connection between DHRUV-NET dashboard
 * and the Express + WebSocket backend (port 5000).
 * 
 * Auto-reconnects on drop and delivers live sensor updates directly to UI state.
 */

class HardwareWebSocketService {
  constructor() {
    this.ws = null;
    this.subscribers = new Set();
    this.isConnected = false;
    this.reconnectTimer = null;
    this.reconnectInterval = 3000;
    this.url = this.getWebSocketUrl();
  }

  getWebSocketUrl() {
    // If running in browser, connect to backend port 5000 on current hostname
    if (typeof window !== 'undefined') {
      const host = window.location.hostname || 'localhost';
      return `ws://${host}:5000`;
    }
    return 'ws://localhost:5000';
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log(`⚡ [WebSocket]: Connected to DHRUV-NET backend at ${this.url}`);
        this.isConnected = true;
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.notify({ type: 'WS_STATUS', connected: true });
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.notify(payload);
        } catch (e) {
          console.warn("[WebSocket Parse Error]:", e.message);
        }
      };

      this.ws.onclose = () => {
        if (this.isConnected) {
          console.warn(`⚠️ [WebSocket]: Disconnected from backend. Reconnecting in ${this.reconnectInterval / 1000}s...`);
        }
        this.isConnected = false;
        this.notify({ type: 'WS_STATUS', connected: false });
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        // Will trigger onclose
      };
    } catch (e) {
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectInterval);
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    // Send immediate current status to new subscriber
    callback({ type: 'WS_STATUS', connected: this.isConnected });
    return () => {
      this.subscribers.delete(callback);
    };
  }

  notify(data) {
    this.subscribers.forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error("Subscriber notification error:", err);
      }
    });
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

export const hwWebSocket = new HardwareWebSocketService();
