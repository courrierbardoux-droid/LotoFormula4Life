# CDC (Cahier des Charges) — Fenêtre “utile” + pôle “Surreprésentation” (EuroMillions / Console)

## Informations
- **Projet** : LotoFormula4Life  
- **Module** : `frontend/client/src/pages/Console.tsx`  
- **Jeu** : EuroMillions (5 boules sur 50 + 2 étoiles sur 12)  
- **Date** : 2026-01-22  
- **Statut** : Brouillon (à compléter)

---

## 1) Contexte / intention

La Console propose un bouton de cycle qui fait défiler des **pôles** (modes de tri/lecture) pour l’affichage des boules/étoiles en mode simplifié :
- Normal (ordre numérique)
- Fréquence
- Tendance
- Dormeur

### Objectif global
- **(Tâche 1)** Déterminer la **fenêtre de temps “juste ce qu’il faut”** pour le pool “Fréquence” : ni trop longue (inertielle), ni trop courte (instable). Décider **fenêtre fixe** vs **fenêtre dynamique**.
- **(Tâche 2)** Ajouter un nouveau pôle **“Surreprésentation”** **entre** “Normal” et “Fréquence”, pour classer les numéros “au-dessus de l’attendu” sur une **fenêtre récente** (définie par la Tâche 1) et les afficher comme constat statistique exploitable.

---

## 2) Tâches (ordre d’exécution)

### Tâche 1 — Déterminer la fenêtre “utile” (Fréquence)

**But** : identifier **à partir de quelle date** (ou de **combien de tirages**) il devient inutile d’ajouter plus d’historique pour obtenir un classement “Fréquence” **stable** et **exploitable**.

#### Recalcul systématique après mise à jour de l’historique
À chaque fois qu’un nouveau tirage est ajouté et que la mise à jour de l’historique est faite/validée, **tous les calculs dépendants** de l’historique doivent être recalculés, notamment :
- recalcul des pools/tri (Fréquence, Tendance, Dormeur, etc.)
- recalcul de la détermination de fenêtre (fenêtre fixe) ou de la valeur de fenêtre (fenêtre dynamique)
- recalcul des indicateurs de stabilité utilisés pour valider la fenêtre (A/B/Top‑K)

#### 1.1 Principe — construction depuis le plus récent
On part des tirages les plus récents et on **ajoute progressivement du passé** (fenêtres croissantes).

Pour chaque taille \(N\) (ex : 50, 100, 150, … tirages), on calcule :
- **A (dispersion)** : \(\sigma(N)\) = écart-type des 50 comptes \(k_i(N)\) (ou fréquences) sur la fenêtre.
- **B (stabilité de classement)** : stabilité du rang entre \(N\) et \(N+\Delta\) via corrélation de rang **Spearman** \(\rho\).
- **Top‑K stable** : stabilité du Top‑K (ex : \(K=10\) ou \(K=12\)) entre \(N\) et \(N+\Delta\) (overlap).

#### 1.2 Définir le critère “utile”
On définit un seuil (à décider) et on prend le **plus petit** \(N^\*\) tel que, sur plusieurs pas consécutifs :
- \(\sigma(N)\) ne baisse plus que faiblement (ex : variation relative < 1–2%)
- \(\rho\) est très haut (ex : \(\rho \ge 0{,}95\) ou \(0{,}97\))
- l’overlap Top‑K est élevé et stable

Puis on convertit \(N^\*\) en **date de début \(t_0\)** (date du tirage situé à \(N^\*\) tirages avant la fin de période considérée).

#### 1.3 Validation par glissement — tester la même fenêtre à toutes les époques
Une fois une fenêtre candidate \(W\) trouvée (par exemple en années ou en nombre de tirages), on **glisse la même durée \(W\)** sur tout l’historique :
- Exemple conceptuel : si \(W=10\) ans sur ~25 ans d’historique, on obtient ~15 glissements (2004‑2014, 2005‑2015, …, 2015‑2025).
- À chaque glissement, on recalcule A/B/Top‑K et on vérifie si \(W\) reste **valide** (selon les seuils).

#### 1.4 Décision — fenêtre fixe vs fenêtre dynamique
- **Cas 1 — Fenêtre fixe** : si \(W\) est valide sur l’ensemble (ou quasi) des glissements, choisir une fenêtre fixe (simple, robuste).
- **Cas 2 — Fenêtre dynamique** : si on observe une **évolution structurée** (ex : la fenêtre requise s’allonge nettement au fil des années), alors :
  - déterminer une règle d’évolution **lente** (ex : +X mois/an, ou +Y tirages/trimestre)
  - proposer un mode **Fenêtre dynamique** (au moins pour le pool Fréquence)

**Note importante** : si la fenêtre est **fortement variable** ou **fortement augmentante**, le mode dynamique devient plus pertinent (la fenêtre fixe perd son sens pratique).

### Tâche 2 — Implémenter le pôle “Surreprésentation”
Cette tâche dépend du choix de fenêtre (fixe/dynamique) issu de la Tâche 1.

#### Recalcul systématique après mise à jour de l’historique
À chaque fois qu’un nouveau tirage est ajouté et que la mise à jour de l’historique est faite/validée, le pôle “Surreprésentation” doit être recalculé (score z, tri, labels), en utilisant la fenêtre (fixe ou dynamique) définie par la Tâche 1.

---

## 3) Objectifs fonctionnels (pôle Surreprésentation)
- **OF1** : ajouter un 5ᵉ état au cycle de tri : “Surreprésentation”.
- **OF2** : en mode “Surreprésentation”, trier boules (1‑50) et étoiles (1‑12) par un score de surreprésentation (défini section 5).
- **OF3** : calculer ce score sur la **fenêtre définie par la Tâche 1** (fixe ou dynamique), sans ajouter de réglages superflus en v1.
- **OF4** : afficher sur chaque boule/étoile un libellé lisible (au minimum le z‑score, ex : `z=+1.8`).
- **OF5** : ne pas modifier la logique des 4 pôles existants (pas de régression).

---

## 4) Emplacement UI à modifier (repérage)

Le bouton de cycle est dans `frontend/client/src/pages/Console.tsx`, section “Boules de 1 à 50” (mode simplifié), autour de la logique `simplifiedSortOrder`.

### Code repéré (extrait)
- État actuel : `useState<'numeric' | 'frequency' | 'trend' | 'dormeur'>('numeric')`
- Cycle actuel (onClick) : `numeric -> frequency -> trend -> dormeur -> numeric`
- Libellés : Numéros / Fréquences / Tendance / Dormeurs

---

## 5) Définition “Surreprésentation” (EuroMillions)

Le score vise à mesurer si, dans une fenêtre de **N** tirages, un numéro apparaît “plus souvent que prévu” par rapport au modèle nul d’un tirage équitable.

### 5.1 Notations
- **N** : nombre de tirages dans la fenêtre
- **kᵢ** : nombre de tirages (sur N) où le numéro i est sorti
- **p0** : probabilité théorique qu’un numéro apparaisse dans 1 tirage

### 5.2 Paramètres EuroMillions (modèle nul)
- **Boules** : \(p0 = 5/50 = 0{,}1\)
- **Étoiles** : \(p0 = 2/12 = 1/6 \approx 0{,}166666…\)

### 5.3 Score v1 : z‑score (écart standardisé)
Pour chaque numéro i (boule ou étoile), calculer :

```
z_i = (k_i - N*p0) / sqrt(N*p0*(1-p0))
```

Interprétation :
- \(z_i > 0\) : surreprésenté
- \(z_i < 0\) : sous‑représenté
- plus \(z_i\) est grand, plus l’écart à l’attendu est important (en unités d’écart‑type)

### 5.4 Classement demandé
- Trier décroissant par \(z_i\) (top = plus surreprésentés)
- (Option UI) permettre de visualiser la “queue” (z négatifs) sans changer le tri

### 5.5 Garde‑fou (stabilité)
Le score est instable quand \(N\) est trop petit. Définir **N_min** (ex : 60 ou 80 tirages) :
- si \(N < N_{min}\) : afficher un avertissement UI (et/ou griser le bouton), mais ne pas bloquer techniquement

---

## 6) Données disponibles et stratégie de calcul

Dans la Console, la fenêtre “High / Fréquences” est déjà filtrée via :
- `filterTirages(fullHistory, poolWindows.high)`
- puis `computeStatsFromTirages(filteredHigh)`

Les fréquences brutes sont déjà calculées :
- Boules : `stats.freqNumeros[i] = k_i`
- Étoiles : `stats.freqEtoiles[i] = k_i`

Donc pour la surreprésentation, il suffit de :
- récupérer **N = filteredHigh.length**
- récupérer **kᵢ** depuis `stats.freqNumeros` / `stats.freqEtoiles`
- appliquer la formule du z‑score (section 5.3)

---

## 7) Intégrations code attendues (v1)

### 7.1 Types / état UI
- Étendre `simplifiedSortOrder` pour inclure `surrepr` (ou `surrepresentation`)
- Ajuster le cycle du bouton :
  - `numeric -> surrepr -> frequency -> trend -> dormeur -> numeric`
- Ajuster les libellés :
  - Normal / Surreprésentation / Fréquences / Tendance / Dormeurs

### 7.2 Pools (tri)
- Ajouter un champ calculé `surreprZ` (boules + étoiles) sur les items de pool
- Ajouter un tri `bySurrepr` : décroissant sur `surreprZ`, puis fallback déterministe (par exemple numéro croissant)

### 7.3 Affichage (label)
- En mode Surreprésentation, `displayLabel` affiche `z=+X.Y` (arrondi 1 décimale)
- Vérifier que `BallGrid` et la grille étoiles n’affichent pas de label vide

### 7.4 Fenêtre de calcul
- Réutiliser la fenêtre issue de la Tâche 1 (fixe ou dynamique)

---

## 8) Critères d’acceptation (EuroMillions)
- Le bouton de cycle affiche 5 états et suit l’ordre : Normal -> Surreprésentation -> Fréquences -> Tendance -> Dormeurs -> Normal
- En mode Surreprésentation, boules et étoiles sont triées par z‑score décroissant
- Le label `z=...` apparaît à l’endroit prévu pour chaque boule/étoile
- Le calcul utilise \(N =\) nombre de tirages de la fenêtre High
- Aucune régression : Fréquences/Tendance/Dormeurs inchangés (mêmes tris et mêmes labels qu’avant)

---

## 9) Questions ouvertes (à trancher lors de l’implémentation)
- Choix exact du nom interne : `surrepr` vs `surrepresentation`
- Couleur UI pour distinguer clairement ce pôle (proposition : violet)
- Valeur de \(N_{min}\) (60 ? 80 ? 100 ?) + comportement UI si \(N\) trop petit
- Format du label : `z=+1.8` vs `+1.8 sigma`

---

## 10) Notes d’interprétation (intention produit)
Dans l’app, ce pôle est utilisé comme **constat statistique sur une fenêtre** : on considère qu’un numéro récemment surreprésenté est “intéressant à miser”.

Ce CDC formalise le calcul et l’intégration UI, sans chercher à prouver un biais causal.

