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

2) Lancer en développement
- npm run dev

L’application est disponible sur http://localhost:3000

## Configuration

Créer un fichier .env.local à la racine du projet :

- LDAP_URL=ldap://votre-ldap:389
- LDAP_BASE_DN=DC=exemple,DC=local
- LDAP_BIND_DN=CN=service,OU=Users,DC=exemple,DC=local
- LDAP_BIND_PASSWORD=mot_de_passe
- LDAP_USER_FILTER=(objectClass=user)

## Structure du projet

- src/app : pages et routes API (Next.js App Router)
- src/components : composants UI réutilisables
- src/store : état global (Zustand)
- src/services : services applicatifs (logger, intégrations)
- src/types : types TypeScript

## Notes

- Les logs sont stockés en mémoire côté serveur (utile en dev). Pour la production, prévoir une persistance (base de données).
- Les données affichées peuvent provenir d’API internes ou d’un backend externe selon l’intégration.

## Technologies

- Next.js, TypeScript, Tailwind CSS
- Zustand
- LDAP (auth)

