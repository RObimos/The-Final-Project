import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pinoHttp from 'pino-http';

import { logger } from './logger.js';
import { pool, query, waitForDatabase } from './db.js';
import { migrate } from './migrate.js';
import { seed } from './seed.js';
import { injectUser } from './middleware/auth.js';

import { authRouter } from './routes/auth.js';
import { matchesRouter } from './routes/matches.js';
import { leaderboardRouter } from './routes/leaderboard.js';
import { leaguesRouter } from './routes/leagues.js';
import { adminRouter } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);

// Derrière le reverse proxy de Coolify (Traefik) : nécessaire pour les cookies sécurisés.
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Logs HTTP structurés (chaque requête est tracée en JSON sur stdout).
app.use(pinoHttp({ logger }));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// --- Supervision : endpoint de health check ---
// Utilisé par Coolify (Health Check) et/ou Uptime Kuma.
// Renvoie 200 si l'app répond ET que la base est joignable, sinon 503.
app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.status(200).json({ status: 'ok', db: 'up', time: new Date().toISOString() });
  } catch (err) {
    req.log.error({ err }, 'Health check KO : base injoignable');
    res.status(503).json({ status: 'degraded', db: 'down' });
  }
});

// --- Sessions stockées en base PostgreSQL ---
const PgStore = connectPgSimple(session);
app.use(
  session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'change-me-en-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 jours
    },
  })
);

app.use(injectUser);

// --- Routes ---
app.use('/', authRouter);
app.use('/', matchesRouter);
app.use('/', leaderboardRouter);
app.use('/', leaguesRouter);
app.use('/', adminRouter);

// 404
app.use((req, res) => {
  res.status(404).render('error', {
    title: 'Page introuvable',
    message: "Cette page n'existe pas.",
  });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  (req.log || logger).error({ err }, 'Erreur non gérée');
  res.status(500).render('error', {
    title: 'Erreur serveur',
    message: 'Une erreur inattendue est survenue.',
  });
});

async function start() {
  try {
    await waitForDatabase();
    await migrate();
    await seed();
    app.listen(PORT, () => {
      logger.info({ port: PORT }, 'Serveur démarré');
    });
  } catch (err) {
    logger.fatal({ err }, 'Échec du démarrage');
    process.exit(1);
  }
}

// Arrêt propre (utile pour les redéploiements Coolify)
process.on('SIGTERM', async () => {
  logger.info('SIGTERM reçu, arrêt en cours…');
  await pool.end().catch(() => {});
  process.exit(0);
});

start();
