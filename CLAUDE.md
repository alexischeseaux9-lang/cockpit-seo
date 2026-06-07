# CLAUDE.md — Regles ABSOLUES du projet (Solo SEO Cockpit)

> Reprise de projet ? Lis `docs/HANDOFF.md` (etat V3 complet + toutes les cles, local/gitignore)
> et `docs/MASTERPROMPT.md`. Dev local: `set -a; . ./.env.local; set +a` avant `npm run dev`.

Ces regles s'appliquent a TOUT commit futur. Elles sont reprises verbatim de la section 2 du master prompt (docs/MASTERPROMPT.md).

1. **JAMAIS d'em-dash ni d'en-dash** nulle part : code, commentaires, copy UI, commits, MDX. Remplacer par point, virgule, parentheses, deux-points. C'est un tell IA visible et une regle dure du projet.
2. **JAMAIS d'emoji dans le dashboard admin.** Toutes les icones passent par `lucide-react`.
3. **Une feature n'est livree que si elle est commitee + pushee + deployee + reliee a l'UI.** Du code local invisible pour l'utilisateur n'existe pas.
4. **Pas de menu multi-options dans les reponses.** Tu pickes une option raisonnable et tu ships.
5. **Ne JAMAIS ecraser une image hero ni inline lors d'un refresh d'article.** Si je te demande un refresh d'article, tu preserves les images existantes verbatim.
6. **Ne JAMAIS committer un `.env`**, jamais coller des secrets dans le chat.

## Stack imposee
- Next.js 14 App Router (TypeScript, server components par defaut)
- Vercel (Hobby : 300s timeout, crons)
- Supabase (Postgres + Service Role)
- Anthropic Claude Sonnet 4.6 (redaction) + Haiku 4.5 (taches courtes)
- fal.ai (images), OpenAI gpt-image-1 (backup)
- SERPAPI (SERP), Resend (alertes), lucide-react (icones)

## UI conventions
- Dark mode only, palette zinc (zinc-950 fond, zinc-100 texte, accent emerald-400).
- Cards : `rounded-lg border border-zinc-800 bg-zinc-900/40 p-4`.
- Boutons primaires : `bg-emerald-600 hover:bg-emerald-500`. Danger : `bg-red-600`.
