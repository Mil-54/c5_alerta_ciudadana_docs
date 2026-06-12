/**
 * CHART.JS DASHBOARD ANALYTICS WRAPPER
 * Draws neon-accented charts (incident flow and priority distribution).
 */

export class TacticalChartsManager {
  constructor(incidentCanvasId = "incident-chart", priorityCanvasId = "priority-chart") {
    this.incidentCanvasId = incidentCanvasId;
    this.priorityCanvasId = priorityCanvasId;
    this.incidentChart = null;
    this.priorityChart = null;
    
    this.init();
  }

  /**
   * Inicializa ambos gráficos con configuraciones globales de estilo futurista
   */
  init() {
    // Configuración global de fuentes de Chart.js para acoplarse a Orbitron y Rajdhani
    Chart.defaults.font.family = "'Rajdhani', 'Share Tech Mono', sans-serif";
    Chart.defaults.color = "#90a0b5";
    Chart.defaults.borderColor = "rgba(255, 255, 255, 0.05)";

    this.initIncidentChart();
    this.initPriorityChart();
  }

  /**
   * Crea el gráfico lineal de flujo de incidentes
   */
  initIncidentChart() {
    const ctx = document.getElementById(this.incidentCanvasId).getContext('2d');
    
    // Crear degradados para la línea y el relleno neón
    const lineGradient = ctx.createLinearGradient(0, 0, 0, 100);
    lineGradient.addColorStop(0, 'rgba(0, 229, 255, 1)'); // Cyan Neón
    lineGradient.addColorStop(1, 'rgba(0, 229, 255, 0.4)');

    const fillGradient = ctx.createLinearGradient(0, 0, 0, 80);
    fillGradient.addColorStop(0, 'rgba(0, 229, 255, 0.18)');
    fillGradient.addColorStop(1, 'rgba(0, 229, 255, 0.0)');

    this.incidentChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
        datasets: [{
          label: 'Incidentes',
          data: [2, 5, 3, 7, 4, 3],
          borderColor: lineGradient,
          borderWidth: 2,
          pointBackgroundColor: '#00e5ff',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1,
          pointRadius: 3,
          pointHoverRadius: 5,
          fill: true,
          backgroundColor: fillGradient,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0b0f17',
            titleColor: '#00e5ff',
            bodyColor: '#f0f4f9',
            borderColor: 'rgba(0, 229, 255, 0.3)',
            borderWidth: 1,
            displayColors: false,
            callbacks: {
              label: (context) => `Alertas: ${context.parsed.y}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 } }
          },
          y: {
            min: 0,
            suggestedMax: 10,
            ticks: {
              stepSize: 2,
              font: { size: 10 }
            },
            grid: {
              color: 'rgba(255, 255, 255, 0.03)'
            }
          }
        }
      }
    });
  }

  /**
   * Crea el gráfico circular de prioridades
   */
  initPriorityChart() {
    const ctx = document.getElementById(this.priorityCanvasId).getContext('2d');

    this.priorityChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['CRÍTICA', 'ALTA', 'MEDIA'],
        datasets: [{
          data: [0, 0, 0],
          backgroundColor: [
            'rgba(255, 49, 49, 0.85)',   // Rojo Neón
            'rgba(255, 184, 0, 0.85)',  // Amarillo Neón
            'rgba(0, 229, 255, 0.85)'   // Azul Neón
          ],
          borderColor: '#0b0f17',
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 8,
              font: { size: 9, weight: '600' },
              padding: 10
            }
          },
          tooltip: {
            backgroundColor: '#0b0f17',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1
          }
        }
      }
    });
  }

  /**
   * Actualiza el gráfico con las alertas actuales en tiempo real e históricos
   * @param {Array} historyList - Lista de incidentes históricos
   * @param {Array} activeList - Lista de alertas activas en pantalla
   */
  updateCharts(historyList, activeList) {
    if (!this.incidentChart || !this.priorityChart) return;

    // 1. Recopilar métricas de prioridad (combinando activos e históricos)
    const combined = [...activeList, ...historyList];
    const criticalCount = combined.filter(a => a.priority === "CRITICAL").length;
    const highCount = combined.filter(a => a.priority === "HIGH").length;
    const mediumCount = combined.filter(a => a.priority === "MEDIUM").length;

    this.priorityChart.data.datasets[0].data = [criticalCount, highCount, mediumCount];
    this.priorityChart.update();

    // 2. Simular flujo de incidentes por hora (usando timestamps reales de los datos)
    // Agrupamos en las últimas 6 horas
    const now = new Date();
    const hoursLabels = [];
    const hourlyCounts = [0, 0, 0, 0, 0, 0];

    for (let i = 5; i >= 0; i--) {
      const h = new Date(now.getTime() - i * 3600000);
      const hourStr = `${h.getHours().toString().padStart(2, '0')}:00`;
      hoursLabels.push(hourStr);
    }

    combined.forEach(incident => {
      const incTime = new Date(incident.timestamp);
      const diffMs = now - incTime;
      const diffHours = Math.floor(diffMs / 3600000);
      if (diffHours >= 0 && diffHours < 6) {
        // Mapea al dataset (5 - diffHours es la posición correspondiente al label)
        hourlyCounts[5 - diffHours]++;
      }
    });

    // Actualizar labels e incidentes por hora
    this.incidentChart.data.labels = hoursLabels;
    this.incidentChart.data.datasets[0].data = hourlyCounts;
    this.incidentChart.update();

    // Actualizar contador rápido de flujo en el HUD de la tarjeta
    const totalLastHour = hourlyCounts[5];
    const hourlyCountElement = document.getElementById("hourly-count");
    if (hourlyCountElement) {
      hourlyCountElement.textContent = `${totalLastHour}/h`;
    }
  }
}
