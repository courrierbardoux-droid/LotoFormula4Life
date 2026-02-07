# Sauvegarde complète – avant implémentation chat
**Date/heure :** 20260204-1826

## Fichiers modifiés (backups complets)
- **server/index.ts** → `backup_20260204_1826_avant_chat/server_index.ts`
- **server/routes.ts** → `backup_20260204_1826_avant_chat/server_routes.ts`
- **client/src/pages/Console.tsx** → `backup_20260204_1826_avant_chat/Console.tsx`
- **vite.config.ts** → `backup_20260204_1826_avant_chat/vite.config.ts`

## Plan de référence
- **docs/PLAN_CHAT_COMPLET.md** : §1 et §3 complets, transfert de fichiers (glisser-déposer + bouton « + »), emojis style WhatsApp, phases §4–§6.

## Fichiers créés (à supprimer pour revert)
- **server/chatWs.ts**
- **client/src/lib/chatSocket.ts**
- **client/src/components/chat/ChatPanel.tsx**
- Dépendance ajoutée : **emoji-picker-react**

## Restauration
Pour revenir en arrière : copier les fichiers depuis `backup_20260204_1826_avant_chat/` vers leur emplacement d’origine (server/index.ts, server/routes.ts, client/src/pages/Console.tsx, vite.config.ts), supprimer les fichiers listés ci‑dessus, et retirer emoji-picker-react du package.json si besoin.
