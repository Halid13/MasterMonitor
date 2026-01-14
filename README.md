# MasterMonitor - Dashboard IT Centralisé

Une application web moderne et complète pour la gestion centralisée de votre infrastructure informatique.

## 🎯 Caractéristiques principales

### 1. **Gestion des adresses IP**
- Visualisation et gestion de toutes les adresses IP du réseau
- Configuration des subnets, passerelles et serveurs DNS
- Suivi des adresses assignées et disponibles
- Statut des adresses (actives/inactives)

### 2. **Gestion des équipements informatiques**
- Inventaire complet des équipements (serveurs, stations de travail, imprimantes, etc.)
- Suivi des caractéristiques (fabricant, modèle, numéro de série)
- Localisation physique des équipements
- État opérationnel des appareils

### 3. **Gestion des utilisateurs**
- Administration des comptes utilisateurs
- Attribution des rôles (Admin, Manager, Technicien, Utilisateur)
- Gestion des départements
- Statut actif/inactif des utilisateurs

### 4. **Supervision du serveur principal**
- Suivi en temps réel des métriques:
  - Utilisation CPU
  - Mémoire RAM
  - Espace disque
  - Trafic réseau
  - Température (si disponible)
- État de santé des serveurs
- Monitoring des services critiques

### 5. **Gestion des tickets Helpdesk**
- Création et suivi des tickets de support
- Classification par priorité (Faible, Moyen, Élevé, Critique)
- Catégorisation (Matériel, Logiciel, Réseau, Utilisateur)
- Statut du ticket (Ouvert, En cours, En attente, Résolu, Fermé)
- Assignation aux techniciens

### 6. **Tableau de bord global**
- Vue d'ensemble des statistiques clés
- Alertes et notifications en temps réel
- Santé globale de l'infrastructure
- Tickets récents
- État des serveurs

## 🚀 Installation

### Prérequis
- Node.js 18+ 
- npm ou yarn

### Étapes d'installation

1. **Clonez ou entrez dans le répertoire du projet**
```bash
cd c:\Users\halid\Documents\MasterMonitor
```

2. **Installez les dépendances** (si ce n'est pas fait)
```bash
npm install
```

3. **Installez les dépendances additionnelles pour les icônes**
```bash
npm install lucide-react
```

## 📦 Structure du projet

```
src/
├── app/                      # Pages de l'application (Next.js App Router)
│   ├── layout.tsx           # Layout principal
│   ├── page.tsx             # Tableau de bord
│   ├── equipment/           # Page gestion équipements
│   ├── users/               # Page gestion utilisateurs
│   ├── ip-addresses/        # Page gestion IP
│   ├── servers/             # Page supervision serveurs
│   ├── tickets/             # Page tickets helpdesk
│   └── globals.css          # Styles globaux
├── components/              # Composants React réutilisables
│   ├── MainLayout.tsx       # Layout avec sidebar
│   ├── StatCard.tsx         # Carte statistique
│   ├── AlertItem.tsx        # Item d'alerte
│   ├── ServerCard.tsx       # Carte serveur
│   └── TicketCard.tsx       # Carte ticket
├── types/                   # Définitions TypeScript
│   └── index.ts             # Types et interfaces
├── store/                   # Gestion d'état (Zustand)
│   └── dashboard.ts         # Store du dashboard
├── services/                # Services API
│   └── api.ts               # Client API avec axios
└── lib/                     # Utilitaires et fonctions

```

## 🛠️ Technologies utilisées

- **Next.js 14+** - Framework React pour production
- **TypeScript** - Langage typé pour la sécurité
- **Tailwind CSS** - Framework CSS utilitaire
- **Zustand** - Gestion d'état légère
- **Axios** - Client HTTP
- **Lucide React** - Icônes vectorielles
- **React** - Bibliothèque UI

## 🎨 Thèmes et couleurs

Le dashboard utilise un système de couleurs cohérent:
- **Primary** (Bleu): Actions principales
- **Green**: Statut sain/Succès
- **Red**: Erreurs/Alertes critiques
- **Yellow**: Avertissements
- **Orange**: Informations importantes

## 📝 Configuration

### Variables d'environnement

Créez un fichier `.env.local` à la racine du projet:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

## 🚀 Démarrage

### Mode développement
```bash
npm run dev
```

L'application sera accessible à: http://localhost:3000

### Mode production
```bash
npm run build
npm start
```

## 🗄️ Gestion d'état (Zustand)

Le store `useDashboardStore` permet de gérer:
- Liste des équipements
- Liste des utilisateurs
- Liste des tickets
- État des serveurs
- Alertes et notifications
- Adresses IP

### Utilisation:
```typescript
import { useDashboardStore } from '@/store/dashboard';

const { equipment, addEquipment } = useDashboardStore();
```

## 🔗 Intégration API

Les services API sont prêts à communiquer avec votre backend:

```typescript
import { equipmentService, userService, ticketService } from '@/services/api';

// Exemples:
const allEquipment = await equipmentService.getAll();
const allUsers = await userService.getAll();
const allTickets = await ticketService.getAll();
```

## 📊 Statistiques du dashboard

Le dashboard affiche:
- Nombre total d'équipements opérationnels
- Nombre d'utilisateurs actifs
- Tickets ouverts
- Alertes critiques
- Score de santé des serveurs
- Utilisation des adresses IP

## 🔐 Sécurité

- TypeScript pour la vérification des types
- Validation côté client
- Prêt pour l'authentification (à implémenter)
- Gestion d'erreurs appropriée

## 📝 Notes importantes

1. **Données mock**: Le dashboard utilise actuellement des données fictives pour la démonstration
2. **Backend requis**: Connectez votre API backend en modifiant les services API
3. **Authentification**: À implémenter selon vos besoins
4. **Base de données**: Le projet est prêt pour une intégration avec une BD

## 🤝 Prochaines étapes

1. Connecter à une base de données réelle
2. Implémenter l'authentification et l'autorisation
3. Ajouter des graphiques avancés (Chart.js ou Recharts)
4. Implémenter les WebSockets pour les mises à jour en temps réel
5. Ajouter des exports de rapports (PDF, Excel)
6. Implémenter des filtres et recherche avancée
7. Ajouter les tests unitaires et d'intégration

