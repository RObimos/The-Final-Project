import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

// Coolify / Docker fournissent en général une DATABASE_URL.
// On accepte aussi les variables PG* séparées pour plus de souplesse.
const connectionString = process.env.DATABASE_URL;

export const pool = new Pool(
  connectionString
    ? { connectionString }
    : {
        host: process.env.PGHOST || 'db',
        port: Number(process.env.PGPORT || 5432),
        user: process.env.PGUSER || 'pronos',
        password: process.env.PGPASSWORD || 'pronos',
        database: process.env.PGDATABASE || 'pronos',
      }
);

pool.on('error', (err) => {
  logger.error({ err }, 'Erreur inattendue sur le pool PostgreSQL');
});

export async function query(text, params) {
  return pool.query(text, params);
}

// Tente de se connecter avec quelques essais : au démarrage du conteneur,
// la base n'est pas toujours prête immédiatement.
export async function waitForDatabase(retries = 15, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await pool.query('SELECT 1');
      logger.info('Connexion à la base de données établie');
      return;
    } catch (err) {
      logger.warn(
        { tentative: i, max: retries },
        'Base de données pas encore disponible, nouvelle tentative…'
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error("Impossible de se connecter à la base de données après plusieurs tentatives");
}
