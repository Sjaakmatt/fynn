# Volledige Code Analyse — Fynn

**Datum:** 2026-03-21
**Project:** Next.js 16 persoonlijke financiele app (Nederlands)
**Stack:** React 19, Supabase, Stripe, Anthropic AI, Plaid, Enable Banking, Tailwind v4
**Omvang:** ~100 bestanden, ~80.000 regels (excl. package-lock)

---

## 1. KRITIEKE BEVEILIGINGSPROBLEMEN

### 1.1 `public/transactions.json` — Gevoelige data publiek toegankelijk
Alles in `/public` wordt direct geserveerd door Next.js. Dit bestand bevat IBAN-nummers, namen van tegenpartijen en bedragen. Dit moet onmiddellijk verwijderd of verplaatst worden naar `/scripts` of `/fixtures`.

### 1.2 API-routes niet beschermd door middleware
`src/middleware.ts:51` — De matcher dekt alleen `/dashboard/:path*` en `/account/:path*`. Alle `/api/*` routes moeten zelf authenticatie afhandelen. Als een API-route vergeet `getUser()` te checken, is die volledig onbeschermd. Sommige routes (bijv. `api/enablebanking/aspsps`) missen authenticatie.

### 1.3 Module-level throws crashen de hele applicatie
- `src/lib/enablebanking.ts:4-5` — `process.env.ENABLE_BANKING_APP_ID!` gooit bij module-import als env vars ontbreken
- `src/lib/plaid.ts:3-4` — Zelfde probleem met `PLAID_CLIENT_ID!` en `PLAID_SECRET!`
- Als een van deze modules indirect geimporteerd wordt, crasht de hele server

### 1.4 Lege `catch {}` blokken slikken authenticatiefouten
`src/lib/supabase/server.ts:20` — Cookie-setting fouten worden stil opgegeten. Authenticatiestatus kan ongemerkt verloren gaan.

### 1.5 XSS in e-mail template
`src/app/api/contact/route.ts:100-122` — Gebruikersinvoer (`cleanName`, `cleanEmail`, `cleanMessage`) wordt direct in HTML template strings geinjecteerd zonder HTML-escaping. Een naam als `<script>alert(1)</script>` wordt ongewijzigd in de e-mail opgenomen.

### 1.6 Geen CSRF-bescherming
Geen CSRF-tokens op POST-endpoints. State-wijzigende acties vertrouwen uitsluitend op cookies.

### 1.7 Geen security headers geconfigureerd
`next.config.ts` is leeg — geen Content-Security-Policy, X-Frame-Options, of Strict-Transport-Security.

### 1.8 IDOR in Enable Banking callback — KRITIEK
`src/app/api/enablebanking/callback/route.ts:171` — `const userId = state.split("::")[0]` haalt de userId uit de `state` query parameter zonder enige verificatie. Een aanvaller kan de `state` vervalsen om bankrekeningen en transacties aan een willekeurig account te koppelen. Er is ook geen `supabase.auth.getUser()` check in de hele handler.

### 1.9 Cross-user datalek in classify-merchants
`src/app/api/sync/classify-merchants/route.ts:47` — De query `.in('merchant_key', chunk)` mist `.eq('user_id', user.id)`. Dit leest transactiebedragen van ALLE gebruikers om context te bouwen voor AI-classificatie.

### 1.10 Plaid access tokens onversleuteld opgeslagen
`src/app/api/plaid/exchange-token/route.ts:29` — Access tokens worden direct in `plaid_items.access_token` opgeslagen zonder encryptie. Dit zijn permanente credentials die toegang geven tot bankgegevens.

### 1.11 Account deletion incompleet (GDPR)
`src/app/api/account/delete/route.ts:78-95` — Verwijdert data uit applicatietabellen maar roept nooit `supabase.auth.admin.deleteUser()` aan. Het auth-record (inclusief e-mail) blijft bestaan. Mist ook: `budgets`, `contact_messages`, `chat_messages`, `cashflow_events` tabellen.

### 1.12 Service role key zonder authenticatie (beta/count)
`src/app/api/beta/count/route.ts:4-7` — Gebruikt `SUPABASE_SERVICE_ROLE_KEY` op module-level zonder authenticatie. Elke anonieme gebruiker kan dit endpoint bereiken. De service role client omzeilt Row Level Security.

---

## 2. BUGS

### 2.1 Multi-tenancy data-integriteit
`src/lib/detect-income.ts` en `src/lib/detect-recurring.ts` — Beide bestanden doen upserts naar de gedeelde `merchant_map` tabel op basis van de data van een enkele gebruiker. Dit betekent dat de patronen van een gebruiker de `merchant_name`, `confidence` en `category` voor ALLE gebruikers kunnen overschrijven.

### 2.2 ABN AMRO bedragsheuristiek
`src/lib/clean-description.ts:314-318` — Als merchant "ABN AMRO" is en `|bedrag| > 500`, wordt het "Hypotheek" genoemd. Een salarisuitkering van ABN AMRO van EUR 600 wordt dus fout als hypotheek gelabeld.

### 2.3 Dubbele entries in KNOWN_NAMES
`src/lib/clean-description.ts:84-86, 132-134` — `"belastingdienst"`, `"hoogheemraadschap"`, en `"duo hoofdrekening"` staan twee keer in de array.

### 2.4 `isValidCategory` Set wordt elk aanroep opnieuw aangemaakt
`src/lib/categorize-engine.ts:529` — De `Set` wordt in de functie body aangemaakt i.p.v. als module-level constante.

### 2.5 Cancel-providers substring matching te gretig
`src/lib/cancel-providers.ts:99` — `lower.includes(p.key)` betekent dat "ben's shop" matcht met provider "ben" (telecomprovider). Korte keys als "ad", "ben", "fd", "hema" zijn problematisch.

### 2.6 Date rollover bug
`src/lib/decision-engine.ts:372` — `calculateDaysUntil` met `targetDay=31` in een maand met 30 dagen rolt door naar de volgende maand door JavaScript's auto-correctie.

### 2.7 Inkomen deactivatie query te beperkt
`src/lib/detect-income.ts:196-203` — `.limit(1)` checkt maar een andere gebruiker. Merchants actief bij andere gebruikers kunnen onterecht gedeactiveerd worden.

### 2.8 Transactions cursor pagination kan records overslaan
`src/app/api/transactions/route.ts:26` — `query.lt("transaction_date", cursor)` gebruikt `<` op datum, maar meerdere transacties kunnen dezelfde datum delen. Transacties op de cursor-grens gaan verloren tussen pagina's.

### 2.9 Enable Banking `continuation_key` niet URL-encoded
`src/app/api/enablebanking/callback/route.ts:94` — `continuation_key=${continuationKey}` wordt string-geinterpoleerd zonder `encodeURIComponent()`. Speciale tekens in de key breken de URL.

### 2.10 Budget GET crasht bij eerste gebruik
`src/app/api/budget/route.ts:319` — `.single()` gooit een Supabase error (PGRST116) als er nog geen budget bestaat. Moet `.maybeSingle()` zijn.

### 2.11 AI response content array kan leeg zijn
Meerdere AI routes (briefing, chat, uitgave-check, budget, savings-goals tip) benaderen `message.content[0]` zonder te checken of de `content` array niet leeg is.

---

## 3. ARCHITECTUURPROBLEMEN

### 3.1 Gedupliceerde utility functies
`median()` is identiek geimplementeerd in 3 bestanden: `decision-engine.ts`, `detect-income.ts`, en `detect-recurring.ts`. Ook `num()`, `daysBetween()`, `clamp01()`, en `amountStability()` zijn gedupliceerd. Moet naar een gedeelde `src/lib/utils.ts`.

### 3.2 Twee aparte inkomensdetectie-implementaties
`src/lib/decision-engine.ts` heeft zijn eigen `detectIncome()` (regels 244-309), compleet los van `src/lib/detect-income.ts`. Ze gebruiken verschillende algoritmen en kunnen conflicterende resultaten geven.

### 3.3 Dashboard page te groot en complex
`src/app/dashboard/page.tsx` is 530+ regels met zware serverside logica, SQL queries, en business logic. Dit moet opgesplitst worden in service-functies.

### 3.4 Deprecated package
`package.json` bevat `@supabase/auth-helpers-nextjs` (v0.15.0) wat deprecated is. De codebase gebruikt alleen `@supabase/ssr`. Kan verwijderd worden.

### 3.5 Geen database migraties
Het project vertrouwt op meerdere Supabase tabellen (`transactions`, `merchant_map`, `bank_accounts`, `dashboard_cache`, `profiles`, etc.) maar er zijn geen migratie-bestanden in de repo.

### 3.6 Categorie-overlap in rule engine
`src/lib/categorize-engine.ts` — `'autoverzekering'` staat in zowel `wonen` als `transport`. `'ziggo'` kan matchen in `wonen` en `abonnementen`. First-match-wins gedrag is impliciet en ongedocumenteerd.

### 3.7 Interne HTTP calls i.p.v. directe functie-aanroepen
`enablebanking/callback/route.ts:48`, `enablebanking/sync/route.ts:521-522`, `plaid/sync/route.ts:358-361` — Meerdere routes doen `fetch()` calls naar andere API routes binnen dezelfde applicatie en forwarden cookies. Dit is fragiel (afhankelijk van `NEXT_PUBLIC_APP_URL`), voegt latency toe, en kan falen in serverless omgevingen.

### 3.8 Gedupliceerde subscription check logica in 7+ bestanden
`ai/briefing`, `ai/chat`, `ai/uitgave-check`, `budget`, `calendar`, `savings-goals/[id]/tip` — Hetzelfde patroon (fetch profile, check `subscription_status`, vergelijk `trial_ends_at`) is verbatim gekopieerd. Moet een shared utility of middleware worden.

### 3.9 Gedupliceerde `stableId` hash, `analyzeTxs`, `upsertBatch`, `loadMerchantCategories`
- `stableId` (FNV-1a hash): identiek in `enablebanking/sync` en `plaid/sync`
- `analyzeTxs`: bijna identiek in `ai/briefing` en `ai/chat`
- `upsertBatch` en `loadMerchantCategories`: zeer vergelijkbaar in beide sync routes

### 3.10 Upload-transactions route is 590+ regels
`src/app/api/upload-transactions/route.ts` — Combineert file parsing, encoding detectie, IBAN detectie, account creatie, transactie categorisatie, merchant seeding, recurring detection en AI classification triggering in een enkel bestand.

### 3.11 Sync routes kunnen timeout op serverless
`enablebanking/sync` en `plaid/sync` kunnen zeer lang draaien (tot 500 pagina's met 300ms delays = 150+ seconden). Dit overschrijdt typische serverless timeouts (10-60s op Vercel).

---

## 4. CODEKWALITEIT

### 4.1 `ebFetch` retourneert `text as unknown as T` bij JSON parse failure
`src/lib/enablebanking.ts:147` — Bij een JSON-parse fout wordt ruwe tekst als `T` gecast. Callers verwachten getypte objecten en krijgen runtime errors.

### 4.2 Fire-and-forget fetch zonder error handling
`src/app/api/upload-transactions/route.ts:570-573` — Interne API call naar `classify-merchants` wordt fire-and-forget gedaan met `.catch(() => {})`. Als dit systematisch faalt, is er geen signaal.

### 4.3 Magic numbers verspreid door de codebase
- `decision-engine.ts:330` — `projectedFreeSpace < 200` (hardcoded EUR 200)
- `detect-income.ts:125` — `score < 0.55` threshold
- `detect-recurring.ts:195` — `score < 0.7` threshold
- Deactivatie gebruikt `> 60` dagen in beide bestanden

### 4.4 Inconsistente error handling
- `dashboard-cache.ts` logt errors en gaat door
- `detect-income.ts` en `detect-recurring.ts` gooien exceptions
- `enablebanking.ts` gooit bij netwerk errors maar slikt JSON parse failures
- Geen uniforme error handling strategie

### 4.5 Geen input validatie op file upload grootte in parser
`src/lib/bank-parsers.ts` — De `text` parameter wordt volledig in geheugen geparsed zonder limiet (de 10MB check zit alleen in de route, niet in de library).

### 4.6 `require('xlsx')` in plaats van ES import
`src/app/api/upload-transactions/route.ts:31` — Gebruikt CommonJS `require` met een eslint-disable comment. Moet een dynamic `import()` zijn.

---

## 5. COMPONENT & UX ISSUES

### 5.1 Geen loading states bij veel componenten
Meerdere componenten (`BudgetPlanner`, `SubscriptionManager`, `CategoryBreakdown`) tonen geen skeleton/loader tijdens data ophalen.

### 5.2 Accessibility
- Knoppen zonder `aria-label` (bijv. de "X" sluitknop in `CoachModal.tsx:110`)
- Modals zonder `role="dialog"` en `aria-modal="true"`
- Focus trapping ontbreekt in modals
- Kleurcontrast niet gewaarborgd bij custom CSS variables

### 5.3 Trial check inconsistentie
De dashboard (`page.tsx:92`) checkt alleen `subscription_status === 'trialing'` zonder trial_ends_at te valideren, maar de AI chat route (`ai/chat/route.ts:108-110`) vergelijkt trial_ends_at met huidige datum. Verlopen trials worden verschillend afgehandeld.

---

## 6. POSITIEVE PUNTEN

- Solide Stripe webhook implementatie met signature verification
- Rate limiting op contact form en AI chat
- Goede input sanitization op contactformulier
- Slimme IBAN-detectie logica voor eigen rekeningen
- Dashboard caching strategie
- Consistente NL-talige UX
- Clean categorizatie-engine met goed gestructureerde rules
- Goede scheiding tussen preview en import modus bij uploads

---

## 7. PRIORITEIT ACTIELIJST

| Prio | Actie | Impact |
|------|-------|--------|
| P0 | Fix IDOR in Enable Banking callback (state verificatie) | Aanvaller kan bankdata aan willekeurig account koppelen |
| P0 | Fix cross-user datalek in classify-merchants | Data lekkage tussen gebruikers |
| P0 | Verwijder `public/transactions.json` | Gevoelige data publiek |
| P0 | Fix multi-tenancy bug in `merchant_map` upserts | Data corruptie |
| P0 | Voeg HTML-escaping toe aan e-mail templates | XSS |
| P0 | Completeer account deletion (GDPR: auth user + alle tabellen) | Juridisch risico |
| P1 | Bescherm API routes via middleware of shared guard | Auth bypass |
| P1 | Versleutel Plaid access tokens | Credential exposure |
| P1 | Verwijder service role key uit beta/count of voeg auth toe | RLS bypass |
| P1 | Lazy init voor enablebanking/plaid modules | App crashes |
| P1 | Fix lege `catch {}` in supabase server client | Stille auth failures |
| P2 | Fix cursor pagination bug in transactions route | Data verlies bij paginering |
| P2 | Fix budget GET `.single()` → `.maybeSingle()` | Crash bij eerste gebruik |
| P2 | Voeg security headers toe in `next.config.ts` | Security hardening |
| P2 | Extract gedeelde utils en gedupliceerde code | Code kwaliteit |
| P2 | Verwijder `@supabase/auth-helpers-nextjs` | Dead code |
| P2 | Fix cancel-provider matching (word boundaries) | Foutieve matches |
| P2 | Refactor interne HTTP calls naar directe functie-aanroepen | Stabiliteit |
| P3 | Voeg database migraties toe | Schema management |
| P3 | Split dashboard page en upload-transactions logica | Maintainability |
| P3 | Voeg CSRF-bescherming toe | Security |
| P3 | Fix serverless timeout risico in sync routes | Betrouwbaarheid |
