# Fenêtre significative Dormeur (retard / absence) – Raisonnement

## 1. Rôle du pôle Dormeur dans le jeu

Le pôle **Dormeur** sert à répondre à la question :

> “Quels numéros/étoiles sont *en retard* en ce moment ?”

Dans l’application, “Dormeur” n’est pas une fréquence (longue ou courte), ni une surreprésentation (niveau vs attendu), ni une tendance (direction).  
C’est un signal **instantané** basé sur la **dernière sortie**.

---

## 2. Définition opérationnelle (implémentation)

Le calcul actuel (dans `lotoService.ts`, via `calculerAbsences`) :

- Les tirages sont triés du plus récent au plus ancien.
- Pour chaque numéro/étoile :
  - **absence** = nombre de tirages depuis sa dernière sortie.
  - Si l’élément n’apparaît pas dans la fenêtre \(N\), l’absence est **cappée à \(N\)** (valeur max).

Ce score décrit bien un “retard actuel”.

---

## 3. Pourquoi la fenêtre \(N\) est différente des autres pôles

Pour Fréquence / Surreprésentation / Tendance, la fenêtre influence un calcul “moyenné” (classements, z-scores, ratios), donc on cherche une fenêtre **représentative** et **stable**.

Pour Dormeur, c’est différent :

- Si un numéro est sorti il y a 12 tirages, son absence est **12** (et ça ne dépend pas de \(N\) tant que \(N \ge 12\)).
- La fenêtre \(N\) sert surtout à éviter le cas “non-vu dans la fenêtre” (cap à \(N\)) qui crée :
  - des **ex-aequo** artificiels,
  - des classements “cassés” si \(N\) est trop petit.

Donc, pour Dormeur, la “bonne fenêtre” est avant tout une fenêtre **suffisamment grande** pour que l’absence reflète bien “depuis la dernière sortie” sur l’instant présent.

---

## 4. Critère “Top‑K dormeurs stable”

En pratique, on utilise Dormeur pour extraire un **pool** (Top‑K des plus gros retards).
Le critère opérationnel est donc :

- **Stabilité du Top‑K** : quand on fait varier légèrement \(N\), est-ce que la liste des “plus dormants” bouge beaucoup ?

Mais attention : comme l’absence est “instantanée”, dès qu’on a une fenêtre assez grande pour voir tout le monde au moins une fois, le Top‑K devient souvent **très stable** (par nature).

---

## 5. Presets (Strict / Standard / Souple / Dynamique)

Même philosophie d’interface que les autres pôles :

- **Souple** : fenêtre minimale “pratique” (plus courte, plus directe).
- **Standard** : compromis recommandé.
- **Strict** : marge de sécurité (un peu plus large).
- **Dynamique** : calcul auto (et borné) sur l’historique, qui peut parfois retomber sur Standard quand le système est stable.

### 5.1. Comment on calcule un Standard “utile”

Plutôt que de chercher une “stabilité de classement” (comme Fréquence), on cherche une fenêtre \(N^\*\) telle que :

- Sur les \(N^\*\) derniers tirages :
  - **toutes les boules 1..50 ont été vues au moins une fois**
  - **toutes les étoiles 1..12 ont été vues au moins une fois**

C’est la condition minimale pour éviter les caps artificiels à \(N\).

### 5.2. Dynamique

On recalcule \(N^\*\) sur plusieurs sous‑historiques (époques), puis on borne la valeur par quantiles.  
Si, sur l’historique actuel, tout est stable, **Dynamique peut être égal à Standard** (ce n’est pas une erreur : c’est un signal de stabilité).

