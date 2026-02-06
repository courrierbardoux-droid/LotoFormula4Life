# Sauvegarde complète – avant suppression « Taille des pools »
**Date/heure :** 20260204-0014  
**Raison :** Restauration possible après suppression du tableau Taille des pools, sous-menu, page et code associé.

---

## 1. client/src/pages/SettingsPools.tsx (fichier entier – à supprimer)

```tsx
import React from "react";
import { SettingsPage } from "@/pages/Settings";

export default function SettingsPools() {
  return <SettingsPage mode="pools" />;
}
```

---

## 2. client/src/App.tsx (extraits modifiés)

**Import à retirer :**
```ts
import SettingsPools from "@/pages/SettingsPools";
```

**Route à retirer :**
```tsx
      <Route path="/settings/pools">
        <ProtectedRoute component={SettingsPools} />
      </Route>
```

---

## 3. client/src/components/layout/Navigation.tsx (extrait modifié)

**Dans les children du groupe Paramètres (admin), retirer la ligne :**
```ts
        { label: 'Taille des pools', path: '/settings/pools' },
```

---

## 4. client/src/pages/Console.tsx (bloc à retirer, lignes ~621-665)

```ts
  // --- POOL SIZE SETTINGS (Top N) ---
  const LS_POOL_SIZES_KEY = "loto_poolSizes_v1";
  const EVENT_POOL_SIZES_CHANGED = "loto:poolSizesChanged";
  type PoolSizeConfig = {
    balls: { high: number; trend: number; dormeur: number };
    stars: { high: number; trend: number; dormeur: number };
  };
  const [poolSizes, setPoolSizes] = useState<PoolSizeConfig>(() => {
    const fallback: PoolSizeConfig = {
      balls: { high: 25, trend: 25, dormeur: 25 },
      stars: { high: 8, trend: 8, dormeur: 8 },
    };
    try {
      const raw = localStorage.getItem(LS_POOL_SIZES_KEY);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Partial<PoolSizeConfig>;
      return {
        balls: {
          high: Math.min(50, Math.max(10, Number(parsed?.balls?.high ?? fallback.balls.high))),
          trend: Math.min(50, Math.max(10, Number(parsed?.balls?.trend ?? fallback.balls.trend))),
          dormeur: Math.min(50, Math.max(10, Number(parsed?.balls?.dormeur ?? fallback.balls.dormeur))),
        },
        stars: {
          high: Math.min(12, Math.max(4, Number(parsed?.stars?.high ?? fallback.stars.high))),
          trend: Math.min(12, Math.max(4, Number(parsed?.stars?.trend ?? fallback.stars.trend))),
          dormeur: Math.min(12, Math.max(4, Number(parsed?.stars?.dormeur ?? fallback.stars.dormeur))),
        },
      };
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem(LS_POOL_SIZES_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as PoolSizeConfig;
        if (!parsed?.balls || !parsed?.stars) return;
        setPoolSizes(parsed);
      } catch {}
    };
    window.addEventListener(EVENT_POOL_SIZES_CHANGED, handler as EventListener);
    return () => window.removeEventListener(EVENT_POOL_SIZES_CHANGED, handler as EventListener);
  }, []);
```

---

## 5. client/src/pages/Settings.tsx (modifications)

**Constantes à retirer (lignes 10-11) :**
```ts
const LS_POOL_SIZES_KEY = "loto_poolSizes_v1";
const EVENT_POOL_SIZES_CHANGED = "loto:poolSizesChanged";
```

**Type à modifier (ligne 33) :**  
Remplacer `export type SettingsMode = "all" | "pools" | "windows";` par :  
`export type SettingsMode = "all" | "windows";`

**States à retirer (lignes 167-171) :**
```ts
  // Save status is now for "Taille des pools" only (Tableau 2).
  // "Fenêtre de calcul" (Tableau 1) is auto-applied on change.
  const [poolSizesSaveStatus, setPoolSizesSaveStatus] = useState<SaveStatus>("saved");
  const [poolSizesSavePulseId, setPoolSizesSavePulseId] = useState(0);
  const [poolSizesSavePulseSource, setPoolSizesSavePulseSource] = useState<SavePulseSource>("apply");
```

**Type + default + state poolSizes (lignes 386-419) à retirer :**
```ts
  type PoolSizeConfig = {
    balls: { high: number; trend: number; dormeur: number };
    stars: { high: number; trend: number; dormeur: number };
  };

  const defaultPoolSizes: PoolSizeConfig = {
    balls: { high: 25, trend: 25, dormeur: 25 },
    stars: { high: 8, trend: 8, dormeur: 8 },
  };

  const [poolSizes, setPoolSizes] = useState<PoolSizeConfig>(() => {
    try {
      const raw = localStorage.getItem(LS_POOL_SIZES_KEY);
      if (!raw) return defaultPoolSizes;
      const parsed = JSON.parse(raw) as Partial<PoolSizeConfig>;
      const safe = {
        balls: {
          high: Math.min(50, Math.max(10, Number(parsed?.balls?.high ?? defaultPoolSizes.balls.high))),
          trend: Math.min(50, Math.max(10, Number(parsed?.balls?.trend ?? defaultPoolSizes.balls.trend))),
          dormeur: Math.min(50, Math.max(10, Number(parsed?.balls?.dormeur ?? defaultPoolSizes.balls.dormeur))),
        },
        stars: {
          high: Math.min(12, Math.max(4, Number(parsed?.stars?.high ?? defaultPoolSizes.stars.high))),
          trend: Math.min(12, Math.max(4, Number(parsed?.stars?.trend ?? defaultPoolSizes.stars.trend))),
          dormeur: Math.min(12, Math.max(4, Number(parsed?.stars?.dormeur ?? defaultPoolSizes.stars.dormeur))),
        },
      };
      return safe;
    } catch {
      return defaultPoolSizes;
    }
  });
```

**Fonction apply (lignes 560-568) à retirer :**
```ts
  const apply = () => {
    localStorage.setItem(LS_POOL_SIZES_KEY, JSON.stringify(poolSizes));
    window.dispatchEvent(new Event(EVENT_POOL_SIZES_CHANGED));

    toast.success("Taille des pools enregistrée.");
    setPoolSizesSaveStatus("saved");
    setPoolSizesSavePulseSource("apply");
    setPoolSizesSavePulseId((x) => x + 1);
  };
```

**Bloc JSX entier « TABLEAU 2: Taille des pools » à retirer** (de `{mode !== "windows" && (` jusqu’à `)}` inclus, lignes 893-1033) : tout le bloc contenant le titre « Taille des pools », les inputs Boules/Étoiles, boutons RESET/MAX, Fenêtres actives et bouton ENREGISTRER.

**Condition d’affichage Tableau 1 :** garder `{mode !== "pools" && (` tel quel (après suppression du type "pools", cette condition reste vraie pour "all" et "windows").

---

*Fin de la sauvegarde. Fichier généré automatiquement avant suppression du code « Taille des pools ».*
