# Sauvegarde – avant élargissement volet chat +70px
**Date/heure :** 20260204-1739  
**Fichier :** `client/src/pages/Console.tsx`

## Ligne ~5552 – largeur du volet (actuelle)
```tsx
className="absolute top-0 right-0 bottom-0 w-full max-w-md bg-zinc-950 ...
```
`max-w-md` = 28rem = 448px. Remplacer par largeur 448+70 = 518px → `max-w-[518px]`.
