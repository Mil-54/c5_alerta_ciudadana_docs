/**
 * REAL-TIME ALERTS FEED CONTROLLER
 * Coordinates UI updates for incoming notifications, badge bindings, action actions, and sound triggers.
 */

export class AlertsFeedManager {
  constructor(containerId = "alerts-feed-container", options = {}) {
    this.container = document.getElementById(containerId);
    this.emptyState = document.getElementById("feed-empty-state");
    this.activeAlerts = [];
    
    // Callbacks del coordinador (app.js)
    this.onAlertSelected = options.onAlertSelected || (() => {});
    this.onDispatchRequested = options.onDispatchRequested || (() => {});
    this.onResolveRequested = options.onResolveRequested || (() => {});
    this.onCountUpdated = options.onCountUpdated || (() => {});
    
    // Sintetizador de sonido táctico
    this.audioCtx = null;
  }

  /**
   * Agrega una alerta al feed y reproduce alertas sonoras correspondientes
   */
  addAlert(alert) {
    // Evitar duplicados
    if (this.activeAlerts.some(a => a.id === alert.id)) return;

    this.activeAlerts.unshift(alert);
    this.renderAlertCard(alert);
    this.toggleEmptyState();
    this.playTacticalNotification(alert.priority);
    this.updateBadgeCounter();
  }

  /**
   * Remueve una alerta del feed
   */
  removeAlert(alertId) {
    this.activeAlerts = this.activeAlerts.filter(a => a.id !== alertId);
    const card = document.getElementById(`card-${alertId}`);
    if (card) {
      // Animación de salida y remoción
      card.style.animation = "slide-in-card 0.3s reverse ease-out";
      setTimeout(() => {
        card.remove();
        this.toggleEmptyState();
        this.updateBadgeCounter();
      }, 280);
    }
  }

  /**
   * Actualiza el estado visual de una tarjeta (por ejemplo, a "DESPACHADA")
   */
  updateAlertStatus(alertId, newStatus, unitName) {
    const alert = this.activeAlerts.find(a => a.id === alertId);
    if (!alert) return;

    alert.status = newStatus;
    alert.unitDispatched = unitName;

    const card = document.getElementById(`card-${alertId}`);
    if (card) {
      // Reemplazar o actualizar elementos dentro de la tarjeta
      const actionsContainer = card.querySelector(".alert-card-actions");
      const priorityBadge = card.querySelector(".badge-priority");
      
      // Actualizar badge de prioridad para mostrar info de la unidad
      if (newStatus === "DISPATCHED" && actionsContainer) {
        priorityBadge.outerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <span class="badge-priority ${alert.priority.toLowerCase()}">${alert.priority}</span>
            <span class="badge-status dispatched" style="font-size:0.6rem;">UNIDAD: ${unitName}</span>
          </div>
        `;
        
        // Modificar acciones a solo "RESOLVER"
        actionsContainer.innerHTML = `
          <button class="btn btn-neon-blue btn-sm btn-resolve-alert" data-id="${alert.id}" style="width: 100%;">
            <i data-lucide="check"></i> COMPLETAR Y RESOLVER
          </button>
        `;
        
        // Re-iniciar íconos Lucide inyectados
        if (window.lucide) window.lucide.createIcons();
        this.bindCardEvents(card, alert);
      }
    }
  }

  /**
   * Inserta la tarjeta de alerta en el DOM con transiciones limpias
   */
  renderAlertCard(alert) {
    // Ocultar empty state
    if (this.emptyState) this.emptyState.style.display = "none";

    const timestamp = new Date(alert.timestamp);
    const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`;

    const card = document.createElement("article");
    card.id = `card-${alert.id}`;
    card.className = `alert-card priority-${alert.priority.toLowerCase()}`;
    
    // Inyectar estructura HTML
    card.innerHTML = `
      <div class="alert-card-header">
        <span class="alert-id">${alert.id}</span>
        <span class="alert-timestamp">${timeStr}</span>
      </div>
      <div class="alert-card-body">
        <div class="info-item">
          <span class="info-label">Evento</span>
          <span class="info-value" style="color:var(--text-main); font-weight:700;">${alert.type}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Dispositivo</span>
          <span class="info-value mono">${alert.esp32Id}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Zona Geográfica</span>
          <span class="info-value">${alert.zone}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Coordenadas GPS</span>
          <span class="info-value mono">${alert.coordinates.lat}, ${alert.coordinates.lng}</span>
        </div>
      </div>
      
      <div class="alert-card-footer-action" style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
        <span class="badge-priority ${alert.priority.toLowerCase()}">${alert.priority}</span>
      </div>

      <div class="alert-card-actions">
        <button class="btn btn-neon-yellow btn-sm btn-dispatch-unit" data-id="${alert.id}">
          <i data-lucide="navigation"></i> DESPACHAR
        </button>
        <button class="btn btn-neon-blue btn-sm btn-resolve-alert" data-id="${alert.id}">
          <i data-lucide="check"></i> RESOLVER
        </button>
      </div>
    `;

    // Insertar al principio del feed
    this.container.prepend(card);

    // Activar íconos Lucide inyectados
    if (window.lucide) window.lucide.createIcons();

    // Vincular Eventos
    this.bindCardEvents(card, alert);
  }

  /**
   * Vincula gestores de eventos para las interacciones con la tarjeta
   */
  bindCardEvents(card, alert) {
    // Al hacer click en la tarjeta, enfocar en el mapa
    card.addEventListener("click", (e) => {
      // No disparar si hace click en un botón
      if (e.target.closest("button") || e.target.closest("a")) return;
      this.onAlertSelected(alert);
      
      // Añadir clase temporal de enfocado visualmente
      document.querySelectorAll(".alert-card").forEach(c => c.classList.remove("focused"));
      card.classList.add("focused");
    });

    // Botón Desplegar Unidad
    const btnDispatch = card.querySelector(".btn-dispatch-unit");
    if (btnDispatch) {
      btnDispatch.addEventListener("click", () => {
        this.onDispatchRequested(alert);
      });
    }

    // Botón Resolver Alerta
    const btnResolve = card.querySelector(".btn-resolve-alert");
    if (btnResolve) {
      btnResolve.addEventListener("click", () => {
        this.onResolveRequested(alert);
      });
    }
  }

  /**
   * Oculta o muestra el empty state del feed
   */
  toggleEmptyState() {
    if (this.activeAlerts.length === 0) {
      if (this.emptyState) this.emptyState.style.display = "flex";
    } else {
      if (this.emptyState) this.emptyState.style.display = "none";
    }
  }

  /**
   * Actualiza el badge del feed en la cabecera
   */
  updateBadgeCounter() {
    const badge = document.getElementById("feed-count");
    if (badge) {
      badge.textContent = `${this.activeAlerts.length} ACTIVAS`;
      if (this.activeAlerts.length > 0) {
        badge.classList.add("pulse-active");
      } else {
        badge.classList.remove("pulse-active");
      }
    }
    this.onCountUpdated(this.activeAlerts);
  }

  /**
   * Genera tonos de alerta de audio sintetizados (Web Audio API)
   * Evita cargar archivos pesados y genera sonidos limpios futuristas de alta fidelidad
   */
  playTacticalNotification(priority) {
    try {
      // Inicialización perezosa de AudioContext tras interacción del operador
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const osc = this.audioCtx.createOscillator();
      const gainNode = this.audioCtx.createGain();
      
      osc.connect(gainNode);
      gainNode.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;

      if (priority === "CRITICAL") {
        // Alerta Crítica: Tono bip-bip militar alternante agudo
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(880, now); // A5
        osc.frequency.exponentialRampToValueAtTime(1200, now + 0.15);
        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.45);
        
        // Segundo bip rápido
        setTimeout(() => {
          const osc2 = this.audioCtx.createOscillator();
          const gain2 = this.audioCtx.createGain();
          osc2.connect(gain2);
          gain2.connect(this.audioCtx.destination);
          osc2.type = "sawtooth";
          osc2.frequency.setValueAtTime(880, this.audioCtx.currentTime);
          osc2.frequency.exponentialRampToValueAtTime(1200, this.audioCtx.currentTime + 0.15);
          gain2.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.35);
          osc2.start(this.audioCtx.currentTime);
          osc2.stop(this.audioCtx.currentTime + 0.45);
        }, 180);

      } else if (priority === "HIGH") {
        // Alerta Alta: Tono sonar agudo
        osc.type = "sine";
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.4);
        gainNode.gain.setValueAtTime(0.12, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.65);
      } else {
        // Alerta Media: Tono suave de notificación
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(554, now + 0.15);
        gainNode.gain.setValueAtTime(0.08, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (err) {
      // Ignorar fallas de reproducción silenciosa del navegador si no ha habido interacción
      console.warn("Falla de reproducción de audio sintético: ", err);
    }
  }
}
