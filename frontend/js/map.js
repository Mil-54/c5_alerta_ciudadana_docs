/**
 * LEAFLET.JS TACTICAL MAP WRAPPER
 * Manages the dark tiles, custom CSS divIcons, neon pulsing markers, and camera transitions.
 */

export class TacticalMapManager {
  constructor(elementId = "tactical-map") {
    this.elementId = elementId;
    this.map = null;
    this.markers = new Map(); // Llave: alertId, Valor: L.marker
    this.defaultCenter = [19.4326, -99.1332]; // CDMX Centro
    this.defaultZoom = 12;
    
    this.init();
  }

  /**
   * Inicializa el mapa con tema oscuro y controles desactivados por defecto para HUD limpio
   */
  init() {
    try {
      this.map = L.map(this.elementId, {
        zoomControl: true,
        attributionControl: false,
        fadeAnimation: true
      }).setView(this.defaultCenter, this.defaultZoom);

      // Proveedor de Mapas Tácticos Oscuros: CartoDB Dark Matter
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        subdomains: 'abcd'
      }).addTo(this.map);

      // Escuchar cambios de vista para reportar al HUD
      this.map.on('moveend', () => {
        const center = this.map.getCenter();
        const coordsText = `MONITOR: ${center.lat.toFixed(4)}° N, ${center.lng.toFixed(4)}° W`;
        const hudElement = document.getElementById("current-map-view");
        if (hudElement) {
          hudElement.textContent = coordsText;
        }
      });

    } catch (err) {
      console.error("Falla al inicializar Leaflet Map: ", err);
    }
  }

  /**
   * Crea un marcador personalizado neón con animaciones CSS
   * @param {Object} alert - Datos de la alerta
   */
  addAlertMarker(alert) {
    if (!this.map) return;
    
    // Si ya existe, no duplicarlo
    if (this.markers.has(alert.id)) {
      this.updateMarkerStatus(alert.id, alert.status, alert.priority);
      return;
    }

    const priorityClass = alert.priority.toLowerCase(); // critical, high, medium
    
    // Crear el contenedor HTML del marcador con sus círculos de pulso @keyframes
    const markerHtml = `
      <div class="marker-pulse"></div>
      <div class="marker-pin"></div>
    `;

    const customIcon = L.divIcon({
      className: `custom-leaflet-marker marker-${priorityClass}`,
      html: markerHtml,
      iconSize: [20, 20],
      iconAnchor: [10, 10] // Anclar el centro del círculo
    });

    const marker = L.marker([alert.coordinates.lat, alert.coordinates.lng], {
      icon: customIcon
    }).addTo(this.map);

    // Contenido del Popup Táctico
    const popupContent = `
      <div class="tactical-popup border-${priorityClass}">
        <div class="popup-title">ALERTA REGISTRADA</div>
        <div class="popup-id">${alert.id}</div>
        <hr style="border: 0; border-top: 1px solid rgba(255,255,255,0.1); margin: 6px 0;">
        <div class="popup-detail"><strong>DISPOSITIVO:</strong> ${alert.esp32Id}</div>
        <div class="popup-detail"><strong>EVENTO:</strong> ${alert.type}</div>
        <div class="popup-detail"><strong>ZONA:</strong> ${alert.zone}</div>
        <div class="popup-status">ESTADO: <span class="status-${alert.status.toLowerCase()}">${alert.status}</span></div>
      </div>
    `;

    marker.bindPopup(popupContent, {
      className: `tactical-popup-container popup-${priorityClass}`,
      closeButton: false,
      offset: L.point(0, -6)
    });

    // Guardar referencia
    this.markers.set(alert.id, marker);

    // Ajustar vista levemente si es una alerta crítica
    if (alert.priority === "CRITICAL") {
      this.focusOnCoordinates(alert.coordinates.lat, alert.coordinates.lng, 13);
    }
  }

  /**
   * Actualiza el estado visual del marcador cuando se despacha o resuelve
   */
  updateMarkerStatus(alertId, newStatus, priority) {
    const marker = this.markers.get(alertId);
    if (!marker) return;

    const priorityClass = priority.toLowerCase();
    
    // Actualizar contenido del Popup
    const alertData = marker.alertData; // Podemos recuperarlo si lo guardamos
    const popup = marker.getPopup();
    if (popup) {
      // Re-vincular popup actualizado
      const content = popup.getContent();
      const updatedContent = content.replace(
        /ESTADO: <span class="status-.*?">.*?<\/span>/, 
        `ESTADO: <span class="status-${newStatus.toLowerCase()}">${newStatus}</span>`
      );
      marker.setPopupContent(updatedContent);
    }
  }

  /**
   * Elimina un marcador del mapa al ser resuelta la alerta
   */
  removeAlertMarker(alertId) {
    const marker = this.markers.get(alertId);
    if (marker) {
      this.map.removeLayer(marker);
      this.markers.delete(alertId);
    }
  }

  /**
   * Enfoca la cámara en un marcador específico y abre su Popup informativo
   */
  focusOnAlert(alert) {
    const marker = this.markers.get(alert.id);
    if (marker) {
      this.map.setView([alert.coordinates.lat, alert.coordinates.lng], 14, {
        animate: true,
        duration: 1.0
      });
      setTimeout(() => {
        marker.openPopup();
      }, 500);
    }
  }

  /**
   * Enfoca directamente en coordenadas dadas
   */
  focusOnCoordinates(lat, lng, zoom = 14) {
    if (!this.map) return;
    this.map.setView([lat, lng], zoom, {
      animate: true,
      duration: 1.2
    });
  }

  /**
   * Centra el mapa encuadrando todos los marcadores activos, o regresa al default
   */
  fitAllMarkers() {
    if (!this.map) return;
    
    if (this.markers.size === 0) {
      this.map.setView(this.defaultCenter, this.defaultZoom, { animate: true });
      return;
    }

    const group = L.featureGroup(Array.from(this.markers.values()));
    this.map.fitBounds(group.getBounds().pad(0.25), {
      animate: true,
      duration: 1.0
    });
  }
}
