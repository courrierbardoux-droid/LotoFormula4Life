# Consignes de développement et tests

## 1. Connexion : identifiants non reconnus

Quand le backend utilise la **base de données** (`DATABASE_URL` définie), la connexion passe par la table `users` en base. Les identifiants "mock" (ADMINISTRATEUR / 123456) ne sont utilisés **que** si la base n’est pas connectée.

- **Si tu as une base connectée** : il faut que les mêmes utilisateurs existent en base. Pour cela, exécuter le **seed** une fois :
  - Dans un terminal (PowerShell ou Cursor), aller dans le dossier **frontend** du projet puis lancer :
    ```bash
    cd frontend
    npm run db:seed
    ```
  - Le seed crée notamment **ADMINISTRATEUR** (mot de passe **123456**), **cls**, **clp**, **TestINVITE**, etc. Après le seed, ces identifiants fonctionnent avec le backend sur le port 3000.
- **Si la base est vide** et que tu n’as pas lancé le seed : aucun utilisateur n’existe en base, donc la page ne peut pas te connecter même avec ADMINISTRATEUR / 123456.

## 2. Avant de lancer ou relancer les tests

Il faut **fermer toutes les anciennes instances** du backend et du frontend avant de relancer. Sinon :
- Le port 5000 peut rester pris par une ancienne instance de Vite → au prochain démarrage, Vite prend 5001 ou 5002.
- Tu te retrouves sur une autre URL (ex. `http://localhost:5002`) et tu peux avoir des doutes sur quel serveur répond.

### Où fermer ?

- **PowerShell** : chaque fenêtre PowerShell où tu as lancé `npm run dev`, `npm run dev:client` ou le backend (port 3000).
- **Cursor** : l’onglet **Terminal** intégré (Ctrl+ù ou View → Terminal), si tu y as lancé le backend ou le frontend.

En résumé : **tout terminal (PowerShell ou Cursor) où tourne actuellement le backend ou le frontend**.

### Comment fermer ?

1. **Dans le terminal concerné** : faire **Ctrl+C** pour arrêter le processus (backend ou Vite).
2. Si tu préfères : **fermer la fenêtre** (PowerShell ou l’onglet terminal dans Cursor).

Après avoir arrêté **toutes** les instances :
- Relancer le backend (port 3000) puis le frontend (port 5000), **ou**
- Lancer le fichier `.bat` sur le Bureau : *LotoFormula4Life - Demarrer (dev).bat*.

Tu seras alors bien sur **http://localhost:5000** (frontend) et le backend sur **http://localhost:3000**.

## 3. Résumé

| Problème | Action |
|----------|--------|
| "Le site ne reconnaît pas mes identifiants" (backend + frontend ouverts) | Vérifier que la base est connectée et lancer le **seed** une fois pour créer ADMINISTRATEUR / 123456 etc. en base. |
| Le site s’ouvre sur 5002 au lieu de 5000 | Fermer **toutes** les instances de Vite (Ctrl+C dans chaque terminal qui lance le frontend), puis relancer. |
| Avant chaque test / relance | Fermer backend + frontend dans **tous** les terminaux (PowerShell et Cursor), puis relancer le .bat ou les commandes. |
