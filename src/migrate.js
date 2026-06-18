import { query } from './db.js';
import { logger } from './logger.js';

// Création des tables si elles n'existent pas (idempotent).
// Exécuté à chaque démarrage du conteneur : pas d'étape de migration manuelle.
export async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      VARCHAR(40) UNIQUE NOT NULL,
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS matches (
      id          SERIAL PRIMARY KEY,
      stage       VARCHAR(40) NOT NULL DEFAULT 'Phase de groupes',
      group_name  VARCHAR(10),
      team_home   VARCHAR(60) NOT NULL,
      team_away   VARCHAR(60) NOT NULL,
      flag_home   VARCHAR(10) DEFAULT '',
      flag_away   VARCHAR(10) DEFAULT '',
      kickoff_at  TIMESTAMPTZ NOT NULL,
      score_home  INTEGER,
      score_away  INTEGER,
      status      VARCHAR(20) NOT NULL DEFAULT 'scheduled'
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS predictions (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      match_id   INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      pred_home  INTEGER NOT NULL,
      pred_away  INTEGER NOT NULL,
      points     INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, match_id)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS leagues (
      id         SERIAL PRIMARY KEY,
      name       VARCHAR(60) NOT NULL,
      join_code  VARCHAR(8) UNIQUE NOT NULL,
      owner_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS league_members (
      league_id INTEGER NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (league_id, user_id)
    );
  `);

  logger.info('Migrations appliquées (tables prêtes)');
}
