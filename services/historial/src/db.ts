import { PrismaClient } from '@prisma/client';
import { readReplicas } from '@prisma/extension-read-replicas';

// Instanciamos el cliente normal, que usará DATABASE_URL por defecto para escrituras
const prismaClient = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

// Extendemos el cliente para que use la réplica para lecturas
const prisma = prismaClient.$extends(
  readReplicas({
    url: process.env.REPLICA_URL as string,
  })
);

export default prisma;
