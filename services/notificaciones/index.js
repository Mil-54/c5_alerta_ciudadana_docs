const WebSocket = require('ws');
const Redis = require('ioredis');

const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || 'redis';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);
const REDIS_QUEUE = process.env.REDIS_QUEUE || 'alertas:priorizadas';
const REDIS_CHANNEL = 'c5:alertas:broadcast';

const REPLICA_ID = process.env.HOSTNAME || `replica-${Math.random().toString(36).substring(2, 9)}`;

console.log(`[${REPLICA_ID}] [Config] Puerto WebSocket: ${PORT}`);
console.log(`[${REPLICA_ID}] [Config] Redis Host: ${REDIS_HOST}:${REDIS_PORT}`);
console.log(`[${REPLICA_ID}] [Config] Cola de Redis: ${REDIS_QUEUE}`);
console.log(`[${REPLICA_ID}] [Config] Canal de Difusión: ${REDIS_CHANNEL}`);

//Servidor WebSocket local de esta réplica
const wss = new WebSocket.Server({ port: PORT });
const clients = new Set();

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[${REPLICA_ID}] [WebSocket] Cliente conectado desde IP: ${ip}`);
  clients.add(ws);

  ws.on('close', () => {
    console.log(`[${REPLICA_ID}] [WebSocket] Cliente desconectado (IP: ${ip})`);
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error(`[${REPLICA_ID}] [WebSocket] Error en cliente (IP: ${ip}):`, err);
    clients.delete(ws);
  });

  ws.send(JSON.stringify({
    type: 'system',
    message: 'Conectado exitosamente al centro de notificaciones C5',
    replica: REPLICA_ID
  }));
});

function broadcastToLocalClients(alertData) {
  const payload = JSON.stringify({
    type: 'alerta',
    data: alertData,
    timestamp: new Date().toISOString(),
    broadcastBy: REPLICA_ID
  });

  console.log(`[${REPLICA_ID}] [WebSocket] Difundiendo alerta a ${clients.size} cliente(s) local(es)`);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

const redisClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null
});

const redisSub = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null
});

redisClient.on('connect', () => {
  console.log(`[${REPLICA_ID}] [Redis] Cliente principal conectado.`);
});

redisSub.on('connect', () => {
  console.log(`[${REPLICA_ID}] [Redis] Cliente suscriptor conectado.`);
  redisSub.subscribe(REDIS_CHANNEL, (err, count) => {
    if (err) {
      console.error(`[${REPLICA_ID}] [Redis] Error al suscribirse al canal:`, err);
    } else {
      console.log(`[${REPLICA_ID}] [Redis] Suscrito con éxito al canal "${REDIS_CHANNEL}" (${count} canales activos).`);
    }
  });
});

redisSub.on('message', (channel, message) => {
  if (channel === REDIS_CHANNEL) {
    console.log(`[${REPLICA_ID}] [Redis Pub/Sub] Recibido mensaje en canal: ${message}`);
    try {
      const alertObj = JSON.parse(message);
      broadcastToLocalClients(alertObj);
    } catch (err) {
      console.warn(`[${REPLICA_ID}] [Redis Pub/Sub] Mensaje recibido no es un JSON válido:`, err.message);
      broadcastToLocalClients({ raw: message });
    }
  }
});

redisClient.on('error', (err) => console.error(`[${REPLICA_ID}] [Redis Client] Error:`, err.message));
redisSub.on('error', (err) => console.error(`[${REPLICA_ID}] [Redis Sub] Error:`, err.message));

let running = true;

async function consumeQueue() {
  console.log(`[${REPLICA_ID}] [Worker] Iniciando bucle de consumo de cola (BRPOP)...`);

  while (running) {
    try {

      const result = await redisClient.brpop(REDIS_QUEUE, 5);

      if (result) {
        const [_, value] = result;
        console.log(`[${REPLICA_ID}] [Worker] Alerta extraída de la cola. Publicando en canal de difusión...`);

        await redisClient.publish(REDIS_CHANNEL, value);
      }
    } catch (err) {
      console.error(`[${REPLICA_ID}] [Worker] Error en bucle de consumo:`, err.message);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`[${REPLICA_ID}] [Worker] Bucle de consumo detenido.`);
}

consumeQueue();

const interval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.CLOSED) {
      clients.delete(ws);
      return;
    }
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(interval);
});

function shutdown(signal) {
  console.log(`[${REPLICA_ID}] [Shutdown] Recibida señal ${signal}. Apagando ordenadamente...`);
  running = false;

  wss.close(() => {
    console.log(`[${REPLICA_ID}] [Shutdown] Servidor WebSocket cerrado.`);

    Promise.all([redisClient.quit(), redisSub.quit()])
      .then(() => {
        console.log(`[${REPLICA_ID}] [Shutdown] Conexiones a Redis cerradas limpiamente.`);
        process.exit(0);
      })
      .catch((err) => {
        console.error(`[${REPLICA_ID}] [Shutdown] Error al cerrar conexiones de Redis:`, err);
        process.exit(1);
      });
  });

  setTimeout(() => {
    console.error(`[${REPLICA_ID}] [Shutdown] Apagado forzado.`);
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
