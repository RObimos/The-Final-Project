import { Router } from 'express';
import { query } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

export const leaderboardRouter = Router();

leaderboardRouter.get('/leaderboard', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.username,
            COALESCE(SUM(p.points), 0)::int AS total,
            COUNT(p.id) FILTER (WHERE p.points = 3)::int AS exacts,
            COUNT(p.id) FILTER (WHERE p.points = 1)::int AS bons,
            COUNT(p.id)::int AS joues
       FROM users u
       LEFT JOIN predictions p ON p.user_id = u.id
       WHERE u.is_admin = FALSE
       GROUP BY u.id, u.username
       ORDER BY total DESC, exacts DESC, u.username ASC`
  );

  res.render('leaderboard', {
    title: 'Classement général',
    rows,
    currentUserId: req.session.user.id,
  });
});
