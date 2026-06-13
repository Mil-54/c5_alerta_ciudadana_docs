import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './db';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// POST /api/incidents - Recibe datos vía REST (desde el MS de Prioridad) y guarda el incidente
app.post('/api/incidents', async (req: Request, res: Response) => {
  try {
    const { zone, priority, description, date } = req.body;

    // Validación básica
    if (!zone || !priority || !description) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: zone, priority, description' });
    }

    // Esta operación POST utilizará automáticamente la conexión primaria (DATABASE_URL)
    const newIncident = await prisma.incident.create({
      data: {
        zone,
        priority,
        description,
        date: date ? new Date(date) : new Date(),
      },
    });

    res.status(201).json({ message: 'Incidente guardado correctamente', data: newIncident });
  } catch (error) {
    console.error('Error guardando incidente:', error);
    res.status(500).json({ error: 'Error interno del servidor al guardar el incidente' });
  }
});

// GET /api/incidents - Filtra el historial por fechas, zona o prioridad
app.get('/api/incidents', async (req: Request, res: Response) => {
  try {
    const { zone, priority, startDate, endDate } = req.query;

    const where: any = {};

    if (zone) {
      where.zone = String(zone);
    }

    if (priority) {
      where.priority = String(priority);
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(String(startDate));
      if (endDate) where.date.lte = new Date(String(endDate));
    }

    // Esta operación GET utilizará automáticamente la conexión réplica (REPLICA_URL) gracias a la extensión
    const incidents = await prisma.incident.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    res.status(200).json({ data: incidents });
  } catch (error) {
    console.error('Error obteniendo incidentes:', error);
    res.status(500).json({ error: 'Error interno del servidor al obtener el historial' });
  }
});

app.listen(port, () => {
  console.log(`Servidor "El Archivista" ejecutándose en http://localhost:${port}`);
});
