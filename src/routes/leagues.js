import { Router } from 'express';
import { query } from '../db.js';
import { logger } from '../logger.js';
import { requireAuth } from '../middleware/auth.js';

export const leaguesRouter = Router();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// Liste des ligues de l'utilisateur
leaguesRouter.get('/leagues', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const { rows: leagues } = await query(
    `SELECT l.id, l.name, l.join_code, l.owner_id,
            (SELECT COUNT(*)::int FROM league_members lm2 WHERE lm2.league_id = l.id) AS members
       FROM leagues l
       JOIN league_members lm ON lm.league_id = l.id AND lm.user_id = $1
       ORDER BY l.created_at DESC`,
    [userId]
  );
  res.render('leagues', {
    title: 'Mes ligues',
    leagues,
    flash: req.session.flash || null,
  });
  req.session.flash = null;
});

// Créer une ligue
leaguesRouter.post('/leagues', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const name = (req.body.name || '').trim();
  if (name.length < 2 || name.length > 60) {
    req.session.flash = { type: 'error', text: 'Le nom de la ligue doit faire 2 à 60 caractères.' };
    return res.redirect('/leagues');
  }

  let code;
  for (let attempt = 0; attempt < 5; attempt++) {
    code = generateCode();
    const { rows } = await query('SELECT 1 FROM leagues WHERE join_code = $1', [code]);
    if (rows.length === 0) break;
  }

  const { rows } = await query(
    'INSERT INTO leagues (name, join_code, owner_id) VALUES ($1, $2, $3) RETURNING id',
    [name, code, userId]
  );
  const leagueId = rows[0].id;
  await query('INSERT INTO league_members (league_id, user_id) VALUES ($1, $2)', [leagueId, userId]);
  logger.info({ userId, leagueId, code }, 'Ligue créée');

  req.session.flash = { type: 'success', text: `Ligue créée. Code à partager : ${code}` };
  res.redirect('/leagues');
});

// Rejoindre une ligue via un code
leaguesRouter.post('/leagues/join', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const code = (req.body.join_code || '').trim().toUpperCase();

  const { rows } = await query('SELECT id, name FROM leagues WHERE join_code = $1', [code]);
  if (rows.length === 0) {
    req.session.flash = { type: 'error', text: 'Aucune ligue trouvée avec ce code.' };
    return res.redirect('/leagues');
  }
  const league = rows[0];
  await query(
    'INSERT INTO league_members (league_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [league.id, userId]
  );
  req.session.flash = { type: 'success', text: `Tu as rejoint « ${league.name} ».` };
  res.redirect(`/leagues/${league.id}`);
});

// Classement d'une ligue
leaguesRouter.get('/leagues/:id', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const leagueId = Number(req.params.id);

  const { rows: memberCheck } = await query(
    'SELECT 1 FROM league_members WHERE league_id = $1 AND user_id = $2',
    [leagueId, userId]
  );
  if (memberCheck.length === 0) {
    return res.status(403).render('error', {
      title: 'Accès refusé',
      message: "Tu ne fais pas partie de cette ligue.",
    });
  }

  const { rows: leagueRows } = await query('SELECT * FROM leagues WHERE id = $1', [leagueId]);
  const league = leagueRows[0];

  const { rows: standings } = await query(
    `SELECT u.id, u.username,
            COALESCE(SUM(p.points), 0)::int AS total,
            COUNT(p.id) FILTER (WHERE p.points = 3)::int AS exacts
       FROM league_members lm
       JOIN users u ON u.id = lm.user_id
       LEFT JOIN predictions p ON p.user_id = u.id
       WHERE lm.league_id = $1
       GROUP BY u.id, u.username
       ORDER BY total DESC, exacts DESC, u.username ASC`,
    [leagueId]
  );

  res.render('league', {
    title: league.name,
    league,
    standings,
    currentUserId: userId,
  });
});
