# Fenêtre Tendance – Explication en langage simple

Ce texte explique **sans formules, sans jargon** comment on choisit les « bonnes durées » pour la Tendance et ce que ça change dans l’app pour toi.

---

## À quoi sert la Tendance dans ton tableau ?

Dans ton tableau des scénarios (« Probabilité de sortir »), tu as trois colonnes utiles :

- **Fréq. longue** : est-ce que ce numéro sort souvent *en général* (sur une longue période) ?
- **Surrepr. courte** : est-ce qu’il sort beaucoup *en ce moment* (sur une période récente) ?
- **Tendance** : est-ce qu’il est *en train de monter*, *stable*, ou *en train de baisser* ?

La Tendance ne dit pas **combien** il sort (ça, c’est Surrepr. courte). Elle dit **dans quel sens ça bouge** : ça monte, ça reste pareil, ou ça descend.

---

## L’idée en une image : la météo

Imagine que tu regardes la météo pour savoir si « ça se réchauffe en ce moment ».

- Tu pourrais regarder **toute l’année** : tu verrais une moyenne, mais pas si *là, tout de suite*, il fait plus chaud qu’avant.
- Ou regarder **seulement les 3 derniers jours** : tu aurais une idée « tout récente », mais trop peu de jours, donc un peu au hasard.

Ce qu’on fait pour la Tendance, c’est pareil : on compare  
**« les X derniers tirages »** (ta « période récente »)  
à  
**« les Y derniers tirages »** (ta « fenêtre de référence »),  
avec X plus petit que Y.

- **Y** = « sur combien de tirages tu te bases pour dire “en général, ce numéro sort à telle fréquence” » → c’est la **fenêtre Tendance** (les **W** tirages, ex. 160).
- **X** = « sur combien de tirages tu regardes *tout récent* pour voir si ça monte ou ça baisse » → c’est la **période récente** (les **R** tirages, ex. 65).

En gros :  
**« Sur les 160 derniers tirages, ce numéro sort en moyenne à tel rythme. Sur les 65 tout derniers, il sort plus, pareil, ou moins que ce rythme ? »**  
→ Plus = haussier, pareil = stable, moins = baissier.

---

## Pourquoi 160 tirages pour la fenêtre Tendance ?

- Si la fenêtre est **trop courte** (ex. 30 tirages), tu changes d’avis à chaque petit rien : c’est instable, on ne peut pas s’y fier pour ton tableau.
- Si elle est **trop longue** (ex. 600 tirages), tu parles de « il y a longtemps » plus que de « en ce moment » : ce n’est plus vraiment une *tendance récente*.

**160 tirages**, c’est une durée pour laquelle, quand on décale un tout petit peu la période (par ex. « les 65 derniers » vs « les 70 derniers »), les réponses **resteront à peu près les mêmes** : haussier, stable ou baissier ne change pas à chaque fois.  
Donc on considère que c’est une fenêtre **assez fiable** pour dire « en ce moment, ça monte / ça reste pareil / ça baisse ».

En vulgarisant : **160 = la longueur de la « bande de temps » qu’on regarde pour décider si un numéro est en forme « en ce moment »**, sans que ce soit ni trop court (trop nerveux) ni trop long (trop vieux).

---

## Pourquoi 65 tirages pour la « période récente » ?

La « période récente », c’est : **les combien de tout derniers tirages on regarde pour voir si ça monte ou ça baisse**.

- **Trop peu** (ex. 10–20) : un ou deux tirages changent tout → encore une fois, trop instable.
- **Trop beaucoup** (ex. 100 sur une fenêtre de 160) : « récent » = presque toute la fenêtre → tu ne compares plus vraiment « récent » vs « avant », donc la tendance perd son sens.

**65 tirages**, c’est une longueur pour laquelle :  
si tu passes de « les 65 derniers » à « les 70 derniers », ou de « les 65 derniers » à « les 60 derniers », ta conclusion (hausse / stable / baisse) **reste la même** pour la plupart des numéros.  
Donc on considère que **65 = une bonne taille pour « les tout derniers tirages »** quand la fenêtre fait 160.

En une phrase : **65 = « combien de tout derniers tirages on regarde pour dire : là, ce numéro est en train de monter, de rester stable ou de baisser »**.

---

## Ce que ça change dans l’app pour toi (sans parler de code)

Aujourd’hui, en coulisses, l’app utilisait souvent :

- une fenêtre Tendance un peu « au doigt mouillé » (pas calibrée comme les autres fenêtres) ;
- une « période récente » fixée à **30** tirages.

Pour être cohérent avec le raisonnement qu’on vient de vulgariser :

1. **Fenêtre Tendance**  
   On peut configurer l’app pour qu’elle utilise **160 tirages** comme « bande de temps » pour la Tendance (comme pour la météo : « sur les 160 derniers tirages, on voit si ça monte ou ça baisse en ce moment »).

2. **Période récente**  
   On remplace le **30** par **65** : quand on calcule « haussier / stable / baissier », on compare **les 65 tout derniers tirages** à la moyenne sur les 160 derniers, au lieu de comparer seulement les 30 derniers.

Résultat pour toi :  
**les libellés « Tendance haussière / stabilisée / baissière » dans ton tableau des scénarios reposent sur des durées plus cohérentes et un peu plus stables** – sans que tu aies à faire des calculs : c’est juste « l’app regarde sur 160 tirages et compare avec les 65 tout derniers » au lieu de « 30 derniers » dans l’ancien réglage.

---

## Résumé en trois phrases

- **Fenêtre Tendance (160)** = « Sur combien de tirages on se base pour juger si un numéro est “en forme en ce moment”. »  
- **Période récente (65)** = « Combien de tout derniers tirages on regarde pour dire : là, il monte, il stagne ou il baisse. »  
- **Dans l’app** : on règle la Tendance pour utiliser 160 et 65 au lieu des anciennes valeurs, afin que ta colonne « Tendance » dans le tableau des scénarios soit plus fiable et alignée avec Fréq. longue et Surrepr. courte.

---

## Comment on obtient « haussier / stable / baissier » (sans formules)

Pour chaque numéro, on fait deux comptages :

1. **Sur les 160 derniers tirages** : combien de fois ce numéro est sorti → ça donne son « rythme habituel » sur cette période.
2. **Sur les 65 tout derniers tirages** : combien de fois il est sorti → ça donne son « rythme tout récent ».

Ensuite on compare :

- Si, sur les 65 derniers, il sort **clairement plus** que ce que son rythme sur 160 laisserait attendre → **haussière** (il « monte »).
- Si, sur les 65 derniers, il sort **clairement moins** → **baissière** (il « descend »).
- Si c’est **à peu près pareil** → **stabilisée** (il « reste sur sa lancée »).

Donc : **haussière** = « en ce moment il sort plus que sa moyenne récente » ; **baissière** = « en ce moment il sort moins » ; **stabilisée** = « en ce moment c’est dans la norme ». Aucune formule à retenir : juste « on compare les 65 tout derniers à la moyenne sur les 160 ».
