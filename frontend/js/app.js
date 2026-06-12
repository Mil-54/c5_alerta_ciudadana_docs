/**
 * C5 TACTICAL DASHBOARD - MAIN COORDINATOR (ENTRY POINT)
 * Wires together Map, Charts, Feed, History, and WebSocket connection.
 */

import { AlertWebSocketManager } from './websocket.js';
import { AlertsFeedManager } from './alerts.js';
import { TacticalMapManager } from './map.js';
import { IncidentHistoryManager } from './history.js';
import { TacticalChartsManager } from './charts.js';

document.addEventListener("DOMContentLoaded", () => {
  
  // --------------------------------------------------------------------------
  // 1. INICIALIZACIÓN DE COMPONENTES
  // --------------------------------------------------------------------------
  
  const systemLogTerminal = document.getElementById("system-log-terminal");
  
  // Imprimir logs en la consola del operador
  const appendSystemLog = (message, type = "info") => {
    const timestamp = new Date();
    const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}:${timestamp.getSeconds().toString().padStart(2, '0')}`;
    
    const logEntry = document.createElement("div");
    logEntry.className = `log-entry text-neon-${type === 'success' ? 'green' : type === 'warning' ? 'yellow' : type === 'danger' ? 'red' : 'blue'}`;
    logEntry.textContent = `[${timeStr}] [${type.toUpperCase()}] ${message}`;
    
    systemLogTerminal.appendChild(logEntry);
    
    // Auto-scroll al final
    systemLogTerminal.scrollTop = systemLogTerminal.scrollHeight;
  };

  appendSystemLog("Inicializando componentes del Centro de Comando Táctico...", "info");

  // A. Historial e Incidencias Persistentes
  const historyManager = new IncidentHistoryManager({
    onHistoryUpdated: () => {
      renderHistoryTable();
      updateDashboardStats();
    },
    onLog: appendSystemLog
  });

  // B. Gráficos Tácticos (Chart.js)
  const chartsManager = new TacticalChartsManager("incident-chart", "priority-chart");

  // C. Mapa Táctico (Leaflet)
  const mapManager = new TacticalMapManager("tactical-map");

  // D. Feed de Alertas en Tiempo Real
  const feedManager = new AlertsFeedManager("alerts-feed-container", {
    onAlertSelected: (alert) => {
      mapManager.focusOnAlert(alert);
      appendSystemLog(`Mapa enfocado en Alerta ${alert.id} - Zona: ${alert.zone}`, "info");
    },
    onDispatchRequested: (alert) => {
      openDispatchModal(alert);
    },
    onResolveRequested: (alert) => {
      resolveAlertDirectly(alert);
    },
    onCountUpdated: (activeAlerts) => {
      updateDashboardStats();
      chartsManager.updateCharts(historyManager.history, activeAlerts);
    }
  });

  // E. Administrador de Conexión de WebSockets
  const wsManager = new AlertWebSocketManager("ws://localhost:8080/alerts", {
    onMessage: (alertData) => {
      // Registrar alerta en feed local
      feedManager.addAlert(alertData);
      
      // Agregar pin interactivo al mapa
      mapManager.addAlertMarker(alertData);
    },
    onStatusChange: (status, isSimulating) => {
      updateWSBadge(status, isSimulating);
    },
    onLog: appendSystemLog
  });

  // --------------------------------------------------------------------------
  // 2. CONEXIÓN DEL SOCKET Y CONTROLADOR DE SIMULACIÓN
  // --------------------------------------------------------------------------
  
  // Por defecto iniciamos la simulación local para demostración inmediata
  wsManager.toggleSimulation(true);

  // Botón de alternancia de simulación
  const btnToggleSim = document.getElementById("btn-toggle-simulation");
  btnToggleSim.addEventListener("click", () => {
    const isCurrentlySimulating = wsManager.isSimulating;
    
    if (isCurrentlySimulating) {
      wsManager.toggleSimulation(false);
      btnToggleSim.innerHTML = `<i data-lucide="play"></i><span>INICIAR SIMULACIÓN</span>`;
      btnToggleSim.className = "btn btn-neon-blue";
    } else {
      wsManager.toggleSimulation(true);
      btnToggleSim.innerHTML = `<i data-lucide="square"></i><span>DETENER SIMULACIÓN</span>`;
      btnToggleSim.className = "btn btn-neon-yellow";
    }
    if (window.lucide) window.lucide.createIcons();
  });

  // Botón Panic Trigger para forzar alerta crítica inmediata
  const btnTriggerPanic = document.getElementById("btn-trigger-panic");
  btnTriggerPanic.addEventListener("click", () => {
    appendSystemLog("PANIC TRIGGER accionado por el operador. Forzando alerta de emergencia crítica...", "danger");
    wsManager.triggerSimulatedAlert("CRITICAL");
  });

  // --------------------------------------------------------------------------
  // 3. ACTUALIZACIÓN DE ESTADÍSTICAS DEL HUD
  // --------------------------------------------------------------------------
  
  const valActive = document.getElementById("val-active-alerts");
  const pctCritical = document.getElementById("pct-critical-alerts");
  const valDeployed = document.getElementById("val-deployed-units");
  const valAvailable = document.getElementById("val-available-units");
  const valResponse = document.getElementById("val-response-time");
  const systemStatusIndicator = document.getElementById("system-status-indicator");

  function updateDashboardStats() {
    const activeCount = feedManager.activeAlerts.length;
    valActive.textContent = activeCount;

    // Indicador luminoso global en la cabecera
    if (activeCount > 0) {
      const hasCritical = feedManager.activeAlerts.some(a => a.priority === "CRITICAL");
      if (hasCritical) {
        systemStatusIndicator.className = "neon-indicator blink-red";
        appendSystemLog("Pulsación crítica de red activa. Estabilidad de zona en alerta naranja.", "warning");
      } else {
        systemStatusIndicator.className = "neon-indicator blink-green"; // Amarillo si hay alertas pero no críticas
      }
    } else {
      systemStatusIndicator.className = "neon-indicator blink-green";
    }

    // Porcentaje de críticas activas
    if (activeCount > 0) {
      const criticals = feedManager.activeAlerts.filter(a => a.priority === "CRITICAL").length;
      const pct = Math.round((criticals / activeCount) * 100);
      pctCritical.textContent = `${pct}%`;
    } else {
      pctCritical.textContent = "0%";
    }

    // Unidades desplegadas
    // Contamos las alertas activas con estado DISPATCHED
    const activeDispatched = feedManager.activeAlerts.filter(a => a.status === "DISPATCHED").length;
    valDeployed.textContent = activeDispatched;
    
    const totalFleet = 12;
    const available = totalFleet - activeDispatched;
    valAvailable.textContent = `${available} dispon.`;

    // Tiempo de respuesta promedio
    const stats = historyManager.getStats();
    valResponse.textContent = `${stats.averageResponseTime} min`;
  }

  // Actualización visual del Badge de WebSocket
  const wsBadge = document.getElementById("ws-status-badge");
  const wsBadgeText = document.getElementById("ws-status-text");

  function updateWSBadge(status, isSimulating) {
    if (status === "CONNECTED") {
      wsBadge.className = "websocket-badge connected";
      wsBadgeText.textContent = isSimulating ? "WS VIRTUAL (SIM)" : "WS CONNECTED";
    } else if (status === "CONNECTING") {
      wsBadge.className = "websocket-badge connecting";
      wsBadgeText.textContent = "WS CONNECTING...";
    } else {
      wsBadge.className = "websocket-badge";
      wsBadgeText.textContent = "WS DISCONNECTED";
    }
  }

  // --------------------------------------------------------------------------
  // 4. FLUJO DE TRABAJO DE DESPACHO (MODAL ACCIONS)
  // --------------------------------------------------------------------------
  
  const dispatchModal = document.getElementById("dispatch-modal");
  const btnCloseModal = document.getElementById("btn-close-modal");
  const btnCancelDispatch = document.getElementById("btn-cancel-dispatch");
  const dispatchForm = document.getElementById("dispatch-form");
  const modalAlertBrief = document.getElementById("modal-alert-brief");
  
  let currentAlertForDispatch = null;

  function openDispatchModal(alert) {
    currentAlertForDispatch = alert;
    
    // Rellenar ficha técnica en el modal
    modalAlertBrief.innerHTML = `
      <div class="brief-row">
        <span class="brief-label">ID Alerta:</span>
        <span class="brief-value highlight">${alert.id}</span>
      </div>
      <div class="brief-row">
        <span class="brief-label">Incidencia:</span>
        <span class="brief-value">${alert.type}</span>
      </div>
      <div class="brief-row">
        <span class="brief-label">Zona Geográfica:</span>
        <span class="brief-value">${alert.zone}</span>
      </div>
      <div class="brief-row">
        <span class="brief-label">Dispositivo emisor:</span>
        <span class="brief-value mono">${alert.esp32Id}</span>
      </div>
    `;

    document.getElementById("dispatch-notes").value = "";
    dispatchModal.classList.add("active");
  }

  function closeDispatchModal() {
    dispatchModal.classList.remove("active");
    currentAlertForDispatch = null;
  }

  btnCloseModal.addEventListener("click", closeDispatchModal);
  btnCancelDispatch.addEventListener("click", closeDispatchModal);

  dispatchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentAlertForDispatch) return;

    const unit = document.getElementById("select-unit").value;
    const notes = document.getElementById("dispatch-notes").value;

    appendSystemLog(`Asignando unidad ${unit} a la Alerta ${currentAlertForDispatch.id}`, "info");

    // 1. Cambiar estado en feed local
    feedManager.updateAlertStatus(currentAlertForDispatch.id, "DISPATCHED", unit);

    // 2. Cambiar estado en el mapa
    mapManager.updateMarkerStatus(currentAlertForDispatch.id, "DISPATCHED", currentAlertForDispatch.priority);

    // 3. Registrar en historial como "DISPATCHED" para persistencia intermedia
    historyManager.logIncident(currentAlertForDispatch, unit, notes, "DISPATCHED");

    closeDispatchModal();
    updateDashboardStats();
  });

  // Resolver alerta directamente (sin despacho previo o tras despacho)
  function resolveAlertDirectly(alert) {
    const unitAssigned = alert.unitDispatched || "UNIDAD CENTRAL";
    const notes = alert.notes || "Resuelto desde consola por operador.";

    appendSystemLog(`Resolviendo alerta ${alert.id} en zona: ${alert.zone}. Cerrando caso...`, "success");

    // 1. Guardar en base de datos permanente como RESOLVED
    historyManager.logIncident(alert, unitAssigned, notes, "RESOLVED");

    // 2. Remover de feed y mapa
    feedManager.removeAlert(alert.id);
    mapManager.removeAlertMarker(alert.id);

    updateDashboardStats();
  }

  // --------------------------------------------------------------------------
  // 5. RENDERIZADO DEL TABLERO DE HISTORIAL (TABLA TÁCTICA)
  // --------------------------------------------------------------------------
  
  const historyTableBody = document.getElementById("history-table-body");
  const tableEmptyState = document.getElementById("table-empty-state");
  const paginationInfo = document.getElementById("pagination-info");
  const btnPrevPage = document.getElementById("btn-prev-page");
  const btnNextPage = document.getElementById("btn-next-page");
  const pageNumbersContainer = document.getElementById("page-numbers-container");

  function renderHistoryTable() {
    const { items, totalCount, totalPages, startIndex, endIndex } = historyManager.getPaginatedData();

    historyTableBody.innerHTML = "";

    if (items.length === 0) {
      tableEmptyState.style.display = "flex";
      paginationInfo.textContent = "Mostrando registros 0-0 de 0";
      btnPrevPage.disabled = true;
      btnNextPage.disabled = true;
      pageNumbersContainer.innerHTML = "";
      return;
    }

    tableEmptyState.style.display = "none";

    // Llenar filas de la tabla
    items.forEach(item => {
      const tr = document.createElement("tr");
      
      const timestamp = new Date(item.timestamp);
      const timeStr = `${timestamp.toLocaleDateString('es-MX')} ${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;

      // Configurar badges de prioridad y estado
      const pClass = item.priority.toLowerCase();
      const sClass = item.status.toLowerCase();

      // Botones de acción contextuales en el historial
      let actionBtn = "";
      if (item.status === "DISPATCHED") {
        actionBtn = `
          <button class="btn btn-neon-blue btn-sm btn-table-resolve" data-id="${item.id}" title="Resolver Incidente Despachado">
            RESOLVER
          </button>
        `;
      } else {
        actionBtn = `
          <button class="btn btn-secondary btn-sm btn-table-locate" data-lat="${item.coordinates.lat}" data-lng="${item.coordinates.lng}" title="Localizar coordenadas">
            VER GPS
          </button>
        `;
      }

      tr.innerHTML = `
        <td class="cell-id">${item.id}</td>
        <td class="cell-time">${timeStr}</td>
        <td class="cell-esp32">${item.esp32Id}</td>
        <td>${item.zone}</td>
        <td class="cell-gps">${item.coordinates.lat}, ${item.coordinates.lng}</td>
        <td><span class="badge-priority ${pClass}">${item.priority}</span></td>
        <td><span class="badge-status ${sClass}">${item.status === 'DISPATCHED' ? 'RUTA' : item.status}</span></td>
        <td class="cell-time" style="font-weight: 600;">${item.responseMinutes !== null ? `${item.responseMinutes} min` : 'N/A'}</td>
        <td>${actionBtn}</td>
      `;

      historyTableBody.appendChild(tr);
    });

    // Vincular clicks dentro de la tabla
    bindTableActionEvents();

    // Actualizar controles de paginación
    paginationInfo.textContent = `Mostrando registros ${startIndex + 1}-${endIndex} de ${totalCount}`;
    btnPrevPage.disabled = historyManager.currentPage === 1;
    btnNextPage.disabled = historyManager.currentPage === totalPages;

    // Renderizar números de páginas
    pageNumbersContainer.innerHTML = "";
    for (let i = 1; i <= totalPages; i++) {
      const pageBtn = document.createElement("button");
      pageBtn.className = `btn-page ${historyManager.currentPage === i ? 'active' : ''}`;
      pageBtn.textContent = i;
      pageBtn.addEventListener("click", () => {
        historyManager.setPage(i);
        renderHistoryTable();
      });
      pageNumbersContainer.appendChild(pageBtn);
    }
  }

  function bindTableActionEvents() {
    // Botones de resolución en tabla
    document.querySelectorAll(".btn-table-resolve").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-id");
        // Buscar en las alertas activas del feed
        const alertObj = feedManager.activeAlerts.find(a => a.id === id);
        if (alertObj) {
          resolveAlertDirectly(alertObj);
        } else {
          // Si por alguna razón no está en el feed activo pero está en el historial
          const histObj = historyManager.history.find(h => h.id === id);
          if (histObj) {
            historyManager.logIncident(histObj, histObj.unitDispatched, "Resuelto desde tabla de auditoría.", "RESOLVED");
          }
        }
      });
    });

    // Botones de localización en mapa desde tabla
    document.querySelectorAll(".btn-table-locate").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const lat = +e.target.getAttribute("data-lat");
        const lng = +e.target.getAttribute("data-lng");
        mapManager.focusOnCoordinates(lat, lng, 14);
        appendSystemLog(`Enfocando mapa en ubicación histórica: ${lat}, ${lng}`, "info");
      });
    });
  }

  // Controles de Paginación en Tabla
  btnPrevPage.addEventListener("click", () => {
    if (historyManager.currentPage > 1) {
      historyManager.setPage(historyManager.currentPage - 1);
      renderHistoryTable();
    }
  });

  btnNextPage.addEventListener("click", () => {
    const { totalPages } = historyManager.getPaginatedData();
    if (historyManager.currentPage < totalPages) {
      historyManager.setPage(historyManager.currentPage + 1);
      renderHistoryTable();
    }
  });

  // Filtros por prioridad
  const filterButtons = {
    ALL: document.getElementById("filter-btn-all"),
    CRITICAL: document.getElementById("filter-btn-critical"),
    HIGH: document.getElementById("filter-btn-high"),
    MEDIUM: document.getElementById("filter-btn-medium")
  };

  Object.keys(filterButtons).forEach(key => {
    const btn = filterButtons[key];
    btn.addEventListener("click", () => {
      // Remover activos
      Object.values(filterButtons).forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      historyManager.setFilter(key);
      renderHistoryTable();
    });
  });

  // Caja de búsqueda en historial
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    historyManager.setSearch(e.target.value);
    renderHistoryTable();
  });

  // Botón Limpiar Historial
  const btnClearHistory = document.getElementById("btn-clear-history");
  btnClearHistory.addEventListener("click", () => {
    if (confirm("¿Confirmar limpieza completa del historial de incidentes? (Esta acción vaciará el almacenamiento local)")) {
      historyManager.clearAll();
    }
  });

  // Centrar mapa de manera manual
  const btnCenterMap = document.getElementById("btn-center-map");
  btnCenterMap.addEventListener("click", () => {
    mapManager.fitAllMarkers();
    appendSystemLog("Cámara del mapa táctico alineada globalmente.", "info");
  });

  // --------------------------------------------------------------------------
  // 6. RELOJ DIGITAL Y RENDER INICIAL DE TABLA
  // --------------------------------------------------------------------------
  
  function updateDigitalClock() {
    const clockElement = document.getElementById("digital-clock");
    const dateElement = document.getElementById("digital-date");
    if (!clockElement || !dateElement) return;

    const now = new Date();
    
    // Formatear hora
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    clockElement.textContent = timeStr;

    // Formatear fecha
    const months = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
    const dateStr = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
    dateElement.textContent = dateStr;
  }

  // Actualizar reloj cada segundo
  setInterval(updateDigitalClock, 1000);
  updateDigitalClock();

  // Primer renderizado de la tabla histórica al iniciar
  renderHistoryTable();
  updateDashboardStats();
  
  // Registrar inicio exitoso
  appendSystemLog("Centro de Comando C5 cargado e inicializado. Todos los sistemas estables.", "success");
});
