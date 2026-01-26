## CDC — Journal temps réel (Admin) + alertes gagnants

### 1) Contexte
Tu veux, côté **Administrateur**, une “main courante” (journal) listant **en temps réel** les actions des utilisateurs, en commençant par la priorité absolue : **tous les tirages / grilles enregistrées** (donc visibles dans “Mes grilles jouées”), quel que soit le statut (invité / abonné / VIP).

Le projet existe déjà avec :
- Une table `grids` (grilles jouées) : `userId`, `numbers`, `stars`, `playedAt`, `targetDate`, …
- Des endpoints qui écrivent dans `grids` via plusieurs chemins (direct, email, confirmation, etc.).
- Un écran admin “Gestion utilisateurs” et une page “détail utilisateur” (`/user/:userId`).

Décision UI (validée) :
- Dans le menu Admin, **Gestion utilisateurs** aura **2 sous-menus** :
  1) **Informations utilisateurs** → `/settings/users`
  2) **Historique des utilisateurs** → `/settings/users/history`

---

### 2) Objectifs

#### Objectif MVP (Phase 1 — priorité)
Créer une page admin **Historique des utilisateurs** accessible via :
- `/settings/users/history` (Admin only, accessible depuis le sous-menu “Gestion utilisateurs”)

Cette page affiche les **200 dernières** lignes d’événements “tirage/grille enregistrée” :
- **Une ligne par événement**
- **Ordre** : du plus récent au plus ancien (style feed)
- Colonnes (tout sur une ligne) :
  - **Heure** (serveur)  
  - **Identifiant** (cliquable → `/user/:userId`)  
  - **Numéros + étoiles**  
  - **Canal** : “avec email” vs “sans email”

Et la page se met à jour **en temps réel** via **SSE** (Server-Sent Events).

#### Objectifs ultérieurs (Phases 2–3)
- Journaliser aussi :
  - **Modifs de profil** : changement `username`, `email`, `mot de passe` (sans jamais stocker le mot de passe)
  - **Connexions / Déconnexions** via `login_history` (déjà en DB)
- **Alertes gagnants** au moment où le tirage officiel est mis à jour :
  - Email admin
  - Pop-up admin + son “machine à sous jackpot”
  - Liste des identifiants gagnants (cliquables vers détail utilisateur)
  - Ligne “WINNER_DETECTED” ajoutée au journal

---

### 3) Hors périmètre MVP (mais à garder en tête)
- Analyse “gagnant” en temps réel au moment où la grille est créée (pas fiable car dépend du tirage officiel).
- Historique complet infini (on commence à 200, avec filtrage/pagination plus tard).
- Tableau complet de toutes les actions (au début : seulement “grille enregistrée”).

---

### 4) Définition fonctionnelle — Phase 1 (Journal des tirages)

#### 4.1 Événement “grille enregistrée”
Un événement est ajouté au journal uniquement quand une grille est réellement enregistrée en DB dans `grids` (donc visible dans “Mes grilles jouées”).

Champs minimum d’un événement :
- `type`: `GRID_CREATED`
- `createdAt`: timestamp (heure serveur)
- `userId`
- `username` (snapshot au moment de l’événement, pratique pour affichage)
- `gridId` (si disponible)
- `numbers`: tableau (5 numéros)
- `stars`: tableau (2 étoiles)
- `targetDate` (optionnel, utile plus tard)
- `channel`: `email` | `direct`
  - `email` : quand l’enregistrement passe par le flux email/confirmation/invité send direct
  - `direct` : quand l’utilisateur enregistre directement sans email

#### 4.2 Temps réel via SSE
L’admin ouvre `/settings/users/history`.
- Le client récupère d’abord les **200 dernières** lignes (REST).
- Puis s’abonne au flux SSE (push) pour afficher immédiatement les nouvelles lignes.

Comportements attendus :
- En cas de refresh de page : l’admin revoit les **200 dernières** lignes (pas besoin de “rejouer des événements manqués” côté client).
- Tri : dernier événement en haut.

---

### 5) Proposition technique (Phase 1)

#### 5.1 Nouvelle table DB (proposée)
Ajouter une table dédiée, par exemple `activity_events` :
- `id` (serial)
- `type` (varchar) ex: `GRID_CREATED`
- `createdAt` (timestamp default now)
- `userId` (int, FK users)
- `usernameSnapshot` (varchar) (ou on joint `users` au moment de la lecture)
- `payload` (json) : `{ numbers, stars, targetDate, channel, gridId, ... }`

Pourquoi une table dédiée :
- Le journal doit être stable même si le schéma `grids` évolue.
- On peut y ajouter plus tard des types `PROFILE_UPDATED`, `LOGIN`, `LOGOUT`, `WINNER_DETECTED`.

#### 5.2 Accroches serveur (où loguer l’événement)
À chaque endroit où l’on insère dans `grids`, ajouter l’écriture d’un événement `GRID_CREATED`.
Exemples (à confirmer lors de l’implémentation) :
- `POST /api/grids` → `channel=direct`
- `GET/POST /api/draws/confirm/:token` → `channel=email`
- `POST /api/draws/send-direct` → `channel=email` (car email 2 est envoyé)

#### 5.3 API (proposée)
Admin only :
- `GET /api/admin/activity?limit=200` → retourne les 200 derniers events (du plus récent au plus ancien)
- `GET /api/admin/activity/stream` → SSE (text/event-stream)

Payload SSE :
- event: `activity`
- data: JSON d’un event

#### 5.4 UI (proposée)
Nouvelle page :
- `frontend/client/src/pages/UserActivityHistory.tsx`
- Route : `/settings/users/history` (admin only)

Affichage :
- Liste/table simple (monochrome), 1 ligne = 1 événement :
  - `HH:mm:ss` — `username` — `N: 1 2 3 4 5 | E: 1 2` — `avec email/sans email`
- `username` cliquable → `/user/:userId`

Navigation (UI) :
- Sous-menu **Gestion utilisateurs** :
  - **Informations utilisateurs** → `/settings/users`
  - **Historique des utilisateurs** → `/settings/users/history`

---

### 6) Phases suivantes (plan)

#### Phase 2 — Journal “profil” + connexions
1) Profil :
- Lors de `PATCH /api/profile/update`, créer un event `PROFILE_UPDATED` avec champs modifiés (ex: `changed: ["email","password"]`).
2) Connexions / déconnexions :
- Soit alimenter `activity_events` à partir des écritures dans `login_history`,
- soit lecture directe `login_history` puis affichage/agrégation par utilisateur sur “Détail utilisateur”.

#### Phase 3 — Alertes gagnants + job de mise à jour tirage officiel
Objectif :
- Détecter les gagnants **quand le tirage EuroMillions officiel est mis à jour**.

Déclenchement (à affiner) :
- Un job serveur (type cron interne) “force” vérifie **toutes les heures** si le fichier/flux officiel a un nouveau tirage.
- Quand un nouveau tirage est détecté :
  1) Mettre à jour `draws` (tirage officiel)
  2) Lancer `/api/history/check-winners` (ou intégrer la logique)
  3) Créer un event `WINNER_DETECTED` + détails (liste des users gagnants, date, gain…)
  4) Notifier l’admin :
     - Email admin
     - Pop-up admin + son jackpot + liste usernames cliquables

Note : tu veux aussi que “la console se mette à jour automatiquement dès le 1er utilisateur connecté le lendemain du tirage”.
- On peut le faire en plus (fallback) : au login/à l’ouverture console, si le dernier tirage connu est ancien, le serveur déclenche une vérification.

---

### 7) Critères d’acceptation (Phase 1)
- En tant qu’admin, je peux ouvrir `/settings/users/history`.
- J’y vois **les 200 derniers** tirages enregistrés (grilles jouées) **tous utilisateurs confondus**, triés du plus récent au plus ancien.
- Lorsqu’un utilisateur (invité/abonné/VIP) enregistre une nouvelle grille, une nouvelle ligne apparaît **immédiatement** sans refresh (SSE).
- L’identifiant est cliquable et ouvre le détail utilisateur.
- La ligne indique le **canal** : avec email / sans email.

---

### 8) Questions restantes (à trancher avant implémentation)
1) **Étoiles** : toujours affichées dans le MVP (recommandé) ?
2) **Heure** : format exact souhaité (HH:mm:ss) ? timezone = serveur ?
3) **Canal** :
   - “avec email” = uniquement les flux qui envoient effectivement l’email 2 ?
4) **Conservation** :
   - On garde combien de temps les events (ex: 90 jours) ou illimité ?

