# MasterMonitor

Plateforme de supervision IT pour centraliser l’état des équipements, des serveurs, des tickets et des logs dans un tableau de bord unique.

## Contexte

MasterMonitor vise à offrir une vue claire et opérationnelle de l’infrastructure : inventaire, métriques système, tickets et journaux d’activité. L’objectif est de simplifier le suivi quotidien, d’accélérer les diagnostics et d’assurer la traçabilité.

## Objectifs

- Centraliser les informations clés de l’infrastructure.
- Fournir un suivi en temps réel des métriques et événements.
- Faciliter le support via le suivi des tickets.
- Améliorer la traçabilité grâce aux logs détaillés.

## Fonctionnalités principales

- Tableau de bord global (KPIs, tendances, disponibilité).
- Supervision des serveurs (CPU, mémoire, disque, réseau).
- Gestion des équipements et utilisateurs.
- Gestion des adresses IP et sous-réseaux.
- Suivi des tickets helpdesk.
- Système de logs avec recherche, filtres, export et purge.
- Connexion LDAP avec journalisation des connexions.

## Démarrage rapide

1) Installer les dépendances
- npm install

2) Configurer PostgreSQL
- Copier `.env.example` vers `.env.local`
- Renseigner `DATABASE_URL`
- Appliquer le schéma SQL:
	- `psql "$env:DATABASE_URL" -f db/schema.sql` (PowerShell)

3) Lancer en développement
- npm run dev

L’application est disponible sur http://localhost:3000

## Configuration

Créer un fichier .env.local à la racine du projet :

- DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mastermonitor

- LDAP_URL=ldap://votre-ldap:389
- LDAP_BASE_DN=DC=exemple,DC=local
- LDAP_BIND_DN=CN=service,OU=Users,DC=exemple,DC=local
- LDAP_BIND_PASSWORD=mot_de_passe
- LDAP_USER_FILTER=(objectClass=user)

Validation DB:
- GET /api/system/db doit retourner `ok: true` si PostgreSQL est joignable.

## Monitoring temps réel via PostgreSQL

Le projet persiste désormais les données de monitoring en PostgreSQL avec 3 niveaux de rafraîchissement :

- Temps réel (~5s): statut machines, IP, CPU/RAM/disque, services, tickets ouverts, alertes, ping.
- Dynamique (~30s): assignations machine/utilisateur, IP/machine, statut équipement, occupation sous-réseau, localisation.
- Statique (~5 min): inventaire, configuration, historique tickets/modifications.

La synchro est déclenchée côté interface via `MainLayout` et envoyée vers `POST /api/monitoring`.

Endpoints utiles:
- GET /api/monitoring?view=realtime
- GET /api/monitoring?view=dynamic
- GET /api/monitoring?view=static
- GET /api/monitoring/logs?mode=recent|critical|error|security&limit=100&offset=0
- GET /api/monitoring/stream (SSE snapshot temps réel)

Important: appliquer `db/schema.sql` après mise à jour.

## Structure du projet

- src/app : pages et routes API (Next.js App Router)
- src/components : composants UI réutilisables
- src/store : état global (Zustand)
- src/services : services applicatifs (logger, intégrations)
- src/types : types TypeScript

## Notes

- Les logs sont stockés en mémoire côté serveur (utile en dev). Pour la production, prévoir une persistance (base de données).
- Les données affichées peuvent provenir d’API internes ou d’un backend externe selon l’intégration.
- Une base PostgreSQL est maintenant prévue via `src/lib/postgres.ts` et `db/schema.sql`.

## Technologies

- Next.js, TypeScript, Tailwind CSS
- Zustand
- LDAP (auth)

