# 📘 GUIDE COMPLET : Gérer le Backend et NPM

## 🎯 Introduction

Ce guide vous explique **pas à pas** comment gérer votre application, le backend, NPM, et toutes les commandes nécessaires.

---

## 📁 Où se trouve votre projet ?


**Ce que ça fait :** Lance le **FRONTEND** (interface sur le port 5000)

**Comment l'utiliser :**
1. Ouvrez un **DEUXIÈME terminal** (oui, vous avez besoin de 2 terminaux)
2. Tapez : `cd frontend`
3. Tapez : `npm run dev:client`
4. Laissez ce terminal aussi ouvert !

**⚠️ IMPORTANT :** Vous devez avoir **2 terminaux ouverts en même temps** :
- Terminal 1 → `npm run dev` (backend)
- Terminal 2 → `npm run dev:client` (frontend)

---

## 💻 Partie 3 : Comment ouvrir un terminal (Windows)

### Méthode 1 : Depuis l'Explorateur de fichiers
1. Ouvrez l'Explorateur Windows (icône dossier dans la barre des tâches)
2. Allez dans : `C:\Projects\LotoFormula4Life\frontend`
3. **Clic droit** dans la barre d'adresse (où il y a écrit "frontend")
4. Cliquez sur **"Ouvrir dans le terminal"** ou **"Ouvrir PowerShell ici"**

### Méthode 2 : Depuis le menu Démarrer
1. Appuyez sur la touche **Windows** de votre clavier
2. Tapez : **"PowerShell"** ou **"Terminal"**
3. Appuyez sur **Entrée**
4. Dans le terminal, tapez : `cd C:\Projects\LotoFormula4Life\frontend`
5. Appuyez sur **Entrée**

### Méthode 3 : Depuis VS Code / Cursor
1. Dans Cursor, en haut du menu, cliquez sur **"Terminal"**
2. Cliquez sur **"Nouveau terminal"**
3. Le terminal s'ouvre automatiquement dans le bon dossier

---

## 🚀 Partie 4 : Démarrer l'application (ÉTAPES COMPLÈTES)

### Étape 1 : Ouvrir le premier terminal
- Ouvrez un terminal (voir Partie 3)
- Assurez-vous d'être dans le dossier `frontend`

### Étape 2 : Lancer le BACKEND
Dans le terminal, tapez :
```bash
npm run dev
```

**Vous devriez voir :** Des messages comme "Server listening on port 3000"

**⚠️ NE FERMEZ PAS CE TERMINAL !**

### Étape 3 : Ouvrir un DEUXIÈME terminal
- Ouvrez un **nouveau terminal** (voir Partie 3)
- Assurez-vous d'être dans le dossier `frontend`

### Étape 4 : Lancer le FRONTEND
Dans ce deuxième terminal, tapez :
```bash
npm run dev:client
```

**Vous devriez voir :** Des messages comme "Local: http://localhost:5000"

**⚠️ NE FERMEZ PAS CE TERMINAL NON PLUS !**

### Étape 5 : Ouvrir le site
1. Ouvrez votre navigateur (Chrome, Firefox, Edge, etc.)
2. Dans la barre d'adresse, tapez : `http://localhost:5000`
3. Appuyez sur **Entrée**
4. Le site devrait s'afficher !

---

## 🔄 Partie 5 : Arrêter l'application

### Méthode 1 : Arrêter proprement
1. Dans chaque terminal, appuyez sur **Ctrl + C**
2. Attendez que le terminal affiche un message de confirmation
3. Vous pouvez maintenant fermer les terminaux

### Méthode 2 : Forcer l'arrêt (si ça ne répond pas)
1. Fermez simplement les fenêtres de terminal
2. Les processus s'arrêteront automatiquement

---

## 🔍 Partie 6 : Voir les erreurs (LOGS)

### Dans les terminaux
Les messages qui s'affichent dans les terminaux sont appelés des **"logs"** (journaux).

**Types de messages :**
- ✅ Messages normaux (en blanc) → Tout va bien
- ⚠️ Messages d'avertissement (en jaune) → Attention, mais pas grave
- ❌ Messages d'erreur (en rouge) → Il y a un problème

### Comment lire les logs
Si vous voyez une erreur dans le terminal, elle ressemble généralement à :
```
❌ Erreur: ...
```

Ou :
```
Error: ...
```

**Si vous voyez une erreur :** Prenez une photo ou copiez le texte et montrez-le moi.

---

## 🛠️ Partie 7 : Commandes utiles supplémentaires

### `npm install`
**Quand l'utiliser :** Si je vous dis d'installer des dépendances
**Où :** Dans le dossier `frontend`
**Ce que ça fait :** Installe tous les packages nécessaires

### `npm run build`
**Quand l'utiliser :** Pour créer une version de production
**Où :** Dans le dossier `frontend`
**Ce que ça fait :** Compile le code pour la production

### `npx tsx script/nom-du-script.ts`
**Quand l'utiliser :** Si je vous dis de lancer un script de test
**Où :** Dans le dossier `frontend`
**Ce que ça fait :** Lance un script TypeScript directement

---

## ❓ Partie 8 : Problèmes courants

### Problème : "Port 3000 already in use"
**Solution :** Un autre programme utilise le port 3000. Fermez tous les terminaux et relancez.

### Problème : "Port 5000 already in use"
**Solution :** Un autre programme utilise le port 5000. Fermez tous les terminaux et relancez.

### Problème : "npm: command not found"
**Solution :** Node.js n'est pas installé. Contactez-moi pour l'installation.

### Problème : Le site ne se charge pas
**Vérifications :**
1. ✅ Les 2 terminaux sont-ils ouverts ?
2. ✅ Y a-t-il des erreurs dans les terminaux ?
3. ✅ Avez-vous bien tapé `http://localhost:5000` (pas 3000) ?

---

## 📝 Résumé rapide

**Pour démarrer :**
1. Terminal 1 → `cd frontend` puis `npm run dev`
2. Terminal 2 → `cd frontend` puis `npm run dev:client`
3. Navigateur → `http://localhost:5000`

**Pour arrêter :**
- Ctrl + C dans chaque terminal

**Pour voir les erreurs :**
- Regardez les messages dans les terminaux

---

## 🆘 Besoin d'aide ?

Si quelque chose ne fonctionne pas :
1. Prenez une photo de vos terminaux
2. Prenez une photo de l'erreur dans le navigateur (F12 → Console)
3. Montrez-moi les photos et je vous aiderai !

---

**Dernière mise à jour :** Aujourd'hui
**Version :** 1.0
