# Sauvegarde – avant animation volet chat (glissement + hauteur console)
**Date/heure :** 20260204-1730  
**Fichier concerné :** `client/src/pages/Console.tsx`

## 1. État à conserver (ligne ~519)
```ts
const [isChatOpen, setIsChatOpen] = useState(false);
```
(Aucun autre state pour le chat pour l’instant.)

## 2. Wrapper console (ligne ~4219-4221)
```tsx
      {/* Wrapper for perfect centering */}
      <div className="w-full flex justify-center">
        <div 
          className="p-2 space-y-2" 
```

## 3. Panneau Chat actuel (lignes ~5524-5549) – position fixe, pas d’animation
```tsx
        {/* Panneau Chat (glisse depuis la droite) */}
        {isChatOpen && (
            <>
                <div 
                    className="fixed inset-0 bg-black/50 z-40" 
                    onClick={() => setIsChatOpen(false)} 
                    aria-hidden="true"
                />
                <div className="fixed top-0 right-0 h-full w-full max-w-md bg-zinc-950 border-l-2 border-casino-gold/50 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-50 flex flex-col">
                    <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                        <h2 className="font-orbitron text-lg text-casino-gold tracking-widest">CHAT</h2>
                        <button
                            type="button"
                            onClick={() => setIsChatOpen(false)}
                            className="w-10 h-10 rounded-full border-2 border-zinc-600 text-zinc-400 hover:border-casino-gold hover:text-casino-gold transition-colors flex items-center justify-center"
                            title="Fermer"
                        >
                            ×
                        </button>
                    </div>
                    <div className="flex-1 p-4 text-zinc-400 text-sm">
                        L'administrateur et les utilisateurs connectés apparaîtront ici.
                    </div>
                </div>
            </>
        )}
```

## 4. Fermeture du wrapper (lignes ~5550-5553)
```tsx
        </div>
      </div>
    </CasinoLayout>
```

---
*Sauvegarde pour revert : restaurer le state unique `isChatOpen`, le wrapper sans `relative`, et le panneau en fixed avec ce bloc JSX.*
