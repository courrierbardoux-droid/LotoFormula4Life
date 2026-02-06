# Fenêtre significative de Tendance – Raisonnement

## 1. Rôle de la Tendance dans le tableau des scénarios de probabilité

D’après le document *Scénarios de Probabilité* :

- **Colonnes** : Rang | Fréq. longue | Surrepr. courte | **Tendance** | Interprétation | Probabilité de sortir
- **Tendance** = haussière / stabilisée / baissière.
- **Usage** : elle sert à **filtrer ou pondérer** les candidats pour la “probabilité de sortir” :
  - **Très forte** (rangs 1–2) : Fréq. longue élevée + Surrepr. courte élevée + **Tendance haussière ou stabilisée** → “tous les signaux vont dans le sens présent, au-dessus de l’attendu, et prêt à continuer”.
  - **Forte** (3–5) : au moins deux des trois indicateurs favorables (long, court ou tendance).
  - **Faible à très faible** (13–26) : signaux défavorables dont **tendance baissière**.

La Tendance répond à la question : *“Ce numéro est-il, en ce moment, en phase de montée, stable ou en baisse ?”*  
Elle ne redouble pas la Surreprésentation courte (qui donne un **niveau** sur une fenêtre courte) : elle donne le **sens d’évolution** (hausse / stable / baisse).

---

## 2. Définition opérationnelle du calcul de Tendance

Le calcul actuel (`calculerTendances` dans `lotoService.ts`) :

1. **Fenêtre totale** = les `W` derniers tirages (où `W` est la fenêtre “Tendance” définie par `poolWindows.trend`).
2. **Période récente** = les `R` derniers tirages (**paramétrable** via `poolWindows.trend.trendPeriodR`).
3. Pour chaque numéro :
   - fréquence de référence sur `W` → proportion attendue sur `R` = `(freq_sur_W / W) * R`
   - fréquence réelle sur les `R` derniers
   - **ratio** = fréquence réelle / fréquence attendue
   - **étiquette** : ratio > 1,2 → haussière ; < 0,8 → baissière ; sinon → stabilisée.

Deux paramètres à calibrer objectivement :

- **W** = fenêtre totale Tendance (référence)
- **R** = période récente (sous-fenêtre comparée à la référence)

---

## 3. Contraintes de cohérence avec le tableau et les autres fenêtres

- La Tendance doit décrire l’évolution **“en ce moment”** → sa fenêtre doit rester dans l’échelle **récente**.
- Pour éviter de mélanger les échelles avec Fréq. longue (620) et pour s’aligner avec la Surrepr. courte (200) :
  - **W ≤ fenêtre courte** (200 tirages) est un choix naturel : même ordre de grandeur “récent” que la Surreprésentation courte.
- **R** doit être :
  - assez **petit** pour que “récent” soit vraiment le dernier mouvement,
  - assez **grand** pour que le ratio récent / attendu ait du sens (limiter le bruit des tout petits N).
- Bornes raisonnables : **R_min ≈ 15–20**, **R_max ≈ W/2** (sinon “récent” couvre déjà la moitié de la fenêtre).

---

## 4. Critère de “fenêtre significative” calculable

Pour la Fréq. longue et la Surrepr. courte, on utilise la **stabilité du classement** (ρ de Spearman, overlap Top-K) quand on ajoute Δ tirages.

Pour la Tendance, la grandeur pertinente n’est pas un classement mais le **sens** (haussière / stabilisée / baissière). Le critère objectif est donc :

- **Stabilité des étiquettes** : quand on décale un peu la fenêtre ou qu’on fait varier R (ou W), la proportion de numéros qui **gardent la même étiquette** (haussière, stabilisée, baissière) doit rester élevée.

Métriques possibles :

1. **Concordance (W, R) vs (W, R+δ)** : pour un δ fixe (ex. 5 ou 10), on compare les étiquettes de chaque numéro entre (W,R) et (W, R+δ). On exige un **% de concordance** ≥ seuil (ex. 85%).
2. **Concordance (W, R) vs (W+Δ, R)** : idem en faisant varier W.
3. **Validation par glissement** : on fait glisser une fenêtre de largeur W sur l’historique ; pour chaque position, on calcule les tendances (W,R) et on compare avec la fenêtre décalée de `step` tirages. On exige que sur une grande partie des glissements, la concordance reste au-dessus du seuil.

On choisit **(W*, R*)** = **plus petites valeurs** (W le plus petit, puis R le plus petit) telles que la concordance soit ≥ seuil sur **plusieurs pas consécutifs** (ex. 2), pour éviter les effets de bord.

---

## 5. Synthèse du raisonnement

| Élément | Choix |
|--------|--------|
| **Fenêtre totale W** | W ≤ 200 (alignée sur la fenêtre courte). Analyser W dans [50 .. 200] par pas de 10. |
| **Période récente R** | R ∈ [15 .. min(80, W/2)] par pas de 5. |
| **Grandeur de stabilité** | % de numéros gardant la même étiquette (haussière/stabilisée/baissière) entre (W,R) et (W, R+δ) ou (W+Δ,R). |
| **Seuil de concordance** | Ex. 85%. |
| **Règle de proposition** | Plus petit (W, R) tel que concordance ≥ 85% sur 2 pas consécutifs (en faisant varier R pour W fixe, ou W pour R fixe). |
| **Validation** | Glissement de la fenêtre sur l’historique : % de fenêtres où la concordance avec la fenêtre décalée dépasse le seuil. |

Une fois (W*, R*) trouvés :

- **Fenêtre significative Tendance** = **W\*** tirages (pour `poolWindows.trend`).
- Dans `calculerTendances`, la “période récente” est **R\*** (paramétrable via `poolWindows.trend.trendPeriodR`).

Cela garde la Tendance cohérente avec son usage dans le tableau (sens d’évolution “en ce moment”) et permet de la calculer de façon reproductible et vérifiable sur données.

---

## 6. Presets (Strict / Standard / Souple / Dynamique) — même philosophie que High & Surrepr

Comme pour les deux autres pôles, on propose **4 presets** pour la Tendance, mais ici la fenêtre est un **couple \((W,R)\)** :

- **W** = fenêtre de référence (tirages)
- **R** = période récente comparée à W (tirages)

### 6.1. Standard (référence projet)

- **Objectif** : stabilité suffisante sans “tuer” la réactivité.
- **Critère** (sur Boules *et* Étoiles) :
  - on calcule les étiquettes à \((W,R)\), \((W,R+5)\), \((W,R+10)\)
  - on mesure la concordance des étiquettes entre \((R \leftrightarrow R+5)\) et \((R+5 \leftrightarrow R+10)\)
  - **validité** = minimum de ces concordances (Boules/Étoiles) ≥ seuil (≈ 0,82)
- **Proposition** : plus petit W puis plus petit R satisfaisant le critère.
- **Choix UI** : on retient un **R “central”** (R+5) comme valeur affichée/stockée pour représenter la zone stable.

### 6.2. Souple (plus réactif)

- **Objectif** : “entendre” plus vite un changement de phase (au prix de plus de bruit).
- **Critère** simplifié :
  - stabilité uniquement sur un pas : \((W,R)\) vs \((W,R+5)\)
  - validité = concordance min (Boules/Étoiles) ≥ seuil (≈ 0,75)

### 6.3. Strict (plus robuste)

- **Objectif** : limiter les faux positifs dus à un petit changement de W/R.
- **Critère** :
  - même stabilité que Standard (sur \((R,R+5,R+10)\))
  - **+ robustesse à W** : stabilité quand on passe de \(W\) à \(W+10\) (à R “central”)
  - validité = (Standard OK) ET concordance(W → W+10) ≥ seuil (≈ 0,85)

### 6.4. Dynamique (auto)

- **Principe** : recalcule automatiquement \((W^\*,R^\*)\) selon le critère **Standard**, puis le borne (clamp) à partir d’une distribution estimée en “remontant dans le temps” (sous-historiques).
- **But** : rester stable dans le temps, sans empêcher une adaptation si l’historique récent change la structure.

## 7. Note sur la validation par glissement

Pour la Tendance, la validation par glissement avec un **pas de 30 tirages** peut donner un % de fenêtres “valides” très bas : on compare deux fenêtres décalées dans le temps, donc deux périodes “récentes” différentes. Le critère opérationnel principal reste la **concordance (W,R) vs (W,R+δ)** quand on varie R sur une même fenêtre W. Le glissement sert de contrôle complémentaire, pas de critère de validation aussi strict que pour Fréq. longue / Surrepr. courte.
