# MasterMonitor expliqué simplement — le bilan complet pour ta soutenance

> Ce document explique **tout ton projet**, brique par brique, avec des mots simples et des comparaisons de tous les jours. L'idée : que tu puisses fermer ce fichier et raconter chaque partie avec tes propres mots, sans bafouiller sur le "pourquoi" ni sur le "comment ça marche techniquement".

Pour chaque partie, tu trouveras trois questions :
- **Qu'est-ce que ça fait ?** (le rôle, en une phrase simple)
- **Comment ça marche ?** (le mécanisme, avec une image concrète)
- **Pourquoi c'est fait comme ça ?** (le choix, la raison, le problème que ça résout)

---

## 1. L'idée générale : c'est quoi MasterMonitor ?

Imagine une entreprise comme une grande maison avec plein de pièces : des ordinateurs, des imprimantes, des téléphones, des câbles réseau, des employés qui ont chacun leur matériel, et parfois des pannes qui arrivent.

Avant MasterMonitor, pour savoir "qui a quel ordinateur", "quelle adresse réseau est libre", "quel serveur va mal" ou "quel employé a un problème en cours", il fallait ouvrir plusieurs fichiers Excel différents, se souvenir où chaque info était rangée, et espérer que personne n'ait oublié de mettre à jour un fichier.

**MasterMonitor, c'est un tableau de bord unique, un site web, qui rassemble tout ça au même endroit.** Un peu comme un tableau de bord de voiture : au lieu d'aller vérifier le niveau d'essence, la pression des pneus et la température du moteur à trois endroits différents, tout est affiché devant toi, mis à jour en continu.

Il fait cinq grandes choses :
1. **Gérer les adresses réseau** (IPAM) — savoir quelles "adresses postales numériques" sont prises, libres ou en conflit.
2. **Gérer le matériel** (Asset Management) — savoir quel ordinateur/imprimante/téléphone existe, où il est, à qui il appartient.
3. **Gérer les utilisateurs** — en lien direct avec l'annuaire officiel de l'entreprise (Active Directory).
4. **Surveiller les serveurs** — savoir si les machines importantes vont bien (comme un docteur qui prend le pouls).
5. **Gérer les tickets de support (Helpdesk)** — suivre les problèmes signalés par les employés jusqu'à leur résolution.

Et en dessous de tout ça, il y a un **carnet de bord (les logs)** qui note tout ce qui se passe, pour pouvoir retracer l'historique plus tard.

---

## 2. Comment le site est construit — la boîte à outils utilisée

Avant de rentrer dans chaque module, voici les briques techniques utilisées, expliquées simplement.

### Next.js — le "moteur" du site web

**Qu'est-ce que ça fait ?** C'est l'outil qui fait fonctionner le site : il affiche les pages dans le navigateur ET s'occupe de la partie "cuisine" en coulisses (recevoir des demandes, aller chercher des infos, répondre).

**Comment ça marche ?** Imagine un restaurant : Next.js, c'est à la fois la salle (ce que le client voit, les pages) et la cuisine (ce qui prépare les plats, les fameuses "API"). D'habitude il faut deux équipes séparées pour ça (un site web + un serveur à part) ; ici, une seule techno fait les deux, dans le même bâtiment.

**Pourquoi ce choix ?** Ça simplifie énormément : un seul projet, un seul langage (TypeScript), pas besoin de faire parler deux systèmes différents entre eux.

### TypeScript — un "vérificateur orthographique" pour le code

**Qu'est-ce que ça fait ?** C'est une variante de JavaScript qui oblige à dire, à l'avance, quel type d'information chaque donnée doit contenir (un nombre, un texte, une liste...).

**Comment ça marche ?** Comme un formulaire administratif avec des cases bien définies : "ici on écrit uniquement des chiffres", "ici uniquement une date". Si quelqu'un essaie de mettre du texte dans une case chiffre, le formulaire refuse avant même d'être envoyé.

**Pourquoi ce choix ?** Ça évite plein de bugs bêtes (écrire "cinq" au lieu de "5") avant même de lancer le site, directement pendant qu'on écrit le code.

### Tailwind CSS — la peinture et la déco

**Qu'est-ce que ça fait ?** Ça donne les couleurs, les espacements, les tailles de texte — bref, l'apparence visuelle du site.

**Pourquoi ce choix ?** Ça permet d'habiller une page rapidement, directement dans le code, sans écrire des dizaines de fichiers de style séparés.

### Zustand — la mémoire partagée du site (le "tableau blanc" commun)

**Qu'est-ce que ça fait ?** C'est l'endroit où le site garde en mémoire, pendant que tu l'utilises, la liste des équipements, des utilisateurs, des tickets, des serveurs, etc.

**Comment ça marche ?** Imagine un grand tableau blanc au milieu d'un bureau open-space. Toutes les pages du site regardent ce même tableau. Quand une page ajoute un équipement, elle l'écrit sur le tableau — et toutes les autres pages voient tout de suite la mise à jour, sans avoir besoin de se reparler entre elles directement.

Concrètement dans le code (`src/store/dashboard.ts`), ce tableau contient 8 grandes catégories : les équipements, les utilisateurs, les tickets, les serveurs, les alertes, les adresses IP, l'historique IP, les sous-réseaux — plus les logs.

**Règle systématique observée dans le code** : à chaque fois qu'on ajoute/modifie/supprime quelque chose sur ce tableau (un équipement, un utilisateur...), le site fait **deux choses automatiquement** :
1. Il met à jour le tableau (l'affichage change tout de suite, sans attendre).
2. Il envoie discrètement une note au carnet de bord (`POST /api/logs`) pour dire "tel utilisateur vient de faire telle action" — et si cet envoi échoue, tant pis, ça ne bloque jamais l'utilisateur (l'erreur est simplement ignorée en silence).

**Pourquoi ce choix ?** Pour que l'interface réagisse instantanément (pas d'attente après un clic) tout en gardant une trace de tout ce qui se passe, sans jamais planter l'écran si le carnet de bord a un souci.

### PostgreSQL — l'armoire à dossiers, la mémoire durable

**Qu'est-ce que ça fait ?** C'est la base de données : l'endroit où tout est **réellement et durablement** enregistré, contrairement au "tableau blanc" Zustand qui, lui, s'efface si on ferme le navigateur.

**Comment ça marche ?** Le tableau blanc (Zustand), c'est ce que les gens ont sous les yeux dans la pièce. L'armoire à dossiers (PostgreSQL), c'est ce qui reste même si tout le monde quitte le bureau et que les lumières s'éteignent. Le site recopie régulièrement le contenu du tableau blanc dans l'armoire, pour ne jamais rien perdre.

Le fichier `db/schema.sql` définit toutes les "armoires" (tables) : utilisateurs, serveurs, tickets, historique des tickets, logs, équipements, adresses IP, sous-réseaux, alertes, résultats de ping, "photos" de supervision (`monitoring_snapshots`), état courant de l'appli (`runtime_state`).

**Pourquoi ce choix ?** PostgreSQL est un système de base de données solide, fiable, et qui sait se dupliquer (avoir une copie de secours) — important pour un outil de supervision qui ne doit jamais perdre son historique.

### SSE (Server-Sent Events) — le fil d'infos en direct

**Qu'est-ce que ça fait ?** Ça permet au serveur d'envoyer des informations toutes seules au navigateur, sans que celui-ci ait besoin de redemander sans arrêt "y a-t-il du nouveau ?".

**Comment ça marche ?** C'est comme un fil d'actu ou une radio : une fois branché, tu reçois les nouvelles au fur et à mesure qu'elles arrivent, sans avoir à rafraîchir la page toi-même. C'est différent d'un coup de fil (où il faut parler dans les deux sens) — ici c'est à sens unique, du serveur vers toi, ce qui est plus simple et suffit largement pour afficher des mises à jour.

**Pourquoi ce choix ?** Pour le scanner réseau (voir plus bas) et pour les logs en direct, on veut voir les résultats apparaître un par un, en temps réel, sans devoir cliquer sur "actualiser".

### xlsx (SheetJS) — le générateur de fichiers Excel

**Qu'est-ce que ça fait ?** Permet d'exporter les données (logs, inventaire...) directement en fichier Excel `.xlsx`, prêt à ouvrir.

**Pourquoi ce choix, et pas un simple CSV (texte brut) ?** Un fichier CSV, ouvert dans Excel sur un ordinateur français, donne souvent des accents cassés et des colonnes mal découpées — un vrai casse-tête pour les utilisateurs non-techniques. Le format `.xlsx` s'ouvre parfaitement du premier coup, avec de belles colonnes déjà dimensionnées.

### Docker — la boîte de transport standardisée

**Qu'est-ce que ça fait ?** Ça "emballe" toute l'application (le code + tout ce dont il a besoin pour tourner) dans une boîte fermée et autonome, appelée un conteneur.

**Comment ça marche ?** Imagine un déménagement : au lieu de transporter les meubles un par un et risquer d'en oublier, on met tout dans un container standardisé qui s'ouvre pareil partout, peu importe le camion ou le port. Docker fait ça pour le logiciel : le conteneur contient tout, et il tourne exactement pareil sur n'importe quel ordinateur qui a Docker installé.

**Comment c'est construit précisément (le `Dockerfile`) ?** En deux étapes :
1. **L'étape "atelier" (builder)** : on installe tous les outils, on assemble le site.
2. **L'étape "livraison" (runner)** : on ne garde que le strict nécessaire pour faire tourner le site fini — pas les outils de construction, pas le code source brut. Résultat : une boîte finale toute légère (moins de 100 Mo), qui se transporte et démarre vite, et qui expose moins de choses à un attaquant potentiel (moins de code présent = moins de failles possibles).

**Pourquoi le mode réseau spécial `network_mode: host` ?** Normalement, un conteneur Docker est un peu isolé du réseau de la machine qui l'héberge (comme une pièce fermée avec juste un petit passe-plat). Ici, on a choisi d'ouvrir complètement la porte : le conteneur partage directement le réseau de la machine qui l'héberge. **Pourquoi ?** Parce que l'application a besoin de parler directement aux contrôleurs Active Directory (l'annuaire de l'entreprise), à la base de données, et à des serveurs du réseau local — sans détour ni traduction d'adresse compliquée. C'est un choix pragmatique adapté à un usage interne, sur un réseau local fermé et de confiance (pas exposé sur Internet).

---

## 3. Le grand principe : trois vitesses de mise à jour

C'est une des idées les plus importantes du projet, alors prenons le temps de bien l'expliquer.

**Le problème** : si on demandait à la base de données de tout vérifier et tout réécrire (CPU des serveurs, tickets, inventaire...) plusieurs fois par seconde pour absolument tout, ça la fatiguerait énormément pour rien — un peu comme si tu vérifiais le courrier de ta boîte aux lettres toutes les 5 secondes même pour les factures qui n'arrivent qu'une fois par mois.

**La solution : classer les informations par vitesse de changement, et les vérifier à des rythmes différents.**

| Vitesse | Toutes les... | Ce qu'on y met | Comparaison |
|---|---|---|---|
| **Temps réel** | 5 secondes | CPU/RAM/disque des serveurs, état des services, résultats de ping, alertes actives | Le tableau de bord de la voiture : la vitesse, ça change vite, faut regarder souvent |
| **Dynamique** | 30 secondes | Affectation des équipements, occupation des sous-réseaux, mouvements de tickets | Le niveau d'essence : ça change, mais pas d'une seconde à l'autre |
| **Statique** | 5 minutes | Inventaire complet, liste des utilisateurs, historiques | Le carnet d'entretien de la voiture : ça bouge rarement, pas besoin de le rouvrir sans arrêt |

**Comment ça marche concrètement dans le code ?** Le composant `MainLayout.tsx` (le "chef d'orchestre" visuel de l'appli, présent sur toutes les pages) démarre trois minuteries dès que le site est chargé : une qui sonne toutes les 5 secondes, une toutes les 30 secondes, une toutes les 5 minutes. À chaque sonnerie, le navigateur envoie au serveur uniquement les informations qui correspondent à cette vitesse-là (pas tout en vrac à chaque fois), et le serveur les range dans les bonnes "armoires" de la base de données (fonction `persistMonitoringSnapshot` dans `src/lib/monitoring-db.ts`).

Il y a même une sécurité : si le tableau blanc (Zustand) est encore vide au tout début (le site vient juste de s'ouvrir), le site évite d'envoyer une "photo" vide qui écraserait bêtement les vraies données déjà en base. C'est comme éviter d'envoyer une feuille blanche à l'imprimante juste parce qu'on a appuyé trop vite sur le bouton.

**Pourquoi c'est fait comme ça ?** Pour économiser les ressources de la base de données, tout en gardant les informations vraiment urgentes (l'état des serveurs) très à jour. C'est un compromis intelligent entre "tout savoir en temps réel" et "ne pas fatiguer le système pour rien".

---

## 4. Le module de connexion — comment on rentre dans l'appli (authentification)

### Qu'est-ce que ça fait ?

C'est le videur à l'entrée du site : personne ne peut voir la moindre page sans prouver qui il est, et en plus, aujourd'hui, **seuls les administrateurs sont autorisés à entrer** (les autres profils sont refusés poliment).

### Comment ça marche ?

MasterMonitor **ne stocke aucun mot de passe lui-même**. Il pose la question directement à l'annuaire officiel de l'entreprise, l'Active Directory (AD) — un peu comme un videur de boîte de nuit qui, au lieu de garder sa propre liste d'invités, appelle directement la mairie pour vérifier ton identité à chaque fois. Ça évite d'avoir deux "vérités" différentes (le mot de passe du site et le mot de passe de l'entreprise) qui pourraient un jour se contredire.

Le processus, étape par étape (`src/app/api/auth/login/route.ts`) :

1. **Le site se présente d'abord lui-même à l'annuaire** avec un compte de service spécial, en lecture seule uniquement (il ne peut rien modifier dans l'annuaire — comme un employé qui a le droit de consulter le fichier des visiteurs, mais pas de le modifier).
2. **Le site cherche la personne** dans l'annuaire, en essayant plusieurs façons de l'identifier (son identifiant, son adresse mail, etc.) — parce que les gens ne tapent pas toujours leur identifiant exactement de la même façon.
3. **Le site regarde à quels groupes cette personne appartient** — y compris les groupes "cachés" dans d'autres groupes (un peu comme être membre d'un club qui lui-même appartient à une fédération plus large — le site sait remonter toute la chaîne).
4. **Le site décide du rôle** : s'il trouve la personne dans un groupe listé comme "administrateur", elle devient admin. Sinon, elle pourrait être manager, technicien ou simple utilisateur — mais **actuellement, seul le rôle admin a le droit d'entrer** ; les autres reçoivent un refus (comme un carton "réservé aux VIP" à l'entrée), même si leur mot de passe est juste.
5. **Le site vérifie le mot de passe** en tentant lui-même de se connecter à l'annuaire *en tant que cette personne*, avec le mot de passe qu'elle a tapé. Si ça marche, le mot de passe est bon (c'est le seul moyen fiable de vérifier un mot de passe sans jamais le stocker soi-même).
6. **Si tout est bon**, le site dépose trois petits badges dans le navigateur (des "cookies") : un qui dit "je suis connecté", un avec le nom affiché, un avec le rôle. Ces badges durent 8 heures, puis il faudra se reconnecter.
7. **Dans tous les cas (succès ou échec), l'action est notée dans le carnet de sécurité** — pour garder une trace de qui a essayé de se connecter, et quand.

### Pourquoi c'est fait comme ça ?

- **Pas de mot de passe stocké dans le site** → moins de risque, une seule "vraie" liste de comptes à gérer (celle de l'entreprise).
- **Compte de service en lecture seule** → même si ce compte était piraté, il ne pourrait rien modifier dans l'annuaire de l'entreprise, seulement le lire.
- **Recherche de groupes "en profondeur"** → parce que dans une vraie entreprise, l'organisation des groupes est souvent en poupées russes (un groupe dans un groupe dans un groupe), et une vérification trop simple aurait refusé à tort de vrais administrateurs.
- **Vérification côté serveur, pas juste côté écran** → c'est un point de sécurité important. Au début, le contrôle des droits se faisait un peu comme si on demandait poliment à un visiteur "peux-tu me dire toi-même si tu as le droit d'entrer ?" — un visiteur malintentionné pouvait bricoler son propre navigateur pour répondre "oui" à sa place. La correction a été de mettre un vrai gardien côté serveur (`middleware.ts`) qui vérifie lui-même le badge à chaque page demandée, sans jamais faire confiance à ce que dit le navigateur du visiteur.

---

## 5. Le module IPAM — la gestion des adresses réseau

### Qu'est-ce que ça fait ?

Imagine un immeuble avec des boîtes aux lettres numérotées. Chaque appareil sur le réseau (ordinateur, imprimante, téléphone) a besoin d'une "adresse postale numérique" unique — son adresse IP. Le module IPAM, c'est le **plan de l'immeuble** : il montre quelles boîtes sont occupées, lesquelles sont libres, et surtout, il repère quand **deux appareils différents essaient d'utiliser la même boîte aux lettres** (un conflit d'adresse), ce qui casse la communication réseau des deux.

### Comment ça marche ?

**Le scanner réseau, en deux temps (comme un pompier qui inspecte un immeuble) :**

1. **Phase 1 — appel rapide à chaque porte** : le site "toque" (envoie un ping) à chaque adresse d'une plage donnée, avec jusqu'à 30 portes testées en même temps pour aller vite. Dès qu'une porte répond, le résultat s'affiche immédiatement à l'écran — pas besoin d'attendre que toutes les portes de l'immeuble aient été testées.
2. **Phase 2 — enquête plus poussée, seulement sur les portes qui ont répondu** : pour ces appareils-là seulement, le site essaie de deviner leur nom (comme lire la plaque sur la porte) et leur "numéro de série réseau" unique appelé adresse MAC (en regardant dans une sorte d'annuaire technique local, l'équivalent d'un carnet d'adresses du quartier).

**Pourquoi séparer en deux phases, et pas tout faire en une fois ?** C'est une leçon apprise en cours de route (racontée dans le mémoire) : au début, tout se faisait en une seule passe par adresse. Résultat : si la porte répondait mais que lire la plaque échouait, toute la ligne du tableau paraissait vide ou cassée, donnant une fausse impression de bug. En séparant "est-ce que ça répond" de "quel est le détail", chaque étape peut réussir ou échouer indépendamment, et l'utilisateur voit tout de suite au moins l'essentiel (la porte répond ou non), puis les détails arrivent progressivement.

**Le fil d'infos en direct (SSE)** : au lieu d'attendre que tout le scan soit fini pour afficher un tableau complet d'un coup, chaque résultat "coule" vers l'écran dès qu'il est prêt — comme les résultats d'une course qui s'affichent un par un sur un panneau, plutôt que d'attendre que tous les coureurs aient fini.

**Un vrai casse-tête résolu : la langue de Windows.** Selon que l'ordinateur est configuré en français ou en anglais, la commande "ping" de Windows n'affiche pas les mêmes mots (par exemple "temps=" en français contre "time=" en anglais). Le code doit donc reconnaître les deux façons d'écrire, sinon il se trompe sur le temps de réponse mesuré. C'est un détail auquel on ne pense pas avant d'y être confronté en vrai !

**La détection de conflit d'adresses** se fait directement dans la base de données : elle regroupe les adresses IP enregistrées et, si une même adresse apparaît plus d'une fois, elle la marque "en conflit" — un peu comme un logiciel de gestion d'un immeuble qui te signale automatiquement "attention, deux locataires sont enregistrés pour le même appartement !"

**Les sous-réseaux (les "quartiers")** : un réseau se découpe en sous-réseaux, comme une ville se découpe en quartiers, chacun avec sa propre plage de "boîtes aux lettres" possibles. Le module calcule automatiquement, à partir d'une plage donnée : où commence et finit le quartier, combien de boîtes il contient, combien sont déjà prises.

### Pourquoi c'est fait comme ça ?

Avant, ce suivi se faisait à la main dans des fichiers Excel partagés, avec tous les défauts que ça implique : quelqu'un oublie de mettre à jour la ligne, deux personnes utilisent la même adresse sans le savoir, personne ne détecte qu'un appareil inconnu vient de se brancher sur le réseau. L'objectif du module est de rendre ça automatique, visible en direct, et fiable, en éliminant complètement le travail manuel source d'erreurs.

---

## 6. Le module Équipements — l'inventaire du matériel

### Qu'est-ce que ça fait ?

C'est le grand registre du matériel de l'entreprise : chaque ordinateur, imprimante, téléphone IP, etc., avec son numéro de série, son type, et surtout, **où il en est dans sa vie** : encore au magasin (en stock) ou déjà donné à quelqu'un (en service).

### Comment ça marche ?

Un équipement n'a que deux grands états possibles, un peu comme un vélo en libre-service : **disponible au dépôt** ou **emprunté par quelqu'un**. Cette simplicité volontaire (seulement deux états) rend l'outil facile à comprendre même pour quelqu'un qui n'est pas technicien.

Quand on "donne" un équipement à un utilisateur, le site relie automatiquement cet équipement à la fiche de cette personne. Et si plus tard cette personne quitte l'entreprise ou est supprimée du système, **tous ses équipements repassent automatiquement en stock** — le site "range" tout seul le matériel comme si quelqu'un rendait ses affaires au vestiaire en partant, sans qu'un technicien ait à y penser manuellement.

**Une source de vérité unique.** Un bug rencontré pendant le développement, décrit dans le mémoire : parfois, une modification (par exemple assigner un ordinateur à quelqu'un) semblait fonctionner à l'écran, puis "revenait en arrière" toute seule après un rafraîchissement de page. La cause : le site se fiait parfois à une version temporaire gardée seulement dans le navigateur, au lieu de toujours se référer à ce qui est vraiment écrit dans la base de données. La solution a été de toujours forcer l'écriture immédiate en base de données à chaque action importante, et de toujours recharger l'état réel depuis la base au démarrage — un peu comme décider qu'un seul carnet fait foi (celui de l'armoire), et pas la mémoire de chacun.

### Pourquoi c'est fait comme ça ?

Pour éviter les doublons, les incohérences, et pour toujours savoir, en un coup d'œil, ce qui est réellement disponible pour un nouvel employé sans avoir à appeler quelqu'un pour vérifier "physiquement" dans un local de stockage.

---

## 7. Le module Utilisateurs — le lien avec l'annuaire de l'entreprise

### Qu'est-ce que ça fait ?

Ce module affiche la liste des employés avec leurs informations utiles (nom, service, groupes) — **directement copiées depuis l'annuaire officiel de l'entreprise**, pas ressaisies à la main.

### Comment ça marche ?

C'est le même principe de confiance que pour la connexion : MasterMonitor **ne invente jamais** un utilisateur, il va toujours chercher l'information officielle dans l'Active Directory, avec ce fameux compte de service en lecture seule. Ainsi, si un employé change de service ou quitte l'entreprise, ce n'est pas à MasterMonitor de le savoir en premier — c'est l'annuaire d'entreprise qui reste la référence, et MasterMonitor la reflète.

**Difficultés réelles rencontrées et corrigées :**
- **Les accents.** Certains prénoms/noms avec des caractères spéciaux (comme "é", "ç") étaient mal reconnus par l'annuaire à cause d'un encodage technique particulier, ce qui faisait échouer des connexions pourtant légitimes. Il a fallu ajouter une étape qui "décode" ces caractères correctement avant de chercher la personne.
- **Le format d'identifiant qui varie.** Selon la configuration du serveur, il faut parfois écrire un nom complet, parfois un identifiant court. Plutôt que de deviner à l'avance, le code essaie automatiquement plusieurs formats jusqu'à ce que l'un fonctionne — comme composer plusieurs variantes d'un numéro de téléphone jusqu'à tomber sur la bonne.
- **Les groupes parfois "vides" à première vue.** Si la première méthode pour lire les groupes d'un utilisateur ne donne rien, le code refait une recherche différente, en interrogeant cette fois les groupes eux-mêmes pour voir s'ils listent cette personne — comme demander directement au club "est-ce que telle personne est membre chez vous ?" plutôt que d'attendre que la personne le déclare elle-même.

### Pourquoi c'est fait comme ça ?

Pour éviter d'avoir "deux vérités" : les comptes de l'entreprise d'un côté, et une liste séparée dans MasterMonitor de l'autre, qui finirait fatalement par se désynchroniser. Un seul annuaire de référence = moins d'erreurs, moins d'administration en double.

---

## 8. Le module Supervision des serveurs — le docteur qui prend le pouls

### Qu'est-ce que ça fait ?

Ce module surveille en continu la "santé" des serveurs importants : est-ce qu'ils répondent, est-ce que leur processeur (CPU) est surchargé, est-ce que leur mémoire (RAM) ou leur disque dur est presque plein.

### Comment ça marche ?

Le site va chercher ces informations **à distance**, sans avoir besoin d'installer un logiciel spécial sur chaque serveur surveillé (ce qu'on appelle une approche "sans agent"). Il se connecte au serveur via une connexion sécurisée (SSH — le même principe qu'un technicien qui se connecterait à distance à une machine pour taper des commandes), lui pose directement les questions utiles, et récupère les réponses.

- **Pour les serveurs Linux** : le site lit directement des fichiers système standards qui contiennent en permanence l'état du processeur, de la mémoire et de l'espace disque — un peu comme consulter le compteur électrique d'une maison, toujours à jour, sans avoir à appeler quelqu'un.
- **Pour les serveurs Windows** : même connexion sécurisée (SSH), mais cette fois le site envoie une petite série de commandes PowerShell (encodées pour éviter les soucis de caractères spéciaux pendant le transport) qui posent les mêmes questions à la façon Windows.

**Une règle de statut à trois niveaux, pas juste "en marche / en panne" :** le site distingue "en ligne" (tout va bien), "avertissement" (le serveur répond au ping mais la collecte des mesures échoue — signe qu'il y a peut-être un souci), et "critique". C'est plus fin qu'un simple "ça marche / ça ne marche pas", et ça reflète mieux la réalité : un serveur peut très bien répondre à un ping tout en ayant un problème plus profond.

**Une évolution technique intéressante à raconter à l'oral : l'abandon de WinRM.** Le premier essai de supervision Windows utilisait une technologie appelée WinRM (une sorte de télécommande à distance native de Windows), mais elle causait des erreurs de connexion et des délais d'attente trop fréquents et peu fiables. La solution retenue a été de passer par SSH partout — la même méthode que pour Linux — ce qui simplifie aussi la maintenance (une seule méthode de connexion à comprendre et à dépanner, au lieu de deux).

**Un piège technique amusant : les gros disques durs.** Sur certains disques très grands, un outil utilisé pour lire la taille du disque "tronquait" (coupait) les très grands nombres, ce qui faussait complètement le calcul du pourcentage d'occupation — un disque presque vide pouvait sembler presque plein, ou l'inverse. Il a fallu changer la façon de lire ces nombres pour garder leur valeur complète.

### Pourquoi c'est fait comme ça ?

Une approche "sans agent" (rien à installer sur les serveurs surveillés) est plus simple à déployer et moins intrusive. Le choix de SSH plutôt que WinRM vient directement d'un problème réel rencontré en testant : fiabilité avant tout.

---

## 9. Le module Helpdesk — le suivi des tickets de support

### Qu'est-ce que ça fait ?

Quand un employé a un problème informatique, il le signale, et ça devient un "ticket" : une fiche qui suit ce problème depuis son signalement jusqu'à sa résolution, sans jamais se perdre en cours de route.

### Comment ça marche ?

Chaque ticket suit toujours le même parcours en cinq étapes, comme les étapes obligatoires d'un colis suivi à la poste :
1. **Ouvert** (`open`) — le problème vient d'être signalé
2. **En cours** (`in-progress`) — un technicien a commencé à regarder
3. **En attente** (`waiting`) — on attend une réponse ou une action extérieure
4. **Résolu** (`resolved`) — le problème est réglé
5. **Fermé** (`closed`) — le dossier est clos

**Chaque changement d'état est noté dans un historique séparé**, un peu comme le suivi postal d'un colis qui indique "parti de l'entrepôt", "en cours de livraison", "livré" avec l'heure de chaque étape. Ça permet de retracer plus tard le parcours complet d'un ticket, utile en cas de contrôle ou pour comprendre pourquoi un dossier a traîné.

**Les tickets urgents remontent en premier** : la liste des tickets est toujours triée pour montrer les plus critiques en haut, un peu comme aux urgences d'un hôpital où on ne traite pas forcément dans l'ordre d'arrivée, mais selon la gravité.

**Un bug particulièrement sournois, raconté dans le mémoire :** un technicien changeait le statut d'un ticket, ça s'affichait bien... puis, quelques minutes plus tard, ça revenait tout seul à l'ancien statut ! Ce n'était pas un bug dans la page des tickets elle-même, mais un effet secondaire d'un **autre composant** de l'appli (le chef d'orchestre `MainLayout.tsx`) qui, en envoyant régulièrement ses "photos" de mise à jour (voir la section sur les 3 vitesses), envoyait parfois une version un peu ancienne des tickets, qui écrasait discrètement la bonne valeur en base de données — un peu comme si deux personnes remplissaient le même registre en même temps, et que la version la plus lente écrasait par erreur celle de la personne la plus rapide.

**La solution a eu plusieurs volets :**
- Ne plus laisser ce composant "chef d'orchestre" envoyer les tickets dans ses photos globales (retirer la source du problème).
- Empêcher qu'une mise à jour partielle applique une valeur "par défaut" au statut si elle n'est pas explicitement précisée.
- Vérifier vraiment, côté base de données, qu'une ligne a été modifiée (avec un `RETURNING` + vérification du nombre de lignes changées) plutôt que de dire "succès" par optimisme.

### Pourquoi c'est fait comme ça ?

Le cycle en 5 étapes fixes évite les statuts "maison" inventés au fil de l'eau par chaque technicien (comme "en pause", "à revoir", etc.) qui rendraient les statistiques et le suivi incohérents. L'historique séparé garantit qu'on ne perd jamais la mémoire d'un changement, même après coup.

---

## 10. Le module Logs — le carnet de bord de toute l'application

### Qu'est-ce que ça fait ?

C'est la mémoire de tout ce qui se passe dans MasterMonitor : qui s'est connecté, qui a modifié quoi, quelles erreurs sont survenues, qui a tenté d'accéder à quelque chose sans droit. Un peu comme les caméras de surveillance et le registre des entrées/sorties d'un immeuble sécurisé, réunis en un seul endroit consultable.

### Comment ça marche ?

Chaque événement est classé dans une des **quatre catégories** suivantes :
- **Système** — erreurs internes, événements techniques (ex : un serveur devient injoignable)
- **Utilisateur** — connexions, déconnexions
- **Action** — quelqu'un a créé, modifié ou supprimé quelque chose (un ticket, un équipement...)
- **Sécurité** — tentatives d'accès refusées, connexions échouées

Chaque entrée note automatiquement : l'heure précise, qui a fait l'action, depuis quelle adresse réseau, ce qui a changé (avant/après), et sur quel élément.

**Une astuce technique : deviner l'adresse réseau même quand elle n'est pas donnée explicitement.** Le système essaie plusieurs pistes dans l'ordre pour retrouver l'adresse IP source d'un événement : d'abord l'adresse donnée explicitement, puis en cherchant dans les détails fournis, et en dernier recours en "fouillant" le texte de l'événement à la recherche d'un motif qui ressemble à une adresse IP. Comme un enquêteur qui, s'il n'a pas l'adresse écrite noir sur blanc, la déduit des indices disponibles.

**Deux "mémoires" pour ne jamais rien perdre :**
1. Une mémoire rapide en RAM (les 10 000 derniers événements), pour un affichage instantané.
2. Une écriture systématique en base de données PostgreSQL, pour que rien ne soit jamais vraiment perdu, même si le site redémarre.

**Un problème réel rencontré, très instructif pour l'oral : les logs qui disparaissaient.** Au début, les événements n'étaient affichés que dans la console technique du serveur (un peu comme parler dans le vide si personne n'écoute au bon moment) — pas sauvegardés du tout. Résultat : redémarrer le site effaçait tout l'historique. Puis, une fois passé à plusieurs copies du site tournant en parallèle (pour la haute disponibilité, voir plus loin), un **deuxième problème** est apparu : chaque copie du site gardait ses logs de son côté, donc un administrateur connecté sur la copie n°1 ne voyait pas les actions faites sur la copie n°2 — comme deux vigiles dans le même immeuble qui ne comparent jamais leurs carnets de notes.

**La solution :** écrire systématiquement, et tout de suite, chaque log dans la base de données PostgreSQL partagée — la même pour toutes les copies du site. Comme ça, peu importe quelle copie du site a traité l'action, tout le monde regarde le même carnet unique.

### Pourquoi c'est fait comme ça ?

Pour la conformité (pouvoir prouver "qui a fait quoi et quand" en cas de contrôle), pour le diagnostic technique (retrouver la cause d'un problème), et pour la sécurité (repérer des tentatives suspectes). Le fait que ça survive aux redémarrages et fonctionne pareil peu importe quelle copie du site a traité la demande est indispensable dès qu'on a plusieurs copies du site en fonctionnement (voir section HA).

---

## 11. L'export et le reporting

### Qu'est-ce que ça fait ?

Permet de télécharger les données du site (inventaire, adresses IP, utilisateurs, historique du support) sous forme de vrais fichiers Excel, prêts à être partagés ou archivés.

### Comment ça marche et pourquoi ce choix ?

La première version générait des fichiers CSV (texte brut séparé par des virgules). Problème : ouverts dans Excel en France, les accents devenaient illisibles et il fallait souvent régler manuellement le séparateur de colonnes — bref, un fichier "brut" à retravailler à chaque fois avant de pouvoir l'utiliser vraiment. La solution a été de générer directement de vrais fichiers `.xlsx`, avec des colonnes bien dimensionnées automatiquement et un nom de fichier qui inclut la date du jour — prêt à l'emploi, sans bidouillage.

---

## 12. Sécurité, droits d'accès et rôles

### Qu'est-ce que ça fait ?

S'assure que seules les bonnes personnes peuvent voir et modifier les informations sensibles du système d'information.

### Comment ça marche ?

Le rôle d'une personne (admin, manager, technicien, utilisateur) est déterminé automatiquement à la connexion, en fonction des groupes auxquels elle appartient dans l'annuaire d'entreprise — jamais saisi à la main. Actuellement, comme expliqué plus haut, seul le rôle administrateur peut effectivement se connecter.

**Deux failles trouvées lors de tests de sécurité, et corrigées :**

1. **Le contrôle "de façade".** Au départ, la vérification des droits se faisait surtout à l'écran, côté navigateur. Le souci : un utilisateur un peu malin pouvait bricoler son propre navigateur pour se faire passer pour un administrateur et voir des pages qu'il ne devrait pas voir — un peu comme si le seul contrôle pour entrer dans une zone VIP était un panneau que n'importe qui pourrait décrocher lui-même. La correction : déplacer ce contrôle **côté serveur**, avec un vrai "gardien" (`middleware.ts`) qui vérifie chaque demande de page avant même de commencer à la préparer, sans jamais se fier à ce que dit le navigateur du visiteur.

2. **La détection d'admin trop stricte.** Au départ, seul le groupe nommé exactement "Domain Admins" donnait les droits admin. Problème : dans une vraie organisation, les groupes s'imbriquent souvent les uns dans les autres, donc de vrais administrateurs légitimes se retrouvaient bloqués. La correction : une recherche plus intelligente qui suit aussi les groupes imbriqués et reconnaît plusieurs mots-clés liés à "administrateur", en français comme en anglais.

### Pourquoi c'est fait comme ça ?

Parce qu'un outil qui centralise autant d'informations sensibles (réseau, matériel, utilisateurs) doit absolument empêcher qu'une personne non autorisée y accède, même en contournant l'interface visuelle — la sécurité doit tenir même si quelqu'un triche avec son navigateur.

---

## 13. La haute disponibilité — pourquoi le site ne doit (presque) jamais tomber en panne

C'est une des parties les plus riches à raconter à l'oral, alors prenons le temps.

### Qu'est-ce que ça fait ?

L'idée centrale : **si une seule pièce de tout ce système tombe en panne, le site continue quand même de fonctionner.** Comme un magasin qui aurait deux caisses, deux vigiles et deux entrepôts, de sorte que si l'un des deux a un problème, les clients ne s'en aperçoivent presque pas.

### Comment ça marche ? (quatre étages de sécurité, indépendants les uns des autres)

**Étage 1 — La porte d'entrée unique et le partage de charge.**
Il n'existe qu'une seule adresse d'entrée pour les utilisateurs (une "adresse virtuelle", la VIP), mais elle est portée par deux machines différentes en coulisses. Une machine est désignée "principale" et porte cette adresse en temps normal ; l'autre surveille en permanence si la principale va bien. Si la principale ne répond plus après plusieurs vérifications de suite, l'adresse "bascule" automatiquement vers la machine de secours — en moins de 6 secondes, sans même que les utilisateurs le remarquent vraiment. C'est un peu comme un standard téléphonique d'entreprise : si la ligne principale tombe en panne, les appels basculent automatiquement vers une ligne de secours, sans que l'appelant n'ait à composer un autre numéro.

En plus, les demandes des utilisateurs sont réparties intelligemment entre les deux machines actives, en envoyant toujours vers celle qui est la moins occupée à cet instant — comme un supermarché qui dirige les clients vers la caisse la moins chargée.

**Étage 2 — Deux copies identiques de l'application.**
Le site tourne en double, dans deux "boîtes" Docker strictement identiques sur deux machines différentes. Si l'une plante ou ne répond plus, le "videur" à l'entrée (Nginx) s'en rend compte après quelques échecs et redirige automatiquement tout le monde vers l'autre copie — sans interruption visible pour les utilisateurs.

**Étage 3 — Deux annuaires d'entreprise, l'un de secours pour l'autre.**
Comme l'authentification et la recherche de noms passent par l'annuaire de l'entreprise (Active Directory), on a deux contrôleurs de domaine qui se synchronisent en permanence. Le site interroge le premier en priorité, et bascule automatiquement sur le second si le premier ne répond pas — comme avoir deux standardistes qui se tiennent mutuellement au courant de tout, de sorte que si l'un est absent, l'autre peut répondre à sa place sans rien perdre.

**Étage 4 — Deux bases de données, avec sauvegarde en trois couches.**
La base de données principale a une copie "miroir" qui se met à jour en continu, presque instantanément. Si la base principale tombe en panne, on peut "promouvoir" la copie miroir pour qu'elle prenne le relais en écriture.

En plus de ce miroir, il existe **trois filets de sécurité supplémentaires**, pensés pour des scénarios différents :
- Une **sauvegarde complète chaque jour à 2h du matin** (comme une photo générale de toute l'armoire, à garder une semaine).
- Une **sauvegarde physique chaque semaine** (une image complète du contenu, gardée un mois).
- Un **enregistrement en continu de chaque petite modification** (le "journal de transactions"), qui permet de revenir précisément à n'importe quel instant du passé si besoin — comme un historique de brouillons qui permettrait de revenir exactement à l'état d'un document juste avant une erreur, minute par minute.

### Pourquoi c'est fait comme ça ?

Un outil de supervision qui tombe lui-même en panne donne une **fausse impression de sécurité** — pire qu'aucun outil du tout, parce qu'on croit être surveillé alors qu'on ne l'est plus. L'objectif de cette architecture à quatre étages est qu'aucune panne isolée (un serveur, un annuaire, une base de données) ne puisse, à elle seule, rendre tout le système indisponible.

**Point honnête à mentionner à l'oral** : cette architecture a été testée et validée dans un environnement de laboratoire virtualisé (des machines virtuelles), pas encore en conditions de production réelles à grande échelle — c'est une distinction importante entre "j'ai prouvé que ça marche dans un cadre de test" et "c'est en production depuis des années", et il vaut mieux l'assumer clairement plutôt que de laisser penser l'un pour l'autre.

---

## 14. Le déploiement — comment le site arrive concrètement sur les serveurs

### Qu'est-ce que ça fait ?

C'est la mécanique qui permet de faire passer le code, écrit sur l'ordinateur du développeur, jusqu'à des machines qui tournent 24h/24 et sont accessibles à toute l'équipe.

### Comment ça marche ?

Il existe en réalité **deux façons différentes de déployer** le projet dans ce dépôt, ce qui vaut la peine d'être expliqué clairement à l'oral pour ne pas se mélanger les pinceaux :

**Méthode A — via Docker, avec un script de déploiement (`deploy.ps1`)** : le développeur construit la "boîte" Docker sur son propre PC, l'exporte dans un fichier, l'envoie sur le serveur par une connexion sécurisée, puis la fait démarrer là-bas. C'est un peu comme préparer un colis complet chez soi, puis l'envoyer et le faire ouvrir à destination.

**Méthode B — installation directe avec PM2 (dossiers `deploy/instance1` et `deploy/instance2`)** : ici, pas de "boîte" Docker ; le code est directement installé et démarré sur la machine, géré par un outil appelé PM2 dont le rôle est de garder l'application en vie (la relancer automatiquement si elle plante, la démarrer automatiquement si la machine redémarre). C'est la méthode réellement utilisée pour les deux instances de la configuration à haute disponibilité décrite plus haut. L'instance 2 installe en plus Nginx, le "videur/redirecteur" qui répartit les demandes entre les deux instances.

### Pourquoi deux méthodes différentes ?

Docker apporte une isolation et une reproductibilité parfaites (utile pour un déploiement simple, contenu), tandis que l'installation directe avec PM2 correspond à la mise en place réelle de l'architecture à haute disponibilité avec Nginx en frontal. Ce sont deux approches testées à des moments différents du projet, qui répondent à deux besoins un peu différents.

---

## 15. Comment tous ces modules se parlent entre eux — un exemple concret

Pour bien comprendre que MasterMonitor n'est pas juste "plusieurs pages côte à côte" mais un vrai système connecté, voici le parcours d'un problème classique, du début à la fin :

1. Un employé rencontre un souci et ouvre un **ticket** dans le module Helpdesk.
2. Le technicien ouvre la fiche du ticket. L'application va chercher automatiquement, sans que le technicien ait à naviguer ailleurs :
   - le profil complet de l'employé (module **Utilisateurs**, via l'annuaire),
   - l'équipement qui lui est physiquement attribué (module **Équipements**),
   - son adresse réseau exacte (module **IPAM**).
3. En même temps, le module **Logs** remonte les événements récents liés à cette même adresse réseau, pour aider à comprendre ce qui s'est passé juste avant le problème.
4. Une fois le problème réglé, le technicien ferme le ticket. Ce changement est immédiatement enregistré en base de données, et le **tableau de bord général** reflète tout de suite que la situation est redevenue normale.

Cette circulation d'informations entre modules — sans ressaisie, sans changer d'outil, sans appeler quelqu'un d'autre pour avoir un bout d'info manquant — c'est exactement la valeur ajoutée principale du projet par rapport à une collection de fichiers Excel séparés ou même à plusieurs logiciels du marché mal reliés entre eux.

---

## 16. Quelques points à connaître par cœur pour l'oral (les questions pièges probables)

- **"Pourquoi ne pas avoir acheté un outil du marché existant ?"** → Parce que les outils du marché (type Freshservice, Atera, SolarWinds) sont pensés pour gérer plusieurs clients différents à la fois (facturation par client, séparation stricte des données...) — une complexité inutile pour une seule entreprise interne. En plus, aucun ne propose une vraie gestion d'adresses IP (IPAM) intégrée nativement avec le support et l'inventaire ; il aurait fallu assembler plusieurs outils payants séparés.
- **"Le système gère 4 rôles, mais qui peut vraiment se connecter aujourd'hui ?"** → Seul le rôle administrateur peut se connecter actuellement (HTTP 403 pour les autres). Les rôles manager/technicien/utilisateur sont bien calculés à partir des groupes de l'annuaire, mais ne servent pas encore à filtrer l'accès — un point honnête à souligner si la question arrive : ce n'est pas encore un vrai système à plusieurs niveaux d'accès actifs.
- **"Pourquoi SSE et pas WebSocket pour le temps réel ?"** → Parce qu'un tableau de bord de supervision n'a besoin que de recevoir des informations, jamais d'en envoyer en retour par ce canal. SSE fait exactement ça, plus simplement à maintenir qu'un canal à double sens (WebSocket) qui serait plus complexe que nécessaire ici.
- **"Pourquoi les logs ne se perdaient pas au début, mais pouvaient devenir incomplets avec la haute disponibilité ?"** → Parce que chaque copie du site gardait initialement ses logs de son côté ; sans un point d'écriture commun (la base de données partagée), avoir plusieurs copies du site créait plusieurs carnets de bord séparés et incomplets.
- **"C'est vraiment prêt pour la production ?"** → Les fonctionnalités et l'architecture à haute disponibilité ont été validées en environnement de laboratoire virtualisé, avec des pannes simulées volontairement pour vérifier la bascule automatique. Ce n'est pas encore une mise en production réelle à grande échelle — c'est une preuve de concept solide et testée, pas encore un déploiement final.

---

## 17. Un mot de conclusion pour cadrer ta soutenance

Le fil rouge de tout le projet, c'est **la centralisation intelligente** : au lieu d'avoir des fichiers Excel, des outils différents et des informations éparpillées un peu partout, tout est réuni au même endroit, mis à jour automatiquement, et surtout **connecté entre lui** — l'IPAM parle à l'inventaire, qui parle aux utilisateurs, qui parlent au support, le tout sous surveillance d'un carnet de bord unique et protégé par une architecture qui refuse d'avoir un seul point de défaillance.

Chaque module, pris séparément, résout un problème concret et raconté (les Excel qui se contredisent, les conflits d'adresses IP, le matériel perdu de vue, les tickets qui traînent). Mais la vraie force du projet, celle qui mérite d'être mise en avant à l'oral, c'est que ces modules **ne sont pas juste posés côte à côte** : ils partagent la même base de données, le même système de connexion, le même carnet de bord — un système pensé comme un tout cohérent, pas comme une collection d'outils indépendants.
