import bcrypt from 'bcryptjs';
import { query } from './db.js';
import { logger } from './logger.js';

// Matchs basés sur la vraie phase de groupes de la Coupe du Monde 2026.
// Les matchs "finished" portent les scores réellement observés ;
// les matchs "scheduled" sont à pronostiquer.
// (Données d'exemple : l'admin peut ajouter / corriger les matchs via /admin.)
const MATCHS_TERMINES = [
  ['A', 'Mexique', '🇲🇽', 'Afrique du Sud', '🇿🇦', '2026-06-11T21:00:00Z', 2, 0],
  ['A', 'Corée du Sud', '🇰🇷', 'Rép. tchèque', '🇨🇿', '2026-06-12T04:00:00Z', 2, 1],
  ['B', 'Canada', '🇨🇦', 'Bosnie-Herzégovine', '🇧🇦', '2026-06-12T21:00:00Z', 1, 1],
  ['D', 'États-Unis', '🇺🇸', 'Paraguay', '🇵🇾', '2026-06-13T03:00:00Z', 4, 1],
  ['B', 'Qatar', '🇶🇦', 'Suisse', '🇨🇭', '2026-06-13T21:00:00Z', 1, 1],
  ['C', 'Brésil', '🇧🇷', 'Maroc', '🇲🇦', '2026-06-14T00:00:00Z', 1, 1],
  ['C', 'Haïti', '🇭🇹', 'Écosse', '🏴', '2026-06-14T03:00:00Z', 0, 1],
  ['D', 'Australie', '🇦🇺', 'Turquie', '🇹🇷', '2026-06-14T06:00:00Z', 2, 0],
  ['E', 'Allemagne', '🇩🇪', 'Curaçao', '🇨🇼', '2026-06-14T19:00:00Z', 7, 1],
  ['F', 'Pays-Bas', '🇳🇱', 'Japon', '🇯🇵', '2026-06-14T22:00:00Z', 2, 2],
  ['E', "Côte d'Ivoire", '🇨🇮', 'Équateur', '🇪🇨', '2026-06-13T19:00:00Z', 1, 0],
  ['F', 'Suède', '🇸🇪', 'Tunisie', '🇹🇳', '2026-06-13T22:00:00Z', 5, 1],
  ['H', 'Espagne', '🇪🇸', 'Cap-Vert', '🇨🇻', '2026-06-14T17:00:00Z', 0, 0],
  ['G', 'Belgique', '🇧🇪', 'Égypte', '🇪🇬', '2026-06-14T18:00:00Z', 1, 1],
  ['H', 'Arabie saoudite', '🇸🇦', 'Uruguay', '🇺🇾', '2026-06-14T20:00:00Z', 1, 1],
  ['G', 'Iran', '🇮🇷', 'Nouvelle-Zélande', '🇳🇿', '2026-06-14T23:00:00Z', 2, 2],
];

// Matchs à venir (à pronostiquer). Dates dans le futur proche de la compétition.
const MATCHS_A_VENIR = [
  ['I', 'France', '🇫🇷', 'Irak', '🇮🇶', '2026-06-22T23:00:00Z'],
  ['I', 'Norvège', '🇳🇴', 'France', '🇫🇷', '2026-06-26T21:00:00Z'],
  ['A', 'Mexique', '🇲🇽', 'Corée du Sud', '🇰🇷', '2026-06-20T21:00:00Z'],
  ['B', 'Suisse', '🇨🇭', 'Canada', '🇨🇦', '2026-06-20T18:00:00Z'],
  ['C', 'Brésil', '🇧🇷', 'Écosse', '🏴', '2026-06-21T21:00:00Z'],
  ['E', 'Allemagne', '🇩🇪', "Côte d'Ivoire", '🇨🇮', '2026-06-21T18:00:00Z'],
  ['H', 'Espagne', '🇪🇸', 'Uruguay', '🇺🇾', '2026-06-21T15:00:00Z'],
  ['G', 'Belgique', '🇧🇪', 'Iran', '🇮🇷', '2026-06-20T15:00:00Z'],
];

export async function seed() {
  // --- Compte administrateur ---
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@pronos.local';
  const adminPass = process.env.ADMIN_PASSWORD;
if (!adminPass) {
  throw new Error('ADMIN_PASSWORD doit être défini pour créer le compte administrateur.');
}

  const { rows: existingAdmin } = await query(
    'SELECT id FROM users WHERE username = $1',
    [adminUser]
  );
  if (existingAdmin.length === 0) {
    const hash = await bcrypt.hash(adminPass, 10);
    await query(
      'INSERT INTO users (username, email, password_hash, is_admin) VALUES ($1, $2, $3, TRUE)',
      [adminUser, adminEmail, hash]
    );
    logger.info({ adminUser }, 'Compte administrateur créé');
  }

  // --- Matchs (seulement si la table est vide) ---
  const { rows: matchCount } = await query('SELECT COUNT(*)::int AS n FROM matches');
  if (matchCount[0].n === 0) {
    for (const [g, th, fh, ta, fa, ko, sh, sa] of MATCHS_TERMINES) {
      await query(
        `INSERT INTO matches (group_name, team_home, flag_home, team_away, flag_away, kickoff_at, score_home, score_away, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'finished')`,
        [g, th, fh, ta, fa, ko, sh, sa]
      );
    }
    for (const [g, th, fh, ta, fa, ko] of MATCHS_A_VENIR) {
      await query(
        `INSERT INTO matches (group_name, team_home, flag_home, team_away, flag_away, kickoff_at, status)
         VALUES ($1,$2,$3,$4,$5,$6,'scheduled')`,
        [g, th, fh, ta, fa, ko]
      );
    }
    logger.info(
      { termines: MATCHS_TERMINES.length, a_venir: MATCHS_A_VENIR.length },
      'Matchs initialisés'
    );
  }
}
