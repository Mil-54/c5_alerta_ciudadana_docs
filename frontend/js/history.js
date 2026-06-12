/**
 * INCIDENT HISTORY AND PERSISTENCE MANAGER
 * Handles localStorage database, text query matching, priority filters, and pagination.
 */

import { INITIAL_HISTORY } from './mockData.js';

export class IncidentHistoryManager {
  constructor(options = {}) {
    this.storageKey = "c5_alerts_history";
    this.history = [];
    this.itemsPerPage = 5;
    this.currentPage = 1;
    this.currentFilter = "ALL";
    this.currentSearch = "";
    
    this.onHistoryUpdated = options.onHistoryUpdated || (() => {});
    this.onLogCallback = options.onLog || (() => {});
    
    this.init();
  }

  /**
   * Inicializa la carga de datos del almacenamiento local o pre-siembra
   */
  init() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.history = JSON.parse(stored);
        this.log(`Base de datos de historial cargada: ${this.history.length} registros.`, "success");
      } else {
        // Sembrar historial predefinido
        this.history = [...INITIAL_HISTORY];
        this.save();
        this.log("Historial inicial sembrado y guardado en almacenamiento local.", "info");
      }
    } catch (err) {
      this.log("Falla de acceso a localStorage. Operando en memoria temporal: " + err.message, "danger");
      this.history = [...INITIAL_HISTORY];
    }
  }

  /**
   * Guarda los registros actuales en el localStorage
   */
  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.history));
    } catch (err) {
      console.error("Error al guardar historial:", err);
    }
    this.onHistoryUpdated(this.history);
  }

  /**
   * Registra una nueva alerta resuelta o unidad despachada en el historial permanente
   * @param {Object} alert - Objeto de alerta activa
   * @param {string} unit - Unidad asignada
   * @param {string} notes - Notas del despacho
   * @param {string} status - Nuevo estado ("RESOLVED" | "DISPATCHED")
   */
  logIncident(alert, unit, notes, status = "RESOLVED") {
    // Si ya existe en el historial (por ejemplo, pasó de DISPATCHED a RESOLVED), lo actualizamos
    const existingIndex = this.history.findIndex(item => item.id === alert.id);
    
    const timestamp = new Date();
    const alertTime = new Date(alert.timestamp);
    const responseMinutes = +((timestamp - alertTime) / 60000).toFixed(1); // Minutos transcurridos

    const incidentRecord = {
      ...alert,
      status: status,
      unitDispatched: unit,
      notes: notes,
      resolvedAt: status === "RESOLVED" ? timestamp.toISOString() : null,
      responseMinutes: status === "RESOLVED" ? responseMinutes : null
    };

    if (existingIndex > -1) {
      // Si pasa a resuelta, mantenemos la unidad anterior si no se redefine
      if (!unit && this.history[existingIndex].unitDispatched) {
        incidentRecord.unitDispatched = this.history[existingIndex].unitDispatched;
      }
      this.history[existingIndex] = { ...this.history[existingIndex], ...incidentRecord };
      this.log(`Registro de incidente actualizado en historial: ${alert.id} (${status})`, "success");
    } else {
      // Insertar al inicio de la lista
      this.history.unshift(incidentRecord);
      this.log(`Incidente registrado en base de datos: ${alert.id} (${status})`, "success");
    }

    this.save();
  }

  /**
   * Elimina todos los registros de la base de datos local
   */
  clearAll() {
    this.history = [];
    this.save();
    this.log("Historial de incidentes vaciado por el operador.", "warning");
  }

  /**
   * Obtiene la flota activa y estadísticas agregadas basadas en el historial
   */
  getStats() {
    const activeResolved = this.history.filter(item => item.status === "RESOLVED");
    
    // Calcular promedio de respuesta en minutos
    let avgResponse = 0;
    let validTimes = activeResolved.filter(item => item.responseMinutes !== null);
    if (validTimes.length > 0) {
      const sum = validTimes.reduce((acc, item) => acc + item.responseMinutes, 0);
      avgResponse = +(sum / validTimes.length).toFixed(1);
    } else {
      avgResponse = 4.2; // Resp. base
    }

    // Contar por prioridad en historial
    const counts = {
      CRITICAL: this.history.filter(item => item.priority === "CRITICAL").length,
      HIGH: this.history.filter(item => item.priority === "HIGH").length,
      MEDIUM: this.history.filter(item => item.priority === "MEDIUM").length
    };

    return {
      averageResponseTime: avgResponse,
      priorityCounts: counts,
      totalIncidents: this.history.length
    };
  }

  /**
   * Filtra y pagina los registros del historial
   */
  getPaginatedData() {
    // 1. Filtrar por Prioridad
    let filtered = this.history;
    if (this.currentFilter !== "ALL") {
      filtered = filtered.filter(item => item.priority === this.currentFilter);
    }

    // 2. Filtrar por búsqueda de texto (Case Insensitive)
    if (this.currentSearch.trim() !== "") {
      const query = this.currentSearch.toLowerCase();
      filtered = filtered.filter(item => 
        item.id.toLowerCase().includes(query) ||
        item.esp32Id.toLowerCase().includes(query) ||
        item.zone.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query) ||
        (item.unitDispatched && item.unitDispatched.toLowerCase().includes(query))
      );
    }

    // 3. Paginar resultados
    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / this.itemsPerPage) || 1;
    
    // Validar rango de página
    if (this.currentPage > totalPages) {
      this.currentPage = totalPages;
    }
    if (this.currentPage < 1) {
      this.currentPage = 1;
    }

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const items = filtered.slice(startIndex, startIndex + this.itemsPerPage);

    return {
      items,
      totalCount,
      totalPages,
      startIndex,
      endIndex: Math.min(startIndex + items.length, totalCount)
    };
  }

  /**
   * Modifica filtros
   */
  setFilter(priority) {
    this.currentFilter = priority;
    this.currentPage = 1;
  }

  setSearch(query) {
    this.currentSearch = query;
    this.currentPage = 1;
  }

  setPage(pageNumber) {
    this.currentPage = pageNumber;
  }

  /**
   * Logger local
   */
  log(message, type = "info") {
    this.onLogCallback(message, type);
  }
}
