# CDC (Cahier des Charges) — Calcul de la fenêtre “utile” pour la Fréquence (EuroMillions / Console)

## Informations
- **Projet** : LotoFormula4Life  
- **Module** : `frontend/client/src/pages/Console.tsx`  
- **Jeu** : EuroMillions (5 boules sur 50 + 2 étoiles sur 12)  
- **Date** : 2026-01-22  
- **Statut** : Brouillon (à compléter)

---

## 1) Contexte / intention (en langage simple)

Dans LotoFormula4Life, le pôle **Fréquence** sert à répondre à une question simple :
> “Sur une période récente mais représentative, quels numéros sortent le plus souvent ?”

Le problème, c’est qu’une fenêtre de fréquence peut être :
- **trop petite** → on entend surtout le **bruit** (classement qui bouge sans arrêt)
- **trop grande** → on tombe dans le **silence** (classement trop “mou”, qui ne réagit plus au présent)

Objectif : trouver la fenêtre **entre pas de bruit et pas de silence**.

---

## 2) Objectif global

Déterminer automatiquement une **fenêtre de fréquence “utile”** :
- ni trop courte (instable / bruit)
- ni trop longue (inertielle / silence)

Et décider ensuite si on garde :
- une **fenêtre fixe** (ex : “X tirages” tout le temps),
- ou une **fenêtre dynamique** (la taille évolue lentement dans le temps si nécessaire).

---

## 3) Définition : c’est quoi une “bonne” fenêtre de fréquence ?

Une fenêtre de fréquence est dite “utile” si :
- le **classement** des numéros (du + fréquent au − fréquent) **ne change presque plus** quand on ajoute un peu plus d’historique,
- et le **Top** (les numéros “forts”) reste **stable**,
- tout en restant suffisamment “récente” pour rester pertinente (pas une moyenne sur 20 ans).

Autrement dit :
> On veut la plus petite fenêtre qui donne un classement stable.

---

## 4) Principe de calcul (idée générale)

On part des tirages les plus récents et on construit des fenêtres de plus en plus grandes :
- \(N = 50\) tirages, puis 75, puis 100, puis 125, etc.

À chaque étape, on mesure **si ajouter du passé change vraiment le classement**.

### Pourquoi “en nombre de tirages” plutôt qu’en “années” ?
Pour EuroMillions, compter en **tirages** est souvent plus robuste, car c’est directement le nombre d’observations statistiques.

---

## 5) Indicateurs de stabilité (ce qu’on mesure)

On calcule ces indicateurs séparément pour :
- **Boules** (1–50)
- **Étoiles** (1–12)

Puis on prend une décision finale (section 6).

### A) Stabilité du classement (l’ordre)
On compare le classement à \(N\) tirages et à \(N+\Delta\) tirages :
- indicateur recommandé : corrélation de rang **Spearman** \(\rho\)
- intuition : si \(\rho\) est proche de 1, l’ordre a très peu bougé.

### B) Stabilité du Top‑K (la “tête” du classement)
On regarde si les meilleurs numéros restent les mêmes quand on ajoute \(\Delta\) tirages :
- **Top‑K Boules** : exemple \(K=10\)
- **Top‑K Étoiles** : exemple \(K=4\)

Mesure simple : overlap (intersection / union) ou “combien sont identiques”.

### C) Gain marginal (est-ce que ça apporte encore quelque chose ?)
On veut détecter le moment où “rajouter du passé” n’apporte plus rien :
- si \(\rho\) est déjà très haut,
- si le Top‑K ne bouge plus,
- et si le classement est stable sur plusieurs étapes de suite,
alors la fenêtre est “utile”.

---

## 6) Règle de décision (comment on choisit N\*)

### 6.1 Paramètres à fixer (v1)
- **Pas \(\Delta\)** : ex 25 tirages (ou 50 si on veut aller plus vite)
- **Seuil Spearman** : ex \(\rho \ge 0{,}95\) (ou 0,97 si on veut très strict)
- **Top‑K stable** : ex “au moins 80% identique” sur 3 étapes consécutives
- **Nombre d’étapes consécutives** : ex 3 (pour éviter un hasard de stabilité sur un seul pas)
- **N_min** : une borne plancher (ex 80 tirages) pour éviter une fenêtre trop courte

### 6.2 Décision Boules vs Étoiles
Option recommandée (simple et robuste) :
- calculer \(N^\*_{boules}\) et \(N^\*_{étoiles}\)
- choisir \(N^\* = \max(N^\*_{boules}, N^\*_{étoiles})\)

Pourquoi : si les étoiles sont déjà stables mais pas les boules, on doit satisfaire le besoin des boules aussi.

### 6.3 Conversion “tirages → date”
Une fois \(N^\*\) trouvé :
- on récupère le tirage situé à \(N^\*\) tirages avant le dernier,
- et on obtient la **date de début** \(t_0\).

---

## 7) Fenêtre fixe vs fenêtre dynamique

### Fenêtre fixe (préférée si possible)
On choisit une valeur \(N^\*\) qui marche “presque partout”.

### Fenêtre dynamique (si nécessaire)
Si en glissant l’analyse dans le temps on observe que \(N^\*\) change beaucoup (ou augmente régulièrement) :
- on définit une règle **lente** d’évolution,
- et on applique cette règle automatiquement.

Exemples d’évolution lente (à valider) :
- +X tirages par an
- ou +Y tirages par trimestre

---

## 8) Recalcul systématique (règle produit)

À chaque nouveau tirage (historique mis à jour) :
- recalcul de la fenêtre fréquence \(N^\*\)
- recalcul du pôle Fréquence (tri/affichage)
- et plus généralement recalcul de ce qui dépend de l’historique

---

## 9) Intégration dans le code (repérage, sans coder ici)

Dans la Console, la fenêtre de Fréquence (High) est déjà basée sur un filtrage du type :
- `filterTirages(fullHistory, poolWindows.high)`
- puis `computeStatsFromTirages(...)`

Le calcul de \(N^\*\) doit donc :
- partir du même historique `fullHistory`
- tester plusieurs valeurs de \(N\) (fenêtres “tirages”)
- produire un résultat final :
  - soit un `customValue` (nombre de tirages) à appliquer à `poolWindows.high`
  - soit un mode “auto” (si on ajoute une option dédiée plus tard)

---

## 10) Critères d’acceptation

On considère que c’est réussi si :
- le système donne une **valeur de fenêtre** \(N^\*\) stable et cohérente (pas 20 tirages, pas 2000 par défaut)
- en pratique, le classement “Fréquence” cesse de bouger fortement quand on augmente \(N\)
- la fenêtre s’actualise après mise à jour d’historique (recalcul automatique)
- aucune régression sur les autres pôles (Tendance, Dormeur, etc.)

---

## 11) Questions ouvertes (à trancher)
- Valeur de \(\Delta\) (25, 50, 100 ?) : précision vs vitesse
- Seuil \(\rho\) (0,95 ou 0,97 ?)
- Valeur de K (Top‑K boules/étoiles) : 10/4 ? 12/4 ?
- Faut-il une fenêtre unique pour boules + étoiles (recommandé v1) ou séparée (plus fin) ?
- Affichage UI : doit-on montrer “Fenêtre fréquence = N tirages (auto)” quelque part ?

