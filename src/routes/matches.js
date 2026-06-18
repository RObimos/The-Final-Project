import { Router } from 'express';
import { query } from '../db.js';
import { logger } from '../logger.js';
import { requireAuth } from '../middleware/auth.js';

export const matchesRouter = Router();

// Tableau de bord (page d'accueil une fois connecté)
matchesRouter.get('/', requireAuth, async (req, res) => {
  const userId = req.session.user.id;

  const { rows: totalRows } = await query(
    'SELECT COALESCE(SUM(points), 0)::int AS total FROM predictions WHERE user_id = $1',
    [userId]
  );
  const { rows: rankRows } = await query(
    `SELECT rang FROM (
        SELECT u.id, RANK() OVER (ORDER BY COALESCE(SUM(p.points),0) DESC) AS rang
        FROM users u
        LEFT JOIN predictions p ON p.user_id = u.id
        WHERE u.is_admin = FALSE
        GROUP BY u.id
     ) t WHERE id = $1`,
    [userId]
  );
  const { rows: nextMatches } = await query(
    `SELECT m.*, pr.pred_home, pr.pred_away
       FROM matches m
       LEFT JOIN predictions pr ON pr.match_id = m.id AND pr.user_id = $1
       WHERE m.status = 'scheduled' AND m.kickoff_at > now()
       ORDER BY m.kickoff_at ASC
       LIMIT 5`,
    [userId]
  );

  res.render('dashboard', {
    title: 'Mon tableau de bord',
    total: totalRows[0].total,
    rank: rankRows[0] ? rankRows[0].rang : '—',
    nextMatches,
  });
});

// Liste des matchs + pronostics
matchesRouter.get('/matches', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const { rows: matches } = await query(
    `SELECT m.*, pr.pred_home, pr.pred_away, pr.points
       FROM matches m
       LEFT JOIN predictions pr ON pr.match_id = m.id AND pr.user_id = $1
       ORDER BY m.kickoff_at ASC`,
    [userId]
  );

  const now = Date.now();
  const aVenir = matches.filter(
    (m) => m.status === 'scheduled' && new Date(m.kickoff_at).getTime() > now
  );
  const verrouilles = matches.filter(
    (m) =>
      m.status === 'finished' ||
      (m.status === 'scheduled' && new Date(m.kickoff_at).getTime() <= now)
  );

  res.render('matches', {
    title: 'Matchs & pronostics',
    aVenir,
    verrouilles,
    flash: req.session.flash || null,
  });
  req.session.flash = null;
});

// Enregistrer / mettre à jour un pronostic
matchesRouter.post('/matches/:id/predict', requireAuth, async (req, res) => {
  const userId = req.session.user.id;
  const matchId = Number(req.params.id);
  const predHome = parseInt(req.body.pred_home, 10);
  const predAway = parseInt(req.body.pred_away, 10);

  if (
    !Number.isInteger(predHome) ||
    !Number.isInteger(predAway) ||
    predHome < 0 ||
    predAway < 0 ||
    predHome > 30 ||
    predAway > 30
  ) {
    req.session.flash = { type: 'error', text: 'Score invalide (entre 0 et 30).' };
    return res.redirect('/matches');
  }

  const { rows } = await query('SELECT kickoff_at, status FROM matches WHERE id = $1', [matchId]);
  const match = rows[0];
  if (!match) return res.redirect('/matches');

  const verrouille =
    match.status === 'finished' || new Date(match.kickoff_at).getTime() <= Date.now();
  if (verrouille) {
    req.session.flash = {
      type: 'error',
      text: 'Le match a commencé : les pronostics sont verrouillés.',
    };
    return res.redirect('/matches');
  }

  await query(
    `INSERT INTO predictions (user_id, match_id, pred_home, pred_away)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, match_id)
     DO UPDATE SET pred_home = EXCLUDED.pred_home, pred_away = EXCLUDED.pred_away, updated_at = now()`,
    [userId, matchId, predHome, predAway]
  );
  logger.info({ userId, matchId, predHome, predAway }, 'Pronostic enregistré');

  req.session.flash = { type: 'success', text: 'Pronostic enregistré ✔' };
  res.redirect('/matches');
});
