# Plan chat LotoFormula4Life – Complet (§1 et §3)

## §1 – Ce que font les chats type « plateforme connectée » (complet)

- **Liste des connectés** : affichage de qui est en ligne, avec identifiant (login). Clic sur un login ouvre la conversation avec cette personne.
- **Conversation 1-à-1** : fenêtre (ou zone) de discussion avec historique des messages, zone de saisie, boutons Envoyer et Effacer.
- **Zone de saisie** : champ texte, bouton **Envoyer**, bouton **Effacer** (vider le champ).
- **Transfert de fichiers** :
  - **Glisser-déposer** : l’utilisateur peut glisser un fichier sur la zone de chat (ou sur la zone de saisie) pour l’ajouter à la discussion et l’envoyer (avec ou sans message).
  - **Bouton « + »** : ouvre l’explorateur de fichiers ; l’utilisateur choisit un fichier dans un répertoire ; le fichier est ajouté à la discussion et peut être envoyé avec le message (ou seul).
- **Historique des messages** : bulles (moi / lui), ordre chronologique, défilement automatique en bas.
- **Indicateur « est en train d’écrire »** : trois points animés (•••) ou texte « X est en train d’écrire », mis à jour en temps réel.
- **Emojis / émoticônes** : style **WhatsApp** — grille d’emojis par catégories (visages, gestes, etc.), récents, choix d’un emoji qui est inséré dans le champ puis envoyé comme du texte. Pas seulement un picker générique : rendu et usage proches de WhatsApp.
- **Temps réel** : WebSocket pour envoi/réception instantanés, présence et typing.

---

## §2 – Rappel du besoin

- Clic sur le **login** d’un connecté → ouvrir la conversation avec cette personne.
- Taper des messages, boutons **Envoyer** et **Effacer**.
- **Fichiers** : glisser-déposer + bouton **+** (explorateur → choisir fichier → ajouter à l’envoi).
- Dans la page chat : tous les **connectés** avec leur **login**.
- **Emojis** façon WhatsApp (grille, catégories).
- **Trois points** qui défilent quand l’autre écrit.

---

## §3 – Architecture technique (complet)

### 3.1 Temps réel

- **WebSocket** (librairie `ws` déjà présente) attaché au serveur HTTP Express :
  - Même port : le serveur HTTP retourné par `app.listen()` est réutilisé pour les connexions WebSocket (événement `upgrade`).
  - Authentification : à la montée de connexion (`upgrade`), lecture du cookie de session, chargement de la session (store PostgreSQL ou mémoire), association de la connexion WebSocket à l’utilisateur (userId, username/login).
- **Événements côté serveur** :
  - **Présence** : à la connexion, enregistrement (userId, username) ; à la déconnexion, retrait. Diffusion de la liste des connectés à tous les clients (ou sur demande).
  - **Messages** : réception d’un message (expéditeur, destinataire, texte, éventuellement pièce jointe) ; stockage en mémoire (V1) ; envoi au destinataire s’il est connecté.
  - **Typing** : réception de `typing_on` / `typing_off` (avec destinataire) ; diffusion au destinataire ; expiration côté serveur (ex. 10–15 s) pour éviter indicateurs bloqués.
  - **Fichiers** : réception du message avec métadonnées de fichier (nom, type MIME, contenu en base64 ou référence) ; stockage temporaire ou en mémoire selon taille ; envoi au destinataire (lien ou contenu). Limite de taille à définir (ex. 5 Mo).
- **Côté client** : un seul client WebSocket par onglet ; à l’ouverture du volet chat, connexion si pas déjà connecté ; envoi des messages, typing, et réception des événements (liste connectés, nouveaux messages, typing, fichiers).

### 3.2 Données

- **Connectés** : structure en mémoire côté serveur : `Map<wsId, { userId, username }>`. Liste envoyée à chaque connexion/déconnexion à tous les clients (ou sur demande via un message `list_connected`).
- **Messages** : en mémoire (V1) : par paire d’utilisateurs (A, B), liste de messages `{ from, to, text, at, attachment? }`. Optionnellement persistance en base (phase ultérieure).
- **Typing** : pas de persistance ; événements éphémères ; timeout serveur (ex. 12 s) pour retirer l’indicateur si plus de signal.
- **Fichiers** : en V1, contenu en base64 dans le message (petits fichiers) ou stockage temporaire sur le serveur avec URL/lien ; limite de taille (ex. 2–5 Mo) et types autorisés (ex. images, PDF, documents courants).

### 3.3 Interface (volet chat)

- **Haut** : titre « CHAT » + bouton fermer (existant).
- **Liste des connectés** : zone scrollable, une ligne par utilisateur : **login** + indicateur « en ligne ». Clic sur un login → ouverture de la conversation avec cette personne dans le même volet (liste au-dessus, conversation en dessous).
- **Conversation ouverte** :
  - **Zone messages** : bulles (moi à droite, l’autre à gauche), ordre chronologique, scroll en bas. Messages avec pièce jointe : nom du fichier + icône ou aperçu selon type.
  - **Indicateur « en train d’écrire »** : sous les messages, trois points animés (•••) ou « **Login** est en train d’écrire ».
  - **Zone de saisie** :
    - **Champ texte** (textarea) pour le message.
    - **Bouton « + »** : ouvre l’explorateur (input file) ; fichier sélectionné ajouté à l’envoi (affiché en prévisualisation, possible de retirer). Envoi avec **Envoyer** (message + fichier ou fichier seul).
    - **Zone glisser-déposer** : la zone de saisie (ou la zone conversation) accepte le drop de fichiers ; même logique d’ajout à l’envoi.
    - **Bouton emojis** (style WhatsApp) : ouvre un panneau type grille par catégories (visages, gestes, etc.) ; clic sur un emoji → insertion dans le champ ; envoi avec Envoyer.
    - **Bouton Envoyer** : envoie le message (et les pièces jointes ajoutées).
    - **Bouton Effacer** : vide le champ de saisie et les pièces jointes en attente (pas de suppression des messages déjà envoyés).
- **Emojis** : librairie type `emoji-picker-react` avec thème/grille proche de WhatsApp (catégories, récents, peau). Un seul bouton (😀) qui affiche/masque le picker.

### 3.4 Sécurité et limites

- **Authentification** : chaque connexion WebSocket est liée à un utilisateur authentifié (session). Pas d’envoi de message sans utilisateur reconnu.
- **Fichiers** : taille max (ex. 5 Mo), types autorisés (whitelist), nom de fichier sanitisé ; pas d’exécution côté serveur.
- **Typing** : pas de persistance ; rate-limit léger pour éviter abus.

---

## §4 – Phases (inchangé)

| Phase | Contenu |
|-------|--------|
| A | Serveur WebSocket : connexion, liste connectés (login), messages 1-à-1 (mémoire), typing, support fichier (base64 ou stockage temporaire). |
| B | Front : liste connectés, clic → conversation, messages, saisie, Envoyer, Effacer, « + » (fichier), glisser-déposer fichier. |
| C | Indicateur « en train d’écrire » (trois points animés). |
| D | Emojis style WhatsApp (picker par catégories). |
| E | (Optionnel) Persistance des messages en base. |

---

## §5 – Points validés (inchangé)

- **Effacer** : vide le champ et les pièces jointes en attente uniquement.
- **Conversation** : dans le même volet (liste en haut, conversation en dessous).
- **Typing** : trois points animés ; délai ~2 s avant envoi de typing pour éviter clignotement.
- **Fichiers** : glisser-déposer + bouton « + » (explorateur) ; envoi avec le message ou seul.

---

## §6 – Résumé (inchangé)

- **Backend** : WebSocket (`ws`) sur le serveur HTTP ; présence, messages 1-à-1, typing, fichiers (taille/type limités).
- **Front** : volet chat avec liste des connectés (login), conversation (messages, pièces jointes), saisie + **Envoyer** + **Effacer** + **+** (fichier) + glisser-déposer + emojis WhatsApp + indicateur typing (•••).
