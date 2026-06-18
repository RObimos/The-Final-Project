import pino from 'pino';

// Logs JSON structurés envoyés sur stdout.
// C'est le standard "cloud native" : Coolify / Docker capturent stdout,
// ce qui rend les logs consultables directement depuis l'interface Coolify
// (ou via `docker logs`).
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { app: 'pronostics-cdm-2026' },
  timestamp: pino.stdTimeFunctions.isoTime,
});
