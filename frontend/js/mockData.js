/**
 * MOCK DATA GENERATOR FOR C5 TACTICAL DASHBOARD
 * Provides CDMX coordinates, ESP32 schemas, and mock alert builders.
 */

// Ubicaciones geográficas de referencia en la Ciudad de México para simular alertas
export const ZONES = [
  { name: "Centro Histórico (Sector Central)", lat: 19.4326, lng: -99.1332 },
  { name: "Polanco-Reforma (Sector Poniente)", lat: 19.4310, lng: -99.1910 },
  { name: "Iztapalapa Sur (Sector Oriente)", lat: 19.3580, lng: -99.0750 },
  { name: "Coyoacán Centro (Sector Sur)", lat: 19.3495, lng: -99.1620 },
  { name: "Roma-Condesa (Sector Central)", lat: 19.4150, lng: -99.1670 },
  { name: "Tlalpan Bosques (Sector Sur-Poniente)", lat: 19.2890, lng: -99.1740 },
  { name: "Gustavo A. Madero (Sector Norte)", lat: 19.4820, lng: -99.1150 },
  { name: "Santa Fe Financiero (Sector Poniente)", lat: 19.3610, lng: -99.2650 },
  { name: "Tlatelolco Nonoalco (Sector Central-Norte)", lat: 19.4510, lng: -99.1420 },
  { name: "Xochimilco Embarcaderos (Sector Sur-Oriente)", lat: 19.2560, lng: -99.1020 }
];

export const INCIDENT_TYPES = [
  { title: "Botón de Pánico Activado", priority: "CRITICAL" },
  { title: "Sensor de Impacto Vehicular", priority: "HIGH" },
  { title: "Fuga de Gas Detectada", priority: "CRITICAL" },
  { title: "Alerta de Incendio (Humo)", priority: "CRITICAL" },
  { title: "Asistencia Médica Solicitada", priority: "MEDIUM" },
  { title: "Falla de Fluido Eléctrico Sectorial", priority: "MEDIUM" },
  { title: "Intrusión de Perímetro Seguro", priority: "HIGH" },
  { title: "Alteración de Orden Público", priority: "MEDIUM" }
];

// Generador de ID hexadecimal corto único
export function generateId() {
  return "ALT-" + Math.floor(100000 + Math.random() * 900000).toString(16).toUpperCase();
}

// Generador de IDs de dispositivos emisores ESP32
export function generateESP32Id() {
  const hex = "0123456789ABCDEF";
  let mac = "";
  for (let i = 0; i < 4; i++) {
    mac += hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
  }
  return `ESP32-CDMX-${mac}`;
}

// Generar una alerta aleatoria estructurada en JSON
export function createMockAlert(forcedPriority = null) {
  const zone = ZONES[Math.floor(Math.random() * ZONES.length)];
  const incident = INCIDENT_TYPES[Math.floor(Math.random() * INCIDENT_TYPES.length)];
  
  // Agregar una pequeña desviación aleatoria a las coordenadas para que no caigan siempre en el mismo punto exacto
  const offsetLat = (Math.random() - 0.5) * 0.015;
  const offsetLng = (Math.random() - 0.5) * 0.015;
  
  const priority = forcedPriority || incident.priority;
  
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    esp32Id: generateESP32Id(),
    type: incident.title,
    priority: priority,
    zone: zone.name,
    coordinates: {
      lat: +(zone.lat + offsetLat).toFixed(5),
      lng: +(zone.lng + offsetLng).toFixed(5)
    },
    status: "ACTIVE", // ACTIVE | DISPATCHED | RESOLVED
    unitDispatched: null,
    notes: ""
  };
}

// Historial inicial para pre-sembrar la base de datos (Persistencia)
export const INITIAL_HISTORY = [
  {
    id: "ALT-DF721A",
    timestamp: new Date(Date.now() - 3600000 * 4.5).toISOString(), // Hace 4.5 horas
    esp32Id: "ESP32-CDMX-A1B2",
    type: "Botón de Pánico Activado",
    priority: "CRITICAL",
    zone: "Centro Histórico (Sector Central)",
    coordinates: { lat: 19.4326, lng: -99.1332 },
    status: "RESOLVED",
    unitDispatched: "SECTOR-01",
    resolvedAt: new Date(Date.now() - 3600000 * 4.4).toISOString(), // Resuelta en 6 min
    responseMinutes: 6.0,
    notes: "Falsa alarma. Ciudadano presionó el botón accidentalmente. Unidad verificó zona."
  },
  {
    id: "ALT-B8F09D",
    timestamp: new Date(Date.now() - 3600000 * 3.2).toISOString(), // Hace 3.2 horas
    esp32Id: "ESP32-CDMX-8E4C",
    type: "Sensor de Impacto Vehicular",
    priority: "HIGH",
    zone: "Polanco-Reforma (Sector Poniente)",
    coordinates: { lat: 19.4290, lng: -99.1850 },
    status: "RESOLVED",
    unitDispatched: "TACTICAL-09",
    resolvedAt: new Date(Date.now() - 3600000 * 3.1).toISOString(), // Resuelta en 6 min
    responseMinutes: 4.5,
    notes: "Colisión vial menor en cruce de semáforo. Unidad coordinó con Tránsito y seguros."
  },
  {
    id: "ALT-C51B28",
    timestamp: new Date(Date.now() - 3600000 * 2.1).toISOString(), // Hace 2.1 horas
    esp32Id: "ESP32-CDMX-F39A",
    type: "Asistencia Médica Solicitada",
    priority: "MEDIUM",
    zone: "Coyoacán Centro (Sector Sur)",
    coordinates: { lat: 19.3480, lng: -99.1610 },
    status: "RESOLVED",
    unitDispatched: "MEDIC-02",
    resolvedAt: new Date(Date.now() - 3600000 * 2.0).toISOString(),
    responseMinutes: 8.2,
    notes: "Adulto mayor con síntomas de deshidratación. Atendido en ambulancia. Estable."
  },
  {
    id: "ALT-A9E012",
    timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(), // Hace 1.5 horas
    esp32Id: "ESP32-CDMX-4D6F",
    type: "Alerta de Incendio (Humo)",
    priority: "CRITICAL",
    zone: "Iztapalapa Sur (Sector Oriente)",
    coordinates: { lat: 19.3560, lng: -99.0790 },
    status: "RESOLVED",
    unitDispatched: "FIRE-01",
    resolvedAt: new Date(Date.now() - 3600000 * 1.35).toISOString(),
    responseMinutes: 9.0,
    notes: "Incendio en contenedor de basura industrial. Bomberos sofocaron el siniestro. Sin heridos."
  },
  {
    id: "ALT-39F2EA",
    timestamp: new Date(Date.now() - 3600000 * 0.8).toISOString(), // Hace 48 min
    esp32Id: "ESP32-CDMX-BC84",
    type: "Alteración de Orden Público",
    priority: "MEDIUM",
    zone: "Roma-Condesa (Sector Central)",
    coordinates: { lat: 19.4170, lng: -99.1690 },
    status: "RESOLVED",
    unitDispatched: "SECTOR-04",
    resolvedAt: new Date(Date.now() - 3600000 * 0.72).toISOString(),
    responseMinutes: 4.8,
    notes: "Ruido excesivo y riña verbal en vía pública. Dispersados tras llegada de patrulla."
  }
];
