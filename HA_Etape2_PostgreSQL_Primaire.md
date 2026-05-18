# HA – Étape 2 : Intégration du PostgreSQL Primaire dans MasterMonitor
## Retour d'expérience – Problèmes rencontrés et solutions appliquées

**Projet :** MasterMonitor  
**Date :** Mai 2026  
**Contexte :** Migration de PostgreSQL local (Windows) vers une VM dédiée Debian, dans le cadre d'une architecture Haute Disponibilité (Primaire + Réplica).

---

Dans le cadre du projet MasterMonitor, nous avons entrepris la migration de la base de données PostgreSQL, jusqu'alors installée localement sur le poste de développement Windows, vers une machine virtuelle Debian dédiée. Cette migration s'inscrit dans une démarche de haute disponibilité visant à terme à disposer d'un serveur primaire actif et d'un réplica en standby, avec archivage des journaux de transaction et restauration automatisée. Ce document relate les difficultés rencontrées au cours de cette étape, les analyses effectuées et les solutions mises en œuvre.


## Premier problème – Une erreur inattendue lors de la configuration des droits dans psql

La première difficulté est apparue lors de la configuration des droits de l'utilisateur applicatif `mm_app`. En voulant enchaîner rapidement plusieurs commandes, nous avons copié-collé un bloc comprenant à la fois la commande de changement de base (`\c mastermonitor`) et les instructions SQL de type `GRANT`. psql a alors retourné le message d'erreur suivant : `invalid integer value "PRIVILEGES" for connection option "port"`.

Ce comportement s'explique par la nature même de la commande `\c` dans psql. Il s'agit d'une méta-commande, c'est-à-dire une instruction propre au client psql et non au moteur SQL. Lorsque plusieurs lignes sont collées simultanément, psql interprète la ligne immédiatement suivante comme un argument supplémentaire de `\c`, ce qui provoque une corruption de la commande. Le mot `PRIVILEGES` a ainsi été lu comme une valeur de port, d'où l'erreur.

La solution a été simple mais importante à retenir : ne jamais mélanger une méta-commande et des instructions SQL dans un même collage. La bonne pratique consiste à se connecter directement à la base cible depuis le shell en passant le paramètre `-d mastermonitor` à la commande `psql`, puis d'exécuter les instructions SQL dans un second temps. Une fois cette méthode appliquée, les GRANTs ont été exécutés sans erreur et confirmés par les messages attendus.


## Deuxième problème – Une incompatibilité de version lors de l'import du dump

La deuxième difficulté est survenue lors de l'importation des données. Le dump SQL avait été généré depuis PostgreSQL 18, la version installée sur le poste Windows, et devait être importé sur la VM qui, elle, tournait sous PostgreSQL 16. À l'exécution, psql a affiché l'erreur suivante : `ERROR: unrecognized configuration parameter "transaction_timeout"`.

Ce paramètre `transaction_timeout` est une nouveauté introduite à partir de PostgreSQL 17. PostgreSQL 16 ne le reconnaît pas et lève donc une erreur lorsqu'il le rencontre en début de fichier. Il est important de souligner que cette erreur est non bloquante : elle concerne uniquement une directive de configuration de session présente dans l'en-tête du dump, et n'affecte pas les données elles-mêmes. La suite de l'exécution l'a bien confirmé, avec une série de messages `COPY` indiquant que toutes les tables avaient été importées correctement, dont plus de 5 000 lignes de logs.

La leçon à retenir ici est qu'une migration entre deux versions de PostgreSQL différentes nécessite une attention particulière à la compatibilité. Idéalement, l'outil `pg_dump` devrait être celui de la version la plus basse pour éviter ce type d'incompatibilité de syntaxe. Dans notre cas, l'erreur étant bénigne, nous avons pu poursuivre sans impact sur l'intégrité des données.


## Troisième problème – Des erreurs HTTP 500 sur toutes les routes de l'API

Une fois l'application reconfigurée pour pointer vers la VM distante via la variable `DATABASE_URL`, plusieurs routes de l'API ont commencé à retourner des erreurs 500. Parmi elles, les endpoints `/api/tickets`, `/api/monitoring?view=store` et `POST /api/monitoring` étaient tous en échec. Le reste de l'application semblait fonctionner, ce qui indiquait que la connexion à la base était bien établie mais que quelque chose bloquait au niveau des requêtes SQL elles-mêmes.

L'analyse a rapidement permis d'identifier la cause : l'utilisateur `mm_app` n'avait aucun droit de lecture ni d'écriture sur les tables existantes. Cette situation découlait d'une subtilité importante de PostgreSQL concernant la gestion des privilèges. Lors de la mise en place de la base, la commande `ALTER DEFAULT PRIVILEGES` avait été exécutée. Or, cette commande ne s'applique qu'aux objets créés dans le futur par un utilisateur donné — elle ne touche pas aux tables qui existent déjà au moment de son exécution. Puisque le schéma avait été importé avant que cette commande soit lancée, toutes les tables étaient donc hors de portée de `mm_app`.

La solution a consisté à exécuter une commande différente, `GRANT ALL ON ALL TABLES IN SCHEMA public TO mm_app`, accompagnée de son équivalent pour les séquences. Cette commande, contrairement à `ALTER DEFAULT PRIVILEGES`, agit sur l'ensemble des tables existantes dans le schéma au moment de son exécution. Après application, la vérification via `\dp tickets` a confirmé que `mm_app` disposait bien des droits complets (`arwdDxt`), et les erreurs 500 ont immédiatement disparu.


## Quatrième problème – Les données disparaissaient à chaque reconnexion

Le dernier problème identifié était le plus visible pour l'utilisateur final : toutes les données de l'application — serveurs, équipements, tickets, utilisateurs — disparaissaient dès qu'on se déconnectait et se reconnectait. L'application semblait repartir de zéro à chaque session.

Deux causes distinctes ont été identifiées à l'issue de l'analyse.

La première était la plus évidente : la base de données sur la VM était entièrement vide. Si le schéma avait bien été importé, aucune migration des données existantes n'avait été réalisée depuis l'ancienne base locale. L'application chargeait donc son état initial depuis une base sans contenu, ce qui donnait l'impression d'un état vide permanent. Une vérification directe sur le serveur a confirmé que toutes les tables affichaient un compteur à zéro.

La seconde cause était un bug applicatif, plus discret. En examinant le code de `MainLayout.tsx`, nous avons constaté que la fonction `sendSnapshot`, chargée d'envoyer périodiquement l'état du store Zustand vers la base de données, ne transmettait jamais les tickets. Le store disposait bien de trois modes d'envoi — realtime, dynamic et static — mais aucun d'eux n'incluait les tickets dans son payload. Ces données vivaient donc uniquement en mémoire, sans jamais être persistées, et étaient perdues à chaque rechargement de page.

Pour résoudre la première cause, nous avons exporté les données de la base locale avec `pg_dump` en mode données uniquement, transféré le fichier sur la VM via `scp`, puis importé les données avec `psql`. Pour la seconde, la correction a été apportée directement dans le code en ajoutant les tickets au payload du mode `dynamic`, qui est envoyé toutes les trente secondes.


## Bilan

À l'issue de ces interventions, le serveur PostgreSQL primaire est pleinement opérationnel. L'application MasterMonitor communique avec la VM distante, les données sont correctement persistées entre les sessions, les tickets sont désormais sauvegardés régulièrement, et la base est configurée pour accueillir la réplication en streaming vers un futur serveur réplica. Cette étape a également été l'occasion de consolider plusieurs réflexes essentiels : distinguer les privilèges sur tables existantes des privilèges par défaut, anticiper les incompatibilités lors de migrations inter-versions, et s'assurer que chaque entité métier est couverte par le mécanisme de persistance de l'application.
