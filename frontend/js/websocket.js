/**
 * WEBSOCKET MANAGER AND SIMULATOR
 * Coordinates real connections and fallback simulations.
 */

import { createMockAlert } from './mockData.js';

export class AlertWebSocketManager {
  /**
   * @param {string} url - URL del microservicio de notificaciones
   * @param {Object} options - Parámetros de configuración
   */
  constructor(url = "ws://localhost:8080/alerts", options = {}) {
    this.url = url;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 5000; // 5 segundos
    this.isSimulating = false;
    this.simulationTimer = null;
    
    // Callbacks del suscriptor
    this.onMessageCallback = options.onMessage || (() => {});
    this.onStatusChangeCallback = options.onStatusChange || (() => {});
    this.onLogCallback = options.onLog || (() => {});
  }

  /**
   * Inicializa la conexión de WebSockets real.
   */
  connect() {
    this.log("Iniciando conexión WebSocket a: " + this.url, "info");
    this.updateStatus("CONNECTING");

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = (event) => {
        this.reconnectAttempts = 0;
        this.updateStatus("CONNECTED");
        this.log("Conectado con éxito al microservicio de notificaciones.", "success");
      };

      this.socket.onmessage = (event) => {
        try {
          const alertData = JSON.parse(event.data);
          this.log(`Alerta recibida vía WS: ${alertData.id} - ${alertData.type}`, "info");
          this.onMessageCallback(alertData);
        } catch (err) {
          this.log("Error al parsear el JSON de alerta entrante: " + err.message, "danger");
        }
      };

      this.socket.onerror = (error) => {
        this.log("Error en WebSocket. Estado de red comprometido.", "danger");
      };

      this.socket.onclose = (event) => {
        this.updateStatus("DISCONNECTED");
        this.log(`Conexión cerrada (Código: ${event.code}).`, "warning");
        this.attemptReconnect();
      };
    } catch (err) {
      this.log("Error al instanciar WebSocket: " + err.message, "danger");
      this.updateStatus("DISCONNECTED");
      this.attemptReconnect();
    }
  }

  /**
   * Reintento automático de conexión con backoff simple.
   */
  attemptReconnect() {
    if (this.isSimulating) return; // Si estamos simulando, no inundamos con reintentos reales
    
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.log(`Intento de reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts} en ${this.reconnectInterval/1000}s...`, "info");
      setTimeout(() => this.connect(), this.reconnectInterval);
    } else {
      this.log("Máximo de reintentos alcanzado. Permaneciendo desconectado. Active modo Simulación para demostración local.", "warning");
    }
  }

  /**
   * Desconecta el socket actual.
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.updateStatus("DISCONNECTED");
  }

  /**
   * Activa/Desactiva el generador de simulación local.
   */
  toggleSimulation(active) {
    this.isSimulating = active;
    if (active) {
      this.disconnect(); // Desconectamos del WS real para la simulación
      this.updateStatus("CONNECTED"); // Simulamos estar conectados al WS virtual
      this.log("Modo Simulación ACTIVO. Generando tráfico virtual...", "success");
      
      // Lanzar primera alerta inmediatamente para feedback instantáneo
      this.triggerSimulatedAlert();
      this.startSimulationSchedule();
    } else {
      this.stopSimulation();
      this.log("Modo Simulación INACTIVO. Intentando reconexión a WS real...", "info");
      this.connect();
    }
  }

  /**
   * Programa la llegada aleatoria de alertas.
   */
  startSimulationSchedule() {
    if (!this.isSimulating) return;
    
    // Intervalo aleatorio entre 6 y 15 segundos
    const nextInterval = 6000 + Math.random() * 9000;
    this.simulationTimer = setTimeout(() => {
      this.triggerSimulatedAlert();
      this.startSimulationSchedule();
    }, nextInterval);
  }

  /**
   * Dispara una sola alerta simulada.
   */
  triggerSimulatedAlert(forcedPriority = null) {
    const mockAlert = createMockAlert(forcedPriority);
    this.log(`[WS-VIRTUAL] Alerta entrante: ${mockAlert.id} - Prioridad: ${mockAlert.priority}`, "info");
    this.onMessageCallback(mockAlert);
  }

  /**
   * Detiene el programador de simulación.
   */
  stopSimulation() {
    if (this.simulationTimer) {
      clearTimeout(this.simulationTimer);
      this.simulationTimer = null;
    }
    this.isSimulating = false;
  }

  /**
   * Envía el estado de la conexión a los suscriptores.
   */
  updateStatus(status) {
    this.onStatusChangeCallback(status, this.isSimulating);
  }

  /**
   * Registra mensajes en la consola del operador.
   */
  log(message, type = "info") {
    this.onLogCallback(message, type);
  }
}
