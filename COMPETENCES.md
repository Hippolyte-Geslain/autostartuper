# Compétences & connaissances — AutoStartUper

> Journal des sujets abordés sur ce projet. Règles : `../Competences/REFERENTIEL.md`.
> Exhaustif et append-only : tout sujet abordé figure ici, même effleuré.

**Projet** : Application web qui transforme la réglementation française de la micro-entreprise (URSSAF, CFE, plafonds, TVA) en une liste d'actions datées et pré-remplies, à partir de règles versionnées en YAML sourcées sur service-public.fr.
**Rôle** : Concepteur et pilote du projet — j'ai défini le produit et ses invariants, découpé les milestones, dirigé et relu l'implémentation faite en binôme avec Claude Code, et porté les 49 commits.
**Période** : 2026-08 → 2026-08
**Stack principale** : TypeScript, Next.js 16 (App Router), React 19, Zod 4, YAML, Vitest, GitHub Actions
**Dernière mise à jour du journal** : 2026-09-07

---

## Index

| Sujet | Cat. | Niv. | Co-réal. | 1re fois | Dernière | Fiche |
|---|---|---|---|---|---|---|
| Moteur de règles pur et déterministe | archi | N3 | copilote | 2026-08-09 | 2026-08-12 | [↓](#moteur-de-règles-pur-et-déterministe) |
| Règles métier comme données YAML | archi | N3 | copilote | 2026-08-07 | 2026-08-12 | [↓](#règles-métier-comme-données-yaml) |
| Zod 4 et validation runtime | outil | N3 | copilote | 2026-08-07 | 2026-08-12 | [↓](#zod-4-et-validation-runtime) |
| TypeScript | langage | N2 | copilote | 2026-08-07 | 2026-08-25 | [↓](#typescript) |
| Next.js 16 App Router | framework | N2 | copilote | 2026-08-07 | 2026-08-12 | [↓](#nextjs-16-app-router) |
| React 19 et persistance locale | framework | N2 | copilote | 2026-08-12 | 2026-08-12 | [↓](#react-19-et-persistance-locale) |
| Vitest et personas golden | outil | N2 | copilote | 2026-08-07 | 2026-08-12 | [↓](#vitest-et-personas-golden) |
| GitHub Actions | infra | N3 | copilote | 2026-08-12 | 2026-08-25 | [↓](#github-actions) |
| API recherche-entreprises et SIREN | outil | N2 | copilote | 2026-08-12 | 2026-08-12 | [↓](#api-recherche-entreprises-et-siren) |
| Veille des sources officielles | archi | N3 | copilote | 2026-08-12 | 2026-08-25 | [↓](#veille-des-sources-officielles) |
| Réglementation du micro-entrepreneur | metier | N3 | copilote | 2026-08-09 | 2026-08-25 | [↓](#réglementation-du-micro-entrepreneur) |
| Méthode spec puis plan puis amendements | methode | N3 | copilote | 2026-08-07 | 2026-08-13 | [↓](#méthode-spec-puis-plan-puis-amendements) |
| Arithmétique monétaire en centimes | methode | N2 | copilote | 2026-08-09 | 2026-08-12 | — |
| Unions discriminées et types résultat | langage | N2 | copilote | 2026-08-09 | 2026-08-12 | — |
| Manipulation de dates ISO et calendrier | langage | N2 | copilote | 2026-08-09 | 2026-08-12 | — |
| API Intl (fr-FR, fuseau Europe/Paris) | langage | N2 | copilote | 2026-08-12 | 2026-08-12 | — |
| Route Handlers Next.js (API serveur) | framework | N2 | copilote | 2026-08-12 | 2026-08-12 | — |
| Machine à états pure (flux de questions) | archi | N2 | copilote | 2026-08-12 | 2026-08-12 | — |
| Gestion d'erreurs typées et retryables | archi | N2 | copilote | 2026-08-12 | 2026-08-12 | — |
| Validation de graphe (cycles, satisfiabilité) | archi | N2 | copilote | 2026-08-07 | 2026-08-12 | — |
| Tailwind CSS v4 | framework | N1 | claude | 2026-08-07 | 2026-08-12 | — |
| ESLint 9 flat config | outil | N2 | copilote | 2026-08-07 | 2026-08-25 | — |
| YAML comme format de données | outil | N2 | copilote | 2026-08-07 | 2026-08-12 | — |
| tsx (exécuter du TypeScript en Node) | outil | N2 | copilote | 2026-08-09 | 2026-08-12 | — |
| npm et lockfile multiplateforme | outil | N2 | copilote | 2026-08-25 | 2026-08-25 | — |
| Node.js 24 | infra | N1 | copilote | 2026-08-25 | 2026-08-25 | — |
| Cron GitHub Actions (job hebdomadaire) | infra | N2 | copilote | 2026-08-12 | 2026-08-12 | — |
| GitHub CLI (`gh issue create`) | outil | N1 | copilote | 2026-08-12 | 2026-08-12 | — |
| Extraction HTML vers texte archivable | outil | N2 | copilote | 2026-08-12 | 2026-08-25 | — |
| Écriture d'un CLI Node (arguments, codes de sortie) | outil | N2 | copilote | 2026-08-09 | 2026-08-09 | — |
| Millésimes et versionnement de règles | metier | N2 | copilote | 2026-08-09 | 2026-08-12 | — |
| Formes juridiques françaises (micro, EI, EURL, SASU) | metier | N2 | copilote | 2026-08-12 | 2026-08-13 | — |
| Clé Luhn et validation d'un SIREN | metier | N2 | copilote | 2026-08-12 | 2026-08-12 | — |
| RGPD et minimisation des données | metier | N1 | copilote | 2026-08-07 | 2026-08-13 | — |
| Supabase (auth, Postgres, RLS) | infra | N1 | copilote | 2026-08-07 | 2026-08-13 | — |
| Vercel (déploiement) | infra | N1 | copilote | 2026-08-13 | 2026-08-13 | — |
| Brevo (e-mails transactionnels) | infra | N1 | copilote | 2026-08-13 | 2026-08-13 | — |
| Web Push et clés VAPID | infra | N1 | copilote | 2026-08-13 | 2026-08-13 | — |
| Mistral AI et Q/R sourcée (RAG) | data-ia | N1 | copilote | 2026-08-07 | 2026-08-13 | — |
| Cadrage d'agents (CLAUDE.md, AGENTS.md, plans) | methode | N2 | copilote | 2026-08-07 | 2026-08-12 | — |
| Commits conventionnels et historique lisible | methode | N2 | moi | 2026-08-07 | 2026-08-25 | — |
| Documentation produit (README, SETUP) | methode | N2 | copilote | 2026-08-12 | 2026-08-13 | — |

Légende : catégories, niveaux N1→N4 et part de co-réalisation définis dans le référentiel.

---

## Fiches

### Moteur de règles pur et déterministe
`archi` · `N3` · `copilote` · première fois 2026-08-09 · dernière 2026-08-12
*Alias : rules engine, computeActions, fonction pure*

**Contexte** — Le cœur de l'application devait rester auditable : mêmes règles, même profil, même date, toujours la même liste d'actions. J'ai posé cette contrainte dans la spec avant d'écrire une ligne de code, parce qu'une application qui annonce une échéance fiscale doit pouvoir être rejouée à l'identique en test.

**Ce que j'ai fait**
- J'ai imposé la signature `(règles, profil, aujourd'hui) → actions` : aucune horloge, aucun réseau, aucun aléa dans `computeActions`.
- J'ai fait éclater le moteur en modules à responsabilité unique — `matcher.ts` (à qui la règle s'applique), `scheduler.ts` (expansion des échéances périodiques et annuelles), `thresholds.ts` (arithmétique des plafonds), `steps.ts` (étapes restantes) — le fichier `engine.ts` ne gardant que l'assemblage et l'ordre de lecture.
- J'ai tranché une question restée ouverte au plan : la porte « phase idée » vit dans le moteur (`isRegistered`) et non dans chaque règle, parce que c'est un fait sur la phase et non sur une règle, et qu'un futur auteur de règle ne peut donc pas l'oublier.
- J'ai fait durcir l'entrée : `computeActions` valide `ctx.today` via `parseISO` et lève, car une liste vide est une réponse légitime (« rien à faire ») et une date malformée ne doit jamais pouvoir la produire.
- J'ai fait sommer l'argent en centimes entiers dans `thresholds.ts` : un utilisateur pile sur le plafond passait en `warning` au lieu de `exceeded` à cause de la dérive des flottants.

**Difficulté rencontrée** — Les échéances à cheval sur l'année : une déclaration URSSAF de décembre est due le 31 janvier suivant. La première version de `expandAnnual` bouclait à l'infini sur une date malformée ; la correction (commit `91b46db`) a été de faire du « lever une TypeError » le contrat explicite des helpers de date, jamais un NaN silencieux, et d'épingler les bascules d'année par des tests.

**Preuve** — `src/lib/rules/engine.ts`, `src/lib/rules/thresholds.ts`, `src/lib/rules/scheduler.ts`, commits `426302c`, `cc82fde`, `91b46db`

**Justification du niveau** — N3 : je n'ai pas écrit le code moi-même mais j'ai piloté l'architecture (découpage en modules purs, refus de l'horloge interne, placement de la porte `idee`), et les amendements de plan que j'ai consignés montrent des arbitrages que j'ai tranchés en cours de route. Je saurais refaire ce découpage seul sur un autre domaine. Pas N4 : je n'ai pas eu à optimiser les performances ni à déboguer le moteur en production.

**Formulation CV** — Conçu un moteur de règles métier déterministe en TypeScript (fonction pure `(règles, profil, date) → actions`), découpé en modules purs testables et validé par des profils de référence.

**À creuser** — Étendre le moteur aux formes sociétaires (EURL, SASU) ; mesurer le coût du chargement des règles quand le corpus dépassera la centaine de fichiers.

---

### Règles métier comme données YAML
`archi` · `N3` · `copilote` · première fois 2026-08-07 · dernière 2026-08-12
*Alias : rules-as-data, rules/*.yaml, loader*

**Contexte** — La règle de conception qui tient tout le projet : chaque fait énoncé par l'application vient d'une source officielle et pointe vers elle. J'ai donc sorti la connaissance métier du code pour la mettre dans des fichiers YAML relus comme n'importe quel changement, un fichier par règle, chacun portant `source_url`, `verified_on` et un millésime.

**Ce que j'ai fait**
- J'ai défini le format : trois familles (`obligations/`, `thresholds/`, `steps/`), un ordre de champs identique partout, et un bloc de commentaire obligatoire en tête de chaque règle qui porte ce que le schéma ne peut pas dire (conditions, exceptions, périmètre v1 vs fait juridique).
- J'ai fait écrire un loader qui marche l'arborescence, collecte *tous* les problèmes en une seule levée (YAML malformé fichier par fichier, ids dupliqués nommant les deux fichiers, prérequis pendants, cycles détectés en DFS) plutôt que d'échouer au premier.
- J'ai imposé que les prérequis ne référencent que des `roadmap_step` : un prérequis pointant sur un seuil ne pourrait jamais être « complété » et masquerait silencieusement des étapes.
- J'ai différé, puis tranché, l'invariant de non-chevauchement des millésimes : ajout d'un champ optionnel `family`, et deux millésimes d'une même famille dont les fenêtres se recouvrent deviennent une erreur de chargement (commit `1d32c20`).
- J'ai écrit le guide d'écriture des règles (`rules/README.md`) pour que la distinction « cette règle est réservée au micro » vs « on n'a livré que le micro pour l'instant » soit explicite.

**Difficulté rencontrée** — Un piège silencieux découvert à la relecture de la tâche 6 : `legal_forms: []` chargeait sans erreur et ne matchait plus personne, rendant la règle invisible. Le correctif est un `.min(1)` avec un message qui dit à l'auteur ce qu'il voulait probablement écrire (« omettre le champ pour ne pas contraindre »).

**Preuve** — `rules/README.md`, `rules/thresholds/plafond-micro-services.yaml`, `src/lib/rules/loader.ts`, commits `86f4b26`, `d8729a6`, `6af6381`, `1d32c20`

**Justification du niveau** — N3 : le format de règle, l'exigence de sourçage et le découpage en familles sont mes décisions, et je les ai documentées pour un tiers. J'ai dirigé et relu l'implémentation du loader sans l'écrire, d'où `copilote`.

**Formulation CV** — Conçu une architecture « règles comme données » : connaissance réglementaire externalisée en YAML versionné, validée au chargement (schéma, doublons, cycles, chevauchement de millésimes) et traçable jusqu'à sa source officielle.

**À creuser** — Un éditeur ou un formulaire pour qu'un non-développeur puisse proposer une règle ; l'expression des exceptions temporelles (exonération de CFE l'année de création) que le modèle v1 ne sait pas dire.

---

### Zod 4 et validation runtime
`outil` · `N3` · `copilote` · première fois 2026-08-07 · dernière 2026-08-12
*Alias : zod, schémas, parse don't validate*

**Contexte** — Trois frontières où des données non fiables entrent dans l'application : les fichiers YAML de règles, le `localStorage` que l'utilisateur peut éditer dans ses devtools, et le corps des requêtes HTTP. J'ai voulu qu'aucune ne soit franchie sans passer par un schéma.

**Ce que j'ai fait**
- J'ai fait durcir les schémas de règles au-delà du plan initial : `z.strictObject` partout (une clé inconnue est rejetée), URLs `https` sur domaines officiels uniquement (`OFFICIAL_SUFFIXES`), dates validées comme dates de calendrier réelles (2026-02-30 refusé), `valid_until >= valid_from`, ids en slug, et un `z.enum` fermé pour les options connues afin qu'une option mal orthographiée échoue bruyamment au lieu de ne jamais matcher.
- J'ai fait chaîner les vérifications de date avec `superRefine` pour qu'une date malformée ne cumule pas deux reproches (format *et* calendrier).
- J'ai fait re-parser le profil côté serveur dans la route `/api/actions` au lieu de faire confiance à celui envoyé par le navigateur.
- J'ai fait passer chaque lecture de `localStorage` par le schéma, avec abandon de la valeur plutôt que réparation quand une forme ancienne ne parse plus.

**Difficulté rencontrée** — Le passage à Zod 4 pendant le projet : le plan avait été écrit avec `z.object({...}).strict()`, déprécié, et j'ai fait resynchroniser le plan sur les versions réellement installées (commit `1c74ae3`) plutôt que laisser un plan mentir sur le code.

**Preuve** — `src/lib/rules/types.ts`, `src/lib/profile/schema.ts`, `src/app/api/actions/route.ts`, commits `dfabd91`, `91410d7`, `cffc5d2`

**Justification du niveau** — N3 : je saurais reposer seul cette discipline de validation aux frontières sur un autre projet, et j'ai arbitré chaque durcissement (strictObject, https-only, enum fermé) plutôt que d'accepter les schémas proposés. 32 tests portent sur ces seuls schémas.

**Formulation CV** — Mis en place une validation runtime systématique aux frontières (fichiers, stockage navigateur, API) avec Zod 4 : objets stricts, énumérations fermées, dates calendaires, messages d'erreur écrits pour l'auteur de la donnée.

**À creuser** — Générer la documentation des règles depuis les schémas ; comparer avec Valibot sur le poids envoyé au navigateur.

---

### TypeScript
`langage` · `N2` · `copilote` · première fois 2026-08-07 · dernière 2026-08-25
*Alias : TS, typage statique*

**Contexte** — Tout le projet est en TypeScript strict, y compris les scripts d'outillage exécutés par `tsx`. Le typage y sert de garde-fou métier autant que technique.

**Ce que j'ai fait**
- J'ai fait modéliser les actions affichées comme une union discriminée (`threshold-alert` | `obligation` | `step`) plutôt qu'un type large plein d'optionnels, précisément pour que l'interface ne puisse pas lire une date d'échéance sur une alerte de plafond.
- J'ai fait dériver les types du domaine des schémas Zod (`z.infer`) pour que types et validation ne puissent pas diverger, et le niveau d'alerte de `ThresholdAlert['level']` pour qu'ajouter un troisième niveau ne laisse pas l'union de l'interface en arrière.
- J'ai fait typer les échecs du client SIREN comme une union de raisons portant chacune un booléen `retryable`, ce qui permet à l'interface d'offrir « Réessayer » sans savoir ce qui a échoué.
- J'ai fait ordonner les étapes de CI `build` avant `typecheck`, parce que Next génère les types de routes dans `.next/types` et que `tsc --noEmit` échoue sur un dépôt fraîchement cloné sans eux.

**Difficulté rencontrée** — La tentation du type « branded » `ISODate` pour empêcher de passer une chaîne quelconque là où une date ISO est attendue. Écarté en M1 : le coût de conversion à chaque frontière n'était pas justifié tant que `parseISO` lève. C'est un arbitrage que j'ai consigné plutôt que subi.

**Preuve** — `src/lib/rules/engine.ts` (type `ActionInstance`), `src/lib/siren/client.ts` (`LookupFailure`), `.github/workflows/ci.yml`, commits `426302c`, `e7fc526`

**Justification du niveau** — N2 et pas N3 en toute honnêteté : le code typé a été produit par Claude sous ma direction, et plusieurs raffinements (dérivation de `level`, unions discriminées) sont sortis de passes de relecture que j'ai commandées plutôt que d'une intuition que j'aurais eue seul. Je lis et corrige ce code sans difficulté, je ne l'écrirais pas encore à ce niveau de finesse de but en blanc.

**Formulation CV** — Développé une application TypeScript strict de ~6 900 lignes : unions discriminées pour interdire les états impossibles, types dérivés des schémas de validation, typage explicite des modes d'échec réseau.

**À creuser** — Les types brandés et les `template literal types` ; comprendre pourquoi `tsc --noEmit` dépend des artefacts de build de Next.

---

### Next.js 16 App Router
`framework` · `N2` · `copilote` · première fois 2026-08-07 · dernière 2026-08-12
*Alias : NextJS, next, App Router*

**Contexte** — Le choix du framework est venu de la contrainte de déploiement (Vercel) et du fait que les règles sont des fichiers sur disque : elles doivent être lues côté serveur, jamais expédiées au navigateur.

**Ce que j'ai fait**
- J'ai découpé l'application selon cette frontière : `src/app/page.tsx` est un composant serveur mince, `src/components/App.tsx` porte le `'use client'`, et deux Route Handlers (`/api/actions`, `/api/company`) exposent le moteur et la recherche d'entreprise.
- J'ai fait mettre en cache les règles par processus serveur dans la route, avec un échec de chargement volontairement non mis en cache pour qu'une erreur disque transitoire n'empoisonne pas le processus — au prix d'un redémarrage du serveur de dev quand j'ajoute un fichier YAML, que j'ai consigné comme déviation.
- J'ai fait calculer « aujourd'hui » via `Intl.DateTimeFormat` sur `Europe/Paris` plutôt que sur l'horloge du serveur, parce qu'une échéance fiscale française ne dépend pas de la région où tourne le conteneur.
- J'ai utilisé les polices locales via `next/font` et les types de routes générés (`LayoutProps<"/">`).

**Difficulté rencontrée** — Next 16 s'écarte de ce qu'un modèle de langage « connaît » du framework : le dépôt contient un `AGENTS.md` régénéré par `next dev` qui impose de lire les guides embarqués dans `node_modules/next/dist/docs/` avant d'écrire du code. J'ai committé ce bloc plutôt que de le supprimer à chaque diff.

**Preuve** — `src/app/api/actions/route.ts`, `src/app/layout.tsx`, `AGENTS.md`, commits `88770ac`, `ec678ca`

**Justification du niveau** — N2 : la surface utilisée reste étroite (une page, un layout, deux route handlers, aucun rendu streaming, aucune revalidation, aucun middleware). Je sais où passe la frontière serveur/client et pourquoi, je n'ai pas encore exercé le framework au-delà.

**Formulation CV** — Construit une application Next.js 16 (App Router) avec séparation stricte serveur/client : moteur de règles et corpus réglementaire confinés au serveur, exposés par Route Handlers.

**À creuser** — Server Actions, revalidation et cache, rendu en streaming ; le déploiement réel sur Vercel, toujours en attente.

---

### React 19 et persistance locale
`framework` · `N2` · `copilote` · première fois 2026-08-12 · dernière 2026-08-12
*Alias : React, useSyncExternalStore, localStorage*

**Contexte** — Tant qu'il n'y a pas de compte utilisateur, le profil vit dans le navigateur. Il fallait que React voie le `localStorage` comme une source de vérité externe, sans désaccord entre le premier rendu client et le rendu serveur.

**Ce que j'ai fait**
- J'ai fait implémenter la persistance comme un store externe (`subscribe` / `snapshot` / `getServerSnapshot`) consommé par `useSyncExternalStore`, avec un instantané serveur `null` : le premier rendu client s'accorde avec le serveur et aucun re-rendu en cascade n'est nécessaire pour découvrir un profil stocké.
- J'ai fait rendre les instantanés référentiellement stables entre deux changements, sans quoi React re-rend en boucle.
- J'ai fait traiter le contenu stocké comme une entrée hostile : toute lecture passe par le schéma, et une forme périmée est jetée, pas réparée.
- J'ai fait gérer l'absence de `localStorage` (rendu serveur, navigateur avec stockage désactivé) comme un cas normal — l'application fonctionne sans persistance.
- J'ai conçu la couche pour être remplaçable : la même forme de données ira dans Supabase, donc l'ajout de la base sera un échange de ce module.

**Difficulté rencontrée** — La version naturelle (lire le stockage dans un `useEffect` puis `setState`) a été refusée par le lint du React Compiler. J'ai vérifié qu'il avait raison — c'était bien un rendu en cascade à chaque chargement — et j'ai consigné le changement d'approche dans les amendements du plan M2 plutôt que de désactiver la règle.

**Preuve** — `src/lib/profile/storage.ts`, `src/components/App.tsx`, `docs/superpowers/plans/2026-08-12-m2-assessment.md`, commit `ec678ca`

**Justification du niveau** — N2 : `useSyncExternalStore` est un hook que je n'aurais pas choisi spontanément, il m'a été imposé par le lint puis expliqué ; je comprends maintenant pourquoi il évite le rendu en cascade et je saurais le réutiliser, mais je ne l'ai pratiqué qu'une fois.

**Formulation CV** — Implémenté la persistance client d'une application React 19 comme store externe (`useSyncExternalStore`), avec revalidation par schéma de toute donnée relue et fonctionnement dégradé sans stockage.

**À creuser** — Le React Compiler et ses règles ; la bascule de ce module vers une persistance serveur sans toucher aux composants.

---

### Vitest et personas golden
`outil` · `N2` · `copilote` · première fois 2026-08-07 · dernière 2026-08-12
*Alias : tests unitaires, golden tests, fixtures*

**Contexte** — Une application qui annonce des échéances fiscales n'a pas droit à la régression silencieuse. La spec exigeait dès le départ au moins cinq profils de référence dont la liste d'actions attendue est assertée exactement.

**Ce que j'ai fait**
- J'ai fait configurer Vitest en `.mts` avec l'alias `@` aligné sur celui de TypeScript, environnement Node, tests collectés dans `src/**` *et* `scripts/**`.
- J'ai fait écrire des personas nommés (Théo en phase idée, Karim proche des plafonds, Sofia sans échéance) dont chacun épingle une décision du moteur ; le dépôt compte 22 fichiers de test et 393 tests.
- J'ai fait durcir un persona qui passait par coïncidence : Sofia est désormais assertée vide à une date où l'échéance CFE *est* dans l'horizon, donc sa liste vide prouve quelque chose.
- J'ai fait corriger les chiffres d'un persona après changement de millésime : Karim à 161 000 € passait sous le seuil d'alerte des nouveaux 203 100 € et n'exerçait plus la bande `warning` ; remonté à 168 000 €.
- J'ai fait tester le CLI `validate-rules` en le lançant comme sous-processus, pour couvrir le parsing d'arguments et les codes de sortie réellement observés par la CI.
- J'ai fait remplacer les montants de fixtures qui reprenaient un vrai chiffre périmé (77 700 €) par une valeur manifestement fausse (100 000 €), pour qu'aucun test ne puisse être lu comme une source.

**Difficulté rencontrée** — Un test vert qui ne prouve rien est pire qu'un test absent : c'est exactement ce que faisaient Sofia et les fixtures à 77 700 €. La leçon retenue est de se demander, pour chaque assertion, ce qui la ferait échouer.

**Preuve** — `vitest.config.mts`, `src/lib/rules/engine.test.ts`, `scripts/validate-rules.test.ts`, commits `6e2ce22`, `426302c`, `4d3fb3d`

**Justification du niveau** — N2 : je n'ai pas écrit ces tests, je les ai commandés et relus. Ce que j'ai réellement piloté, c'est l'exigence (personas golden, assertion exacte) et la critique des tests faibles. Écrire seul une suite de cette densité reste devant moi.

**Formulation CV** — Piloté une suite de 393 tests Vitest sur un moteur de règles, incluant des profils de référence assertés exactement et des tests de bout en bout du CLI de validation.

**À creuser** — Les tests de bout en bout (Playwright, prévus par la spec, jamais faits) ; la mesure de couverture.

---

### GitHub Actions
`infra` · `N3` · `copilote` · première fois 2026-08-12 · dernière 2026-08-25
*Alias : CI, GH Actions, workflow*

**Contexte** — Deux workflows aux rôles opposés : une CI qui refuse un code cassé, et un chien de garde hebdomadaire qui refuse une *vérité* périmée. Le second est celui qui peut échouer sans que personne n'ait touché au code.

**Ce que j'ai fait**
- J'ai ordonné les étapes de CI : porte des règles → lint → tests → build → typecheck. La porte des règles passe en premier parce que c'est l'étape la plus rapide et la plus susceptible d'échouer ; `build` précède `typecheck` parce que Next génère les types de routes.
- J'ai ajouté le garde `--min 14` sur le nombre de règles : un répertoire `rules/` qui perd silencieusement des fichiers reste sinon « valide », un répertoire vide étant valide par construction.
- J'ai monté la CI en Node 24 pour l'aligner sur le npm qui écrit le lockfile, et déclaré `@emnapi/core` et `@emnapi/runtime` en devDependencies explicites.
- J'ai écrit un second workflow planifié (`cron: '0 6 * * 1'`, lundi 6 h UTC) qui recompare chaque fiche archivée à la page en ligne, avec `permissions: issues: write`, `continue-on-error` pour récupérer le code de sortie, et ouverture d'une issue via `gh issue create` nommant ce qui a bougé.
- J'ai fait émettre des annotations `::warning::` / `::error::` par les scripts pour que les problèmes remontent dans l'interface GitHub.

**Difficulté rencontrée** — Le premier vrai passage en CI a cassé sur un point invisible en local : `npm ci` sous Linux descend dans le sous-arbre de dépendances du paquet wasm de secours de Tailwind (`@tailwindcss/oxide-wasm32-wasi`), que npm sous Windows ne matérialise jamais. Résultat : `Missing: @emnapi/core@1.11.3 from lock file` en CI, tout vert en local, et aucune commande locale — y compris `npm install --package-lock-only` avec surcharges `--os` / `--cpu` — n'écrivait les entrées manquantes. J'ai résolu en déclarant les deux paquets explicitement, et j'ai laissé le commentaire d'explication dans `package.json` et `ci.yml` pour que personne ne les « nettoie ».

**Preuve** — `.github/workflows/ci.yml`, `.github/workflows/truth-watchdog.yml`, commits `1b0dbc5`, `018925a`, `90e8261`

**Justification du niveau** — N3 : j'ai débogué seul un échec qui n'était pas reproductible sur ma machine, en comprenant la cause (différence de résolution npm entre plateformes) plutôt qu'en tâtonnant, et j'ai documenté le correctif pour qu'il survive. C'est le sujet où j'ai le plus travaillé en autonomie sur ce projet.

**Formulation CV** — Mis en place et débogué une CI GitHub Actions (validation de données, lint, tests, build, typecheck) plus un job planifié hebdomadaire ouvrant automatiquement une issue ; diagnostiqué une divergence de lockfile npm Windows/Linux non reproductible en local.

**À creuser** — Le cache des dépendances et le temps d'exécution ; le déploiement continu vers Vercel depuis la CI.

---

### API recherche-entreprises et SIREN
`outil` · `N2` · `copilote` · première fois 2026-08-12 · dernière 2026-08-12
*Alias : api.gouv.fr, Sirene, INSEE, RNE*

**Contexte** — Le seul appel externe de l'application : interroger `recherche-entreprises.api.gouv.fr` (public, sans clé, limité par IP) pour ne pas demander à l'utilisateur ce que le registre sait déjà.

**Ce que j'ai fait**
- J'ai fait valider le SIREN localement avant tout appel réseau (neuf chiffres, clé de Luhn), avec normalisation des espaces et tirets, pour qu'une faute de frappe donne « ce numéro n'est pas un SIREN valide » immédiatement au lieu de « entreprise introuvable » après un aller-retour — deux problèmes différents avec deux corrections différentes.
- J'ai fait passer l'exception documentée de La Poste (356000000, vrai SIREN qui échoue au Luhn) en liste nominative, plutôt qu'affaiblir le contrôle pour tout le monde.
- J'ai fait retourner les échecs au lieu de les lever, chacun portant s'il vaut la peine de réessayer (`invalid-siren`, `not-found`, `rate-limited`, `unavailable`, `network`), avec un timeout de 8 s converti en échec réessayable via `AbortSignal.timeout` et `AbortSignal.any`.
- J'ai posé la règle de mapping : ne jamais deviner ce que le registre ne dit pas. Le régime micro vs EI est fiscal et invisible du registre, un code APE ne détermine pas vente/BIC/BNC — ces deux points restent des questions. En revanche un `nature_juridique 5720` ne peut être qu'une SASU, donc un candidat unique est décidé et simplement confirmé à l'écran récapitulatif.

**Difficulté rencontrée** — Séparer ce que le registre *sait* de ce qu'on aimerait en déduire. La tentation de dériver la catégorie d'activité du code APE était forte et fausse ; la trancher a demandé de vérifier ce que contient réellement la réponse de l'API.

**Preuve** — `src/lib/siren/validate.ts`, `src/lib/siren/client.ts`, `src/lib/siren/map.ts`, commit `e7fc526`

**Justification du niveau** — N2 : j'ai dirigé les choix de contrat (échecs typés, validation avant réseau, non-devinette) et 23 tests couvrent ce module, mais l'intégration est simple et je ne l'ai exercée que sur une API sans authentification.

**Formulation CV** — Intégré l'API publique recherche-entreprises (Sirene/RNE) avec validation Luhn préalable côté client, échecs typés et réessayables, timeouts, et une règle explicite de non-inférence sur les champs que le registre ne porte pas.

**À creuser** — La limitation de débit par IP en conditions réelles ; l'API Sirene authentifiée de l'INSEE pour les champs absents.

---

### Veille des sources officielles
`archi` · `N3` · `copilote` · première fois 2026-08-12 · dernière 2026-08-25
*Alias : truth watchdog, archivage des sources, M6*

**Contexte** — Une `source_url` prouve d'où vient un chiffre, pas ce que la page disait le jour où quelqu'un l'a lue. J'ai donc fait archiver dans git les 20 fiches service-public.fr dont dépendent les règles, en Markdown, avec la date de vérification officielle et la date de récupération.

**Ce que j'ai fait**
- J'ai fait écrire `scripts/fetch-source.ts` (archive une fiche, ou toutes) et `scripts/check-sources.ts` (recompare et signale), en partageant volontairement le même module d'extraction `src/lib/truth/fiche.ts` : si les deux analysaient le HTML différemment, chaque page paraîtrait modifiée à chaque passage, on couperait l'alerte, et un vrai changement de seuil passerait inaperçu.
- J'ai fait délimiter le contenu utile entre « Vérifié le » et le widget de retour utilisateur, avec décodage des entités HTML — une extraction volontairement fruste, parce que c'est une archive, pas un rendu.
- J'ai fait calculer la couverture : quelles règles citent quelle fiche, pour que le rapport ne dise pas seulement « la page a bougé » mais « et cela met ces règles en doute ».
- J'ai posé l'interdit central : le chien de garde ne modifie jamais une règle. Une page qui bouge est un signal pour un humain ; la vérité ne change que par un commit relu, avec un nouveau millésime plutôt qu'une édition quand un chiffre a changé.
- J'ai fait ajouter au CLI de validation un avertissement de fraîcheur à 183 jours et une erreur sur un `verified_on` dans le futur.

**Difficulté rencontrée** — Faire tenir la promesse « l'IA reste aux bords » jusque dans l'outillage. La solution évidente aurait été de laisser un modèle relire la page et corriger le chiffre ; c'est exactement ce que le projet refuse. Le chien de garde ouvre donc une issue et s'arrête là.

**Preuve** — `scripts/check-sources.ts`, `src/lib/truth/fiche.ts`, `src/lib/truth/coverage.ts`, `docs/sources/`, commits `5c0ad97`, `1b87670`, `2a9de14`

**Justification du niveau** — N3 : le dispositif entier (archiver, comparer, alerter, ne jamais corriger) est ma réponse à un problème que je me suis posé, et je l'ai fait tourner pour de bon — le commit `2a9de14` rafraîchit l'archive après des corrections en amont détectées par ce mécanisme. Je saurais le remonter ailleurs.

**Formulation CV** — Conçu un dispositif de veille documentaire : archivage en git des sources officielles, comparaison hebdomadaire automatisée, rapport reliant chaque page modifiée aux règles qu'elle justifie, et interdiction stricte de toute correction automatique.

**À creuser** — Un diff plus fin que « la page a changé » (repérer les nombres qui bougent) ; l'archivage des actualités législatives, pas seulement des fiches.

---

### Réglementation du micro-entrepreneur
`metier` · `N3` · `copilote` · première fois 2026-08-09 · dernière 2026-08-25
*Alias : URSSAF, CFE, plafonds micro, franchise en base de TVA*

**Contexte** — Le domaine du projet. Chaque valeur écrite dans une règle est une affirmation sur le droit français que l'application répétera à un utilisateur comme une instruction, sans qu'il puisse la vérifier.

**Ce que j'ai fait**
- J'ai vérifié chaque valeur v1 contre sa fiche officielle et corrigé le plan, qui portait le millésime périmé 2023-2025 : les plafonds micro retenus sont 203 100 € (vente) et 83 600 € (services), `valid_from: 2026-01-01`, `valid_until: 2028-12-31`.
- J'ai confirmé les seuils de franchise en base de TVA à 85 000 / 37 500 €, le seuil unique de 25 000 € ayant été abrogé.
- J'ai modélisé le calendrier de déclaration URSSAF sans figer la fréquence dans la règle : mensuel ou trimestriel est un choix fait à l'immatriculation, donc il vient du profil, la déclaration étant due fin du mois suivant la période.
- J'ai fait rédiger les charges préparées par le module `prepare` en code et jamais par un modèle : taux de cotisations micro (12,3 % vente, 21,2 % services BIC, 25,6 % libéral, 23,2 % Cipav), abattements fiscaux (71 / 50 / 34 %, minimum 305 €), avec mention explicite de ce que l'application n'a pas pu calculer.
- J'ai rédigé une synthèse comparée des formes juridiques (micro, EI, EURL, SASU) à partir des fiches archivées — patrimoine séparé de plein droit depuis le statut unique, la vraie bifurcation TNS vs assimilé salarié, IS à 25 % ou 15 % sous 42 500 € — explicitement marquée « en attente de vérification humaine » et non branchée dans le produit.

**Difficulté rencontrée** — Les sources officielles se contredisent : la FAQ micro d'`impots.gouv.fr` servait encore les anciens plafonds quand service-public.fr portait les nouveaux. J'ai tranché en faveur de la fiche datée la plus récente et laissé un commentaire pour interdire la « correction » en arrière.

**Preuve** — `rules/thresholds/plafond-micro-services.yaml`, `src/lib/prepare/preparer.ts`, `README.md` (tableau comparatif des formes), commits `36b69d1`, `12d83f1`

**Justification du niveau** — N3 : j'ai lu les fiches, tranché entre sources contradictoires, distingué le fait juridique du périmètre livré, et documenté les exceptions que le modèle ne sait pas encore exprimer (exonération de CFE l'année de création). Ce n'est pas N4 : je ne maîtrise pas les formes sociétaires ni la couverture chômage par statut, que j'ai listées comme questions ouvertes.

**Formulation CV** — Modélisé les obligations du micro-entrepreneur (déclaration URSSAF, CFE, plafonds de chiffre d'affaires, franchise en base de TVA) à partir des sources officielles, avec gestion des millésimes et arbitrage entre sources divergentes.

**À creuser** — Régimes des sociétés (EURL, SASU) ; ACRE, taux et éligibilité ; couverture chômage par statut ; réforme de la facturation électronique 2026-2027.

---

### Méthode spec puis plan puis amendements
`methode` · `N3` · `copilote` · première fois 2026-08-07 · dernière 2026-08-13
*Alias : spec-driven development, plans d'exécution, handoff*

**Contexte** — Le projet est mené en binôme avec un agent, sur des sessions séparées par des jours. Sans trace écrite des décisions et des écarts, chaque session repart d'une hypothèse fausse.

**Ce que j'ai fait**
- J'ai fait produire une spec de conception avant tout code (16 sections : vision, périmètre explicite dedans/dehors, flux, architecture, modèle de données, RGPD, tests), puis un plan d'implémentation par milestone découpé en tâches numérotées.
- J'ai institué le bloc **Amendements** en tête de chaque plan : chaque écart d'exécution y est consigné avec sa raison, si bien que le plan ne ment jamais sur le code. Les plans M1 et M2 en portent une douzaine, dont plusieurs revirements assumés.
- J'ai fait écrire un document de passation (`handoffs/`) à la fin d'une session pour reprendre le travail sans relire l'historique.
- J'ai tenu 49 commits en conventional commits, un par étape de tâche, sur `master` (dépôt solo assumé).
- J'ai cadré l'agent par `CLAUDE.md` / `AGENTS.md` et documenté dans `SETUP.md` chaque blocage nécessitant une action humaine (GitHub, Supabase, Vercel, Brevo, VAPID, Mistral), avec la procédure exacte et la façon de me transmettre un secret.
- J'ai maintenu une carte de la documentation dans le README, disant pour chaque document quand le lire.

**Difficulté rencontrée** — Le réflexe de corriger le code sans corriger le plan. Plusieurs commits (`3f4d506`, `0c91ba8`, `89f7ca2`) ne font que consigner des amendements : c'est un coût réel, et c'est ce qui a permis de retrouver, deux semaines plus tard, pourquoi les plafonds étaient à 203 100 € et pas 77 700 €.

**Preuve** — `docs/superpowers/specs/2026-08-07-autostartuper-design.md`, `docs/superpowers/plans/2026-08-07-m1-foundation-rules-engine.md` (blocs Amendements), `SETUP.md`, commits `74780cf`, `3049470`, `d7b3685`

**Justification du niveau** — N3 : j'ai appliqué et tenu la méthode sur toute la durée du projet, y compris quand elle coûtait un commit de pure documentation, et je saurais la reconduire seul. La méthode elle-même vient d'un outillage existant, d'où `copilote` — mais la discipline d'amendement est ce que j'ai réellement fait tenir.

**Formulation CV** — Conduit un projet en développement dirigé par la spécification : spec de conception, plans d'exécution par milestone, journal d'amendements documentant chaque écart, documents de passation et guide de déblocage des dépendances externes.

**À creuser** — Faire tenir la même discipline en équipe, où le plan doit être négocié et pas seulement écrit ; les revues de code par des tiers.

---

## Sujets explorés, non retenus

| Sujet | Date | Pourquoi écarté | Ce que j'en retiens |
|---|---|---|---|
| Type brandé `ISODate` | 2026-08-09 | Coût de conversion à chaque frontière jugé trop élevé pour M1 ; `parseISO` qui lève couvre le besoin | Un type ne vaut que ce que coûte son maintien aux frontières ; à réévaluer si les dates fuient hors du moteur |
| Lecture du stockage dans un `useEffect` + `setState` | 2026-08-12 | Rejeté par le lint du React Compiler ; provoquait un rendu en cascade à chaque chargement | `useSyncExternalStore` est la bonne primitive pour une source de vérité hors React ; le lint avait raison |
| Champ de lignage `supersedes` entre millésimes | 2026-08-09 | Remplacé par un champ `family` plus simple, comparé par fenêtres de validité au chargement | Une clé de regroupement suffit là où j'imaginais un graphe de succession |
| Contrainte de phase `idee` écrite dans chaque règle | 2026-08-12 | Déplacée dans le moteur (`isRegistered`) : c'est un fait sur la phase, pas sur une règle | Ce qu'un auteur peut oublier d'écrire ne doit pas être à sa charge |
| Plafonds micro 77 700 € / 188 700 € (millésime 2023-2025) | 2026-08-09 | Millésime périmé porté par le plan initial | Un chiffre juste dans un plan de la semaine dernière peut être faux aujourd'hui |
| Seuil unique de franchise en base de TVA à 25 000 € | 2026-08-09 | Abrogé par la loi 2025-1044 ; les seuils 85 000 / 37 500 € restent en vigueur | Vérifier l'entrée en vigueur, pas seulement l'annonce |
| `impots.gouv.fr` comme source de plafonds | 2026-08-09 | Sert encore les anciens chiffres ; `entreprendre.service-public.gouv.fr` retenu comme hôte canonique | Deux sites publics peuvent se contredire ; choisir et écrire pourquoi |
| `urssaf.fr` comme source du calendrier de déclaration | 2026-08-09 | Injoignable depuis l'environnement de travail ; fiche F23257 retenue à la place | Une source qu'on ne peut pas archiver ne peut pas être surveillée |
| Fiche F36239 (page EURL) pour le compte bancaire dédié | 2026-08-09 | Mauvaise fiche ; remplacée par F35991, dédiée au micro-entrepreneur | Relire la fiche entière avant de la citer |
| `npm install --package-lock-only` avec surcharges `--os` / `--cpu` | 2026-08-25 | N'écrit pas les entrées `@emnapi/*` que `npm ci` exige sous Linux | Certains écarts de plateforme ne se reproduisent qu'en CI ; déclarer explicitement plutôt que ruser |
| Node 20 en CI | 2026-08-25 | Aligné sur Node 24, la version qui écrit le lockfile en local | Faire correspondre la version de CI à celle du développement évite une classe entière de bugs |
| `z.object({...}).strict()` | 2026-08-07 | Déprécié en Zod 4 ; `z.strictObject({...})` retenu | Resynchroniser le plan sur les versions réellement installées |
| Tests de bout en bout Playwright | 2026-08-07 | Prévus par la spec §15, jamais implémentés faute d'avoir dépassé le local | Reste le principal trou de couverture du projet |
| Auth et persistance Supabase (M2.5) | 2026-08-13 | Bloqué : demande un projet Supabase en région EU, des clés et des politiques RLS que seul le propriétaire du dépôt peut créer | Isoler un blocage sur credentials dans une tâche à part permet de livrer tout le reste |
| Bords IA Mistral, analyse de documents et Q/R sourcée (M5) | 2026-08-13 | Bloqué sur une clé API ; le principe « l'IA ne décide jamais ce que l'utilisateur doit » reste posé | Une fonctionnalité IA sans garde-fou documenté ne vaut pas d'être commencée |
