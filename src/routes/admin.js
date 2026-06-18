import { Router } from 'express';
import { query } from '../db.js';
import { logger } from '../logger.js';
import { requireAdmin } from '../middleware/auth.js';
import { recomputeMatchPoints } from '../scoring.js';

export const adminRouter = Router();

adminRouter.get('/admin', requireAdmin, async (req, res) => {
  const { rows: matches } = await query('SELECT * FROM matches ORDER BY kickoff_at ASC');
  res.render('admin', {
    title: 'Administration',
    matches,
    flash: req.session.flash || null,
  });
  req.session.flash = null;
});

// Saisir / mettre à jour le résultat d'un match -> recalcule les points
adminRouter.post('/admin/matches/:id/result', requireAdmin, async (req, res) => {
  const matchId = Number(req.params.id);
  const scoreHome = parseInt(req.body.score_home, 10);
  const scoreAway = parseInt(req.body.score_away, 10);

  if (!Number.isInteger(scoreHome) || !Number.isInteger(scoreAway) || scoreHome < 0 || scoreAway < 0) {
    req.session.flash = { type: 'error', text: 'Score invalide.' };
    return res.redirect('/admin');
  }

  await query(
    "UPDATE matches SET score_home = $1, score_away = $2, status = 'finished' WHERE id = $3",
    [scoreHome, scoreAway, matchId]
  );
  await recomputeMatchPoints(matchId);
  logger.info({ matchId, scoreHome, scoreAway }, 'Résultat saisi et points recalculés');

  req.session.flash = { type: 'success', text: 'Résultat enregistré, points mis à jour.' };
  res.redirect('/admin');
});

// Ajouter un match
adminRouter.post('/admin/matches', requireAdmin, async (req, res) => {
  const { group_name, team_home, team_away, flag_home, flag_away, kickoff_at } = req.body;
  if (!team_home || !team_away || !kickoff_at) {
    req.session.flash = { type: 'error', text: 'Équipes et date/heure sont obligatoires.' };
    return res.redirect('/admin');
  }
  await query(
    `INSERT INTO matches (group_name, team_home, flag_home, team_away, flag_away, kickoff_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,'scheduled')`,
    [group_name || null, team_home, flag_home || '', team_away, flag_away || '', kickoff_at]
  );
  req.session.flash = { type: 'success', text: 'Match ajouté.' };
  res.redirect('/admin');
});
