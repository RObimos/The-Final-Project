# ⚽ Pronos CDM 2026

Jeu de **pronostics sur la Coupe du Monde 2026** (format inspiré de *Mon Petit Gazon*).
Chaque joueur pronostique le score des matchs, marque des points et se mesure aux autres
dans un classement général ou dans des ligues privées entre amis.

**Barème** : score exact = **3 pts** · bon résultat (1/N/2) = **1 pt** · sinon 0.

---

## Stack technique

| Brique            | Choix                                    |
|-------------------|------------------------------------------|
| Langage / runtime | Node.js 20                               |
| Framework web     | Express                                  |
| Base de données   | PostgreSQL 16 (persistance des données)  |
| Vues              | EJS (rendu côté serveur)                 |
| Authentification  | express-session + bcrypt (sessions en BDD) |
| Logs              | pino (JSON structuré sur stdout)         |
| Conteneurisation  | Docker + docker-compose                  |
| Déploiement       | Coolify                                  |

---

## Lancer en local (Docker)

Prérequis : Docker + Docker Compose.

```bash
cp .env.example .env       # puis édite les valeurs (SESSION_SECRET, ADMIN_PASSWORD…)
docker compose up --build
```

L'application est disponible sur http://localhost:3000

- Un **compte administrateur** est créé automatiquement au premier démarrage
  (identifiants définis par `ADMIN_USERNAME` / `ADMIN_PASSWORD`).
- Les **matchs de la phase de groupes** (données réelles de la CDM 2026) sont
  insérés automatiquement : 16 matchs terminés (avec scores) + 8 matchs à pronostiquer.

### Lancer en local sans Docker

```bash
npm install
# Avoir un PostgreSQL accessible, puis :
export DATABASE_URL="postgres://user:password@localhost:5432/pronos"
export SESSION_SECRET="dev"
npm start
```

---

## Déploiement sur Coolify

Deux options. La plus simple est le déploiement **Docker Compose**.

### Option A — Docker Compose (recommandée)

1. Pousser ce dépôt sur GitHub.
2. Dans Coolify : **+ New Resource → Docker Compose → depuis le dépôt GitHub**.
3. Coolify détecte `docker-compose.yml` (app + PostgreSQL avec volume `pgdata`).
4. Renseigner les variables d'environnement : `SESSION_SECRET`, `ADMIN_USERNAME`,
   `ADMIN_PASSWORD`, `ADMIN_EMAIL`, `PGPASSWORD`.
5. Définir le domaine public et activer le HTTPS (Let's Encrypt, automatique via Traefik).
6. **Health Check** : chemin `/health`, port `3000`.
7. Déployer. ✅

### Option B — Application Dockerfile + base managée

1. Créer une base **PostgreSQL** dans Coolify (Databases) → récupérer son `DATABASE_URL`.
2. Créer une **Application** depuis le dépôt GitHub (build pack : Dockerfile).
3. Variables : `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_*`, `NODE_ENV=production`.
4. Port exposé : `3000`. Health Check : `/health`.

---

## Supervision

- **Endpoint `/health`** : renvoie `200 {status:"ok", db:"up"}` si l'app et la base
  répondent, `503` sinon. Branché sur le Health Check Coolify et utilisable par
  **Uptime Kuma** (monitoring + alerting externe).
- **Health check conteneur** défini dans le `Dockerfile` et le `docker-compose.yml`.

## Logs

- Logs **JSON structurés** (pino) envoyés sur **stdout**.
- Consultables dans **Coolify → onglet Logs** du service, ou via `docker logs <conteneur>`.
- Chaque requête HTTP est tracée (méthode, route, statut, durée), ainsi que les
  événements métier (inscription, pronostic enregistré, résultat saisi…).

## Sauvegardes

Les données métier vivent dans le volume PostgreSQL (`pgdata`). Stratégie **3-2-1** :
sauvegarde régulière via `pg_dump`, conservée sur 2 supports différents dont 1 hors site
(voir le rapport de synthèse pour le détail).

```bash
# Exemple de sauvegarde manuelle
docker exec -t <conteneur_db> pg_dump -U pronos pronos > backup_$(date +%F).sql
```

---

## Structure du projet

```
.
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
└── src/
    ├── server.js          # point d'entrée Express, health check, sessions
    ├── db.js              # pool PostgreSQL + attente de la base au démarrage
    ├── logger.js          # logger pino
    ├── migrate.js         # création des tables (idempotent)
    ├── seed.js            # admin + matchs réels CDM 2026
    ├── scoring.js         # barème de points
    ├── middleware/auth.js # protection des routes
    ├── routes/            # auth, matches, leagues, leaderboard, admin
    └── views/             # templates EJS
```

## Fonctionnalités

- Inscription / connexion sécurisée (mots de passe hachés bcrypt).
- Saisie de pronostics, **verrouillés au coup d'envoi**.
- Calcul automatique des points à la saisie des résultats par l'admin.
- Classement général + **ligues privées** (création, code d'invitation, classement par ligue).
- Interface d'administration (saisie des résultats, ajout de matchs).
