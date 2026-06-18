import { query } from './db.js';

// Barème (style Mon Petit Gazon / pronostics classiques) :
//   - Score exact          -> 3 points
//   - Bon résultat (1/N/2) -> 1 point
//   - Sinon                -> 0 point
export function computePoints(pred_home, pred_away, score_home, score_away) {
  if (score_home === null || score_away === null) return 0;

  if (pred_home === score_home && pred_away === score_away) return 3;

  const signe = (a, b) => Math.sign(a - b); // -1, 0 ou 1
  if (signe(pred_home, pred_away) === signe(score_home, score_away)) return 1;

  return 0;
}

// Recalcule et met à jour les points de tous les pronostics d'un match.
export async function recomputeMatchPoints(matchId) {
  const { rows: matchRows } = await query(
    'SELECT score_home, score_away FROM matches WHERE id = $1',
    [matchId]
  );
  if (matchRows.length === 0) return;
  const { score_home, score_away } = matchRows[0];

  const { rows: preds } = await query(
    'SELECT id, pred_home, pred_away FROM predictions WHERE match_id = $1',
    [matchId]
  );

  for (const p of preds) {
    const pts = computePoints(p.pred_home, p.pred_away, score_home, score_away);
    await query('UPDATE predictions SET points = $1 WHERE id = $2', [pts, p.id]);
  }
}
