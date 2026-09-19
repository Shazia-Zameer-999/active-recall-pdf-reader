// js/p2pMesh.js — Local Mesh & Bluetooth Abstraction Layer for Recallo
// Enables synchronized study rooms, live green signals, and chat with 0 cellular data.

const P2PMesh = {
  channelName: 'recalio_p2p_mesh',
  channel: null,
  listeners: [],
  peerId: null,

  init() {
    if (!this.peerId) {
      this.peerId = 'peer_' + Math.random().toString(36).substring(2, 9);
    }

    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel(this.channelName);
        this.channel.onmessage = (event) => {
          this.handleIncoming(event.data);
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not available, falling back to storage events:', e);
    }

    // Secondary fallback via StorageEvent for older browsers / iframe boundaries
    window.addEventListener('storage', (e) => {
      if (e.key === 'recalio_mesh_event' && e.newValue) {
        try {
          const data = JSON.parse(e.newValue);
          if (data && data.sender !== this.peerId) {
            this.handleIncoming(data);
          }
        } catch {}
      }
    });

    return this.peerId;
  },

  // Broadcast a packet across the local mesh (all tabs, windows, and local peers)
  broadcast(type, payload = {}) {
    const packet = {
      type,
      sender: this.peerId,
      timestamp: Date.now(),
      payload,
    };

    // 1. BroadcastChannel
    if (this.channel) {
      try {
        this.channel.postMessage(packet);
      } catch (err) {
        console.warn('Channel post failed:', err);
      }
    }

    // 2. Storage fallback
    try {
      localStorage.setItem('recalio_mesh_event', JSON.stringify(packet));
    } catch {}

    // 3. Web Bluetooth / Nearby Connections hook point (future native bridge)
    if (window.AndroidNearbyBridge) {
      window.AndroidNearbyBridge.send(JSON.stringify(packet));
    }
  },

  // Register listener for specific packet types
  on(type, callback) {
    this.listeners.push({ type, callback });
  },

  // Unregister listener
  off(type, callback) {
    this.listeners = this.listeners.filter((l) => !(l.type === type && l.callback === callback));
  },

  handleIncoming(packet) {
    if (!packet || !packet.type) return;
    this.listeners.forEach((l) => {
      if (l.type === '*' || l.type === packet.type) {
        try {
          l.callback(packet.payload, packet.sender, packet.timestamp);
        } catch (err) {
          console.error(`Error in mesh listener for ${packet.type}:`, err);
        }
      }
    });
  },

  // Web Bluetooth Simulation & Pairing
  async scanForBluetoothPeers() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([
          { id: 'bt_peer_1', name: 'Coach B4 - Seat 42', signal: 'Strong (RSSI -58dBm)' },
          { id: 'bt_peer_2', name: 'Coach B4 - Seat 45', signal: 'Good (RSSI -67dBm)' },
        ]);
      }, 1200);
    });
  },
};

// Auto-initialize
P2PMesh.init();
window.P2PMesh = P2PMesh;
