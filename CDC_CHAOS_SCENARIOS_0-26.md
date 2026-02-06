# CDC — Scénarios CHAOS 0→26 (27 scénarios) + Mode d’emploi

## 1) Intention (en langage simple)

L’objectif de ce document est de formaliser une **graduation CHAOS** qui ne va plus de 0 à 10, mais de **0 à 26** (soit **27 positions**).

- **0** = le scénario où, selon nos signaux, un numéro est **le plus “probable”**.
- **26** = le scénario où le numéro est **le moins “probable”**.

Chaque position CHAOS correspond à une **combinaison “logique”** des 3 pondérations suivantes (dans l’ordre d’importance) :

1. **Fréquence** (signal principal)  
2. **Surreprésentation** (confirme/infirme la fréquence sur une fenêtre plus récente)  
3. **Tendance** (confirme/infirme “en ce moment”)

Règle systématique : **boules et étoiles confondues** (même philosophie, même logique, mêmes degrés).

---

## 2) Ce que signifie “les 3 signaux”

### 2.1 Fréquence (F) — le “rythme habituel”
La fréquence répond à : *« Sur la fenêtre High (Fréquences), est-ce que ce numéro sort souvent ? »*

### 2.2 Surreprésentation (S) — le “au-dessus de l’attendu”
La surreprésentation répond à : *« Sur une fenêtre plus récente, ce numéro sort-il **plus** que ce que la théorie “équitable” laisserait attendre ? »*

Dans l’app, on utilise un **z-score** (écart standardisé). Plus le z-score est grand, plus le numéro est “au-dessus de l’attendu”.

### 2.3 Tendance (T) — le “sens du mouvement”
La tendance répond à : *« En ce moment, est-ce que ce numéro est en train de monter, rester stable, ou baisser ? »*

Dans le code actuel, la tendance est classée selon un **ratio** (fréquence récente / fréquence attendue) :
- ratio > 1.2 → **hausse**
- ratio < 0.8 → **baisse**
- sinon → **stable**

---

## 3) Définition des 3 états par signal (3×3×3)

On conserve **27 scénarios** (3×3×3), mais en mode **pur calcul** :
- on ne fait **pas** de “paniers” fixes (ex : 17/17/16) pour sélectionner des numéros ;
- on calcule des **scores continus** (par numéro) puis le scénario ne fait que définir un **profil de pondération** (favoriser / neutraliser / pénaliser) pour chaque signal.

### 3.1 État Fréquence (F) = “comment on pondère la fréquence”
On définit 3 états : `F+` / `F0` / `F-`

- `F+` : **on favorise** la fréquence (signal principal)
- `F0` : **neutre** (la fréquence ne pousse ni ne freine)
- `F-` : **on pénalise** la fréquence (logique “contrariante”)

**Score continu recommandé (par numéro) :**
- Calculer une force de fréquence normalisée \(F_{score} \in [0..1]\) sur la fenêtre High, par exemple :
  - percentile/rang normalisé dans `byFrequency` (boules 1..50, étoiles 1..12)
  - ou bien une normalisation min/max des fréquences observées sur la fenêtre.

> Important : `F+ / F0 / F-` ne sont **pas** des tranches de rangs ; ce sont des **signes de pondération** appliqués à \(F_{score}\).

### 3.2 État Surreprésentation (S) = “comment on pondère le z-score”
On définit 3 états : `S+` / `S0` / `S-`

- `S+` : on favorise la surreprésentation (z-score élevé)
- `S0` : neutre
- `S-` : on favorise la sous-représentation (z-score faible / négatif)

**Score continu recommandé (par numéro) :**
- Calculer un score \(S_{score} \in [-1..+1]\) à partir du z-score, par exemple :
  - \(S_{score} = \tanh(z / zCap)\) avec `zCap` typiquement 2.0 à 3.0 (évite les extrêmes)
  - ou un clamp direct du z-score dans \([-zCap..+zCap]\) puis normalisation.

### 3.3 État Tendance (T) = “comment on pondère le mouvement”
On définit 3 états : `T↑` / `T→` / `T↓`

- `T↑` : on favorise les tendances montantes
- `T→` : neutre
- `T↓` : on favorise les tendances descendantes

**Score continu recommandé (par numéro) :**
- Utiliser la force de tendance existante et la normaliser en \(T_{score} \in [-1..+1]\), par exemple :
  - direction : `↑`=+1, `→`=0, `↓`=-1, modulée par un score 0..10 si disponible
  - \(T_{score} = direction \times \frac{trendScore}{10}\) (si `trendScore` existe)
  - sinon : \(T_{score} = direction\).

---

## 4) Ordre des scénarios (0→26)

Ta philosophie impose l’ordre de priorité :

1) **Fréquence d’abord**  
2) **Surreprésentation ensuite**  
3) **Tendance en dernier** (confirmation “maintenant”)

Donc l’ordre des scénarios est :

- `F+` avant `F0` avant `F-` (fréquence prioritaire)
- à fréquence égale : `S+` avant `S0` avant `S-`
- à (F,S) égal : `T↑` avant `T→` avant `T↓`

Interprétation “pur calcul” :
- `F+` signifie “le scénario donne un **poids positif** à \(F_{score}\)”
- `F0` signifie “poids 0”
- `F-` signifie “poids négatif”
(même logique pour `S` et `T`).

### 4.1 Formule d’index CHAOS (0..26)
On code chaque état en indices :
- F : `F+ = 0`, `F0 = 1`, `F- = 2`
- S : `S+ = 0`, `S0 = 1`, `S- = 2`
- T : `T↑ = 0`, `T→ = 1`, `T↓ = 2`

Alors :

```
CHAOS = F*9 + S*3 + T
```

Ce qui donne automatiquement **0..26** dans l’ordre “du plus fort au plus faible”.

---

## 5) Tableau des 27 scénarios (CHAOS 0..26)

Légende (profil de poids) :
- `+` = poids **positif**
- `0` = poids **nul**
- `-` = poids **négatif**

> Remarque importante : ce tableau est un **ordre logique** + un **profil de pondération**.  
> On calcule un score final par numéro (pas une sélection par paniers).

On peut coder les poids bruts comme suit :
- `F+` → \(w_F = +1\), `F0` → \(w_F = 0\), `F-` → \(w_F = -1\)
- `S+` → \(w_S = +1\), `S0` → \(w_S = 0\), `S-` → \(w_S = -1\)
- `T↑` → \(w_T = +1\), `T→` → \(w_T = 0\), `T↓` → \(w_T = -1\)

| CHAOS | F | S | T | \(w_F\) | \(w_S\) | \(w_T\) |
|------:|---|---|---|:------:|:------:|:------:|
| 0 | F+ | S+ | T↑ | +1 | +1 | +1 |
| 1 | F+ | S+ | T→ | +1 | +1 | 0 |
| 2 | F+ | S+ | T↓ | +1 | +1 | -1 |
| 3 | F+ | S0 | T↑ | +1 | 0 | +1 |
| 4 | F+ | S0 | T→ | +1 | 0 | 0 |
| 5 | F+ | S0 | T↓ | +1 | 0 | -1 |
| 6 | F+ | S- | T↑ | +1 | -1 | +1 |
| 7 | F+ | S- | T→ | +1 | -1 | 0 |
| 8 | F+ | S- | T↓ | +1 | -1 | -1 |
| 9 | F0 | S+ | T↑ | 0 | +1 | +1 |
| 10 | F0 | S+ | T→ | 0 | +1 | 0 |
| 11 | F0 | S+ | T↓ | 0 | +1 | -1 |
| 12 | F0 | S0 | T↑ | 0 | 0 | +1 |
| 13 | F0 | S0 | T→ | 0 | 0 | 0 |
| 14 | F0 | S0 | T↓ | 0 | 0 | -1 |
| 15 | F0 | S- | T↑ | 0 | -1 | +1 |
| 16 | F0 | S- | T→ | 0 | -1 | 0 |
| 17 | F0 | S- | T↓ | 0 | -1 | -1 |
| 18 | F- | S+ | T↑ | -1 | +1 | +1 |
| 19 | F- | S+ | T→ | -1 | +1 | 0 |
| 20 | F- | S+ | T↓ | -1 | +1 | -1 |
| 21 | F- | S0 | T↑ | -1 | 0 | +1 |
| 22 | F- | S0 | T→ | -1 | 0 | 0 |
| 23 | F- | S0 | T↓ | -1 | 0 | -1 |
| 24 | F- | S- | T↑ | -1 | -1 | +1 |
| 25 | F- | S- | T→ | -1 | -1 | 0 |
| 26 | F- | S- | T↓ | -1 | -1 | -1 |

---

## 6) Comment la Tendance “pèse” (0→10) sur le résultat

La graduation **TENDANCE** (le knob 0→10) ne doit pas “renverser” la fréquence. Elle doit :

- à **0** : n’avoir **aucun effet** (tendance ignorée)
- à **10** : avoir son **effet maximum**, mais **encadré** (elle départage, elle confirme, elle n’inverse pas tout)

### 6.1 Formule simple (pur calcul, capée)
On définit un facteur \(w \in [0..1]\) :

```
w = tendencyLevel / 10
```

On calcule un score final par numéro :

```
base =  aF * wF * F_score   +   aS * wS * S_score
trend = aT * w  * wT * T_score
score = base + clamp(trend, -cap*abs(base), +cap*abs(base))
```

avec :
- \(F_{score} \in [0..1]\) (fréquence normalisée)
- \(S_{score} \in [-1..+1]\) (surreprésentation normalisée)
- \(T_{score} \in [-1..+1]\) (tendance normalisée)
- \(w_F, w_S, w_T \in \{-1,0,+1\}\) issus du scénario CHAOS
- `aF, aS, aT` = coefficients fixes (ex : `aF=1.0`, `aS=0.4`, `aT=0.25`)
- `cap` = garde-fou (ex : `cap=0.25`)

### 6.2 Garantie importante (ta règle)
Même si `tendencyLevel = 10`, la tendance doit rester un **bonus de confirmation**. Donc on impose un **cap** :

- `|trend|` ne peut pas dépasser une fraction de `|base|` (ex : `cap = 0.25`).

En langage simple :  
> la tendance peut aider à départager deux numéros “proches”, mais ne doit pas faire gagner un numéro faible contre un numéro très fort.

---

## 7) Préparation de l’implémentation (liste précise, sans coder maintenant)

### 7.1 Console — passer CHAOS de 0→10 à 0→26
Dans `[frontend/client/src/pages/Console.tsx](frontend/client/src/pages/Console.tsx)` :
- augmenter le `max` du knob CHAOS à **26** (et adapter l’affichage/labels)
- adapter les endroits où `hazardLevel` est utilisé comme ratio (aujourd’hui souvent `hazardLevel/10`)
  - passer à `hazardLevel/26` pour garder un ratio 0..1
  - ou bien utiliser directement le scénario (cf 7.2)

**Points concrets à chercher dans `Console.tsx` (mots-clés) :**
- `const [hazardLevel, setHazardLevel] = useState(`
- `<RotaryKnob ... value={hazardLevel} ... max={10}`
- `hazardLevel / 10`
- `hazardLevel / 20`
- `hazardMultipliers = [ ... ]` (tableau calibré aujourd’hui pour 0→10)

### 7.2 Ajouter une fonction de mapping “niveau CHAOS → scénario”
Créer une fonction (dans `Console.tsx` ou un util dédié) :
- entrée : `hazardLevel` ∈ [0..26]
- sortie : `{FState,SState,TState}` selon la formule `CHAOS = F*9 + S*3 + T` (inversion simple)

**Inversion (très simple) :**
```
F = floor(CHAOS / 9)
reste = CHAOS % 9
S = floor(reste / 3)
T = reste % 3
```

Puis conversion en états :
- F : 0→`F+`, 1→`F0`, 2→`F-`
- S : 0→`S+`, 1→`S0`, 2→`S-`
- T : 0→`T↑`, 1→`T→`, 2→`T↓`

### 7.3 Appliquer le scénario à la sélection (boules + étoiles)
Pour chaque numéro (boules et étoiles) on doit pouvoir calculer :
- ses scores continus \(F_{score}, S_{score}, T_{score}\) (cf. section 3)
- le triplet de poids \((w_F,w_S,w_T)\) du scénario CHAOS (cf. tableau section 5)

Puis calculer un `score` final (cf. section 6) et sélectionner :
- soit les meilleurs scores (top N) ;
- soit un tirage pondéré par `score` (si tu veux garder de l’aléa contrôlé).

**Traduction directe dans le code (idée d’architecture) :**
- Créer une structure “par numéro” (boules et étoiles) qui expose :
  - `frequencyRank` (rang 1..50 ou 1..12 dans `byFrequency`)
  - `surreprZ` (déjà calculé dans le pool Surrepr)
  - `trendDirection` + `trendScore` (déjà calculés via `tendancesNumeros` / `tendancesEtoiles`)
- Calculer \(F_{score}, S_{score}, T_{score}\) **pour chaque numéro** (boules + étoiles).
- À partir de `hazardLevel` (0..26), obtenir \((w_F,w_S,w_T)\) via la décomposition CHAOS (section 7.2 + tableau section 5).
- Calculer `score` (section 6), puis :
  - trier par `score` décroissant (top N)
  - ou tirer aléatoirement avec une probabilité proportionnelle à `score` (aléa contrôlé).

### 7.4 Fenêtres : High / Surrepr / Tendance
Le scénario dépend de ces fenêtres (déjà paramétrables) :
- High (Fréquences)
- Surrepr (z-score)
- Trend (Tendance)

Donc à chaque mise à jour d’historique : recalcul complet des statistiques, comme déjà demandé dans les CDC.

---

## 8) Validation attendue (avant implémentation)

Avant d’écrire du code pour CHAOS 0→26, tu valides :
1) la définition des scores continus \(F_{score}, S_{score}, T_{score}\) (normalisations proposées)
2) l’interprétation des états comme **poids** (+/0/-) et le tableau 0→26
3) l’ordre 0→26 et la formule `CHAOS = F*9 + S*3 + T`
4) la règle “Tendance 0→10” (cap/coefficients) pour ne pas renverser la fréquence

