import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import { logger } from '../logger.js';

export const authRouter = Router();

authRouter.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('register', { title: 'Inscription', error: null, values: {} });
});

authRouter.post('/register', async (req, res) => {
  const username = (req.body.username || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  const values = { username, email };

  if (username.length < 3 || username.length > 40) {
    return res.render('register', {
      title: 'Inscription',
      error: "Le pseudo doit comporter entre 3 et 40 caractères.",
      values,
    });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.render('register', {
      title: 'Inscription',
      error: 'Adresse e-mail invalide.',
      values,
    });
  }
  if (password.length < 6) {
    return res.render('register', {
      title: 'Inscription',
      error: 'Le mot de passe doit comporter au moins 6 caractères.',
      values,
    });
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, is_admin',
      [username, email, hash]
    );
    const user = rows[0];
    req.session.user = { id: user.id, username: user.username, is_admin: user.is_admin };
    logger.info({ userId: user.id, username }, 'Nouvel utilisateur inscrit');
    res.redirect('/');
  } catch (err) {
    if (err.code === '23505') {
      return res.render('register', {
        title: 'Inscription',
        error: 'Ce pseudo ou cet e-mail est déjà utilisé.',
        values,
      });
    }
    logger.error({ err }, "Erreur lors de l'inscription");
    res.status(500).render('error', {
      title: 'Erreur',
      message: "Une erreur est survenue lors de l'inscription. Réessaie dans un instant.",
    });
  }
});

authRouter.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'Connexion', error: null, values: {} });
});

authRouter.post('/login', async (req, res) => {
  const identifier = (req.body.identifier || '').trim().toLowerCase();
  const password = req.body.password || '';

  try {
    const { rows } = await query(
      'SELECT id, username, password_hash, is_admin FROM users WHERE lower(username) = $1 OR lower(email) = $1',
      [identifier]
    );
    const user = rows[0];
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) {
      return res.status(401).render('login', {
        title: 'Connexion',
        error: 'Identifiants incorrects.',
        values: { identifier: req.body.identifier },
      });
    }
    req.session.user = { id: user.id, username: user.username, is_admin: user.is_admin };
    logger.info({ userId: user.id }, 'Connexion réussie');
    res.redirect('/');
  } catch (err) {
    logger.error({ err }, 'Erreur lors de la connexion');
    res.status(500).render('error', {
      title: 'Erreur',
      message: 'Une erreur est survenue lors de la connexion.',
    });
  }
});

authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});
