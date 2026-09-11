# SariCMS - Rapport d'Audit de Sécurité et Qualité

**Date :** 10 Septembre 2026  
**Version audité :** 0.1.0  
**Environnement :** Next.js 16.2.12, React 19.2.4, Node.js 20+

---

## 1. Résumé Exécutif

| Critère | Score | Niveau de Confiance |
|---------|-------|---------------------|
| **Sécurité globale** | 3.2/10 | Élevé |
| **Robustesse du code** | 5.5/10 | Élevé |
| **Tests & Qualité** | 4.0/10 | Moyen |
| **Performance** | Non testé | - |
| **Conformité OWASP Top 10** | 3.5/10 | Élevé |
| **Anti-spam / Anti-fraude** | 4.5/10 | Élevé |

**Verdict Go/No-Go : NO-GO** — Mise en production **interdite** avant correction des 5 problèmes critiques.

---

## 2. Top 5 Problèmes Critiques (Bloquants Production)

| # | Problème | Impact | Localisation | Effort Corrections |
|---|----------|--------|--------------|-------------------|
| **C1** | **CAPTCHA côté client uniquement** — Le composant `ImageCaptcha` génère ET valide le code dans le navigateur. Un attaquant contourne trivialement en lisant `code` dans le state React ou en appelant `verify()` avec la bonne réponse. | **Critique** — Nulle protection anti-bot sur formulaire contact, newsletter, vérification | `components/ImageCaptcha.tsx:28-141`, `app/[locale]/contact/page.tsx:36-108` | 2-3 jours |
| **C2** | **Session admin en localStorage** — Access token, refresh token, user info stockés en clair dans `localStorage`. Volables par toute XSS. Pas de `httpOnly`, `secure`, `SameSite`. | **Critique** — Prise de contrôle back-office complète | `lib/admin-session.ts:1-57`, `components/admin/AdminLayout.tsx:79-94` | 3-4 jours |
| **C3** | **Aucun header de sécurité** — Pas de CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. Site vulnérable au clickjacking, MIME sniffing, injection de scripts. | **Critique** — Surface d'attaque XSS/Clickjacking maximale | `next.config.mjs` (absent), `middleware.ts` (absent) | 1 jour |
| **C4** | **Upload de fichiers sans validation contenu** — `app/api/admin/upload/route.ts` accepte tout `File` sans vérification MIME réelle, magic bytes, taille max côté serveur, scan antivirus. Path traversal possible via `folder`/`id`/`slug`. | **Critique** — RCE via upload de shell PHP/Node, traversée de répertoire | `app/api/admin/upload/route.ts:210-270`, `lib/ged/store.mjs:302-366` | 2-3 jours |
| **C5** | **Clés API exposées en GET** — `GET /api/admin/verification` renvoie `apiKey` en clair. `localStorage` admin stocke SMTP pass, ERP key, DB URL. Fuite garantie en cas d'XSS ou devtools. | **Critique** — Compromission services tiers (SMTP, ERP, API vérification) | `app/api/admin/verification/route.ts:26-27`, `lib/admin-settings.ts:115-122` | 1 jour |

---

## 3. Analyse Détaillée par Domaine

### 3.1 Code Review — Bugs, Cas Limites, Dépendances

| Fichier | Problème | Sévérité |
|---------|----------|----------|
| `lib/ged/store.mjs:82-93` | `inside()` protection path traversal correcte MAIS `toAssetRef()` ligne 608-616 ne normalise pas `..` avant `inside()` — contournable via double encodage | 🟠 Élevé |
| `lib/ged/prefix.mjs` | `parseAssetName()` utilise `split('_')` — ambiguïté noms de fichiers legacy | 🟡 Moyen |
| `lib/cms.ts:67-109` | `cmsFetch` timeout 2.5s durci — trop court pour uploads gros fichiers, pas de retry | 🟡 Moyen |
| `lib/verification.ts:345-402` | `callVerificationApi` — pas de validation certificat TLS (défaut Node `fetch`), injection header possible via `authHeader` | 🟠 Élevé |
| `lib/newsletter-captcha.ts:143-182` | Stockage captcha en `globalThis` Map — perdu au redémarrage, pas partagé entre workers (cluster/vercel) | 🟡 Moyen |
| `components/ImageCaptcha.tsx:9-13` | `Math.random()` non cryptographique — prévisible | 🟠 Élevé |
| `lib/password-tools.ts:62-75` | `alea()` fallback `Math.random()` si `crypto.getRandomValues` absent (jamais en prod moderne) | 🟢 Faible |
| `app/api/admin/upload/route.ts:242` | `generateFileName` — `slug` fourni par client, pas sanitizé au-delà `replace(/[^a-z0-9-]/g, '-')` | 🟠 Élevé |

**Dépendances vulnérables (npm audit) :**
- `next@16.2.12` — vérifier advisories récentes
- `fabric@6.9.1` — historique XSS via SVG parsing
- `grapesjs@0.22.14` — vérifier CVE récentes
- `@tiptap/*@3.30.2` — XSS possible via extensions mal configurées

### 3.2 Tests Fonctionnels — Couverture Manquante

| Fonctionnalité | Test Existant | Manquant |
|----------------|---------------|----------|
| Création/édition contenu (builder, GED) | Scripts `test-ged.mjs`, `check-builder-kit.mjs` | Tests d'intégration E2E (Playwright/Cypress), injection HTML/XSS dans blocs |
| Gestion rôles/permissions | `test-access-control.mjs`, `test-user-admin.mjs` | Tests IDOR, élévation privilèges, session hijacking |
| Upload fichiers piégés | Aucun | Polyglots (GIFAR, SVG+JS), ZIP bomb, SVG XSS, EXIF injection |
| Formulaires publics (contact, newsletter, vérification) | Scripts unitaires captcha | Tests entrées extrêmes (10MB payload, Unicode RTL override, null bytes, prototype pollution) |
| Double opt-in newsletter | `newsletter-store.ts` | Test rejouabilité token, énumération emails |

### 3.3 Tests de Charge et Performance — Non Existant

- **Aucun script de charge** (k6, Artillery, Locust)
- **Pas de métriques** : temps de réponse P50/P95/P99, throughput, point de rupture
- **GED** : `listAssets` parcourt tout `public/uploads` — O(n) non paginé côté FS, lenteur dès ~5000 fichiers
- **Canvas/GrapesJS** : chargement runtime lourd, pas de code splitting visible
- **API réécrite** : `/api/v1/*` → proxy vers NestJS — pas de circuit breaker, timeout unique 2.5s

### 3.4 Cybersécurité OWASP Top 10

| A01:2021 - Broken Access Control | Statut |
|----------------------------------|--------|
| AdminLayout vérifie `isAdminUser` côté client seulement (lignes 82-93) — contournable en désactivant JS ou modifiant localStorage | 🔴 **FAIL** |
| Pas de middleware serveur validant rôle admin sur `/admin/*` | 🔴 **FAIL** |
| API admin (`/api/admin/*`) sans garde serveur — appel direct possible | 🔴 **FAIL** |

| A02:2021 - Cryptographic Failures | Statut |
|-----------------------------------|--------|
| Mots de passe : règles côté client seulement (`password-tools.ts`), pas de hash côté serveur visible | 🟡 **PARTIEL** |
| Tokens JWT en localStorage (pas httpOnly) | 🔴 **FAIL** |
| API keys en clair dans réponses GET | 🔴 **FAIL** |

| A03:2021 - Injection | Statut |
|----------------------|--------|
| Upload : pas de validation contenu, exécution possible si serveur mal configuré | 🟠 **RISQUE** |
| `callVerificationApi` : injection header via `authHeader` config admin | 🟠 **RISQUE** |
| Path traversal GED : protection `inside()` mais `toAssetRef` incomplet | 🟡 **ATTENTION** |

| A04:2021 - Insecure Design | Statut |
|----------------------------|--------|
| Architecture "localStorage pour tout" (session, settings, captcha state) — design fondamentalement insécurisé | 🔴 **FAIL** |
| Captcha côté client uniquement — design broken by design | 🔴 **FAIL** |
| Pas de rate limiting global, seulement newsletter/verification | 🟠 **RISQUE** |

| A05:2021 - Security Misconfiguration | Statut |
|--------------------------------------|--------|
| Aucun header de sécurité | 🔴 **FAIL** |
| `next.config.mjs` expose `/api/v1` rewrite sans authentification | 🟠 **RISQUE** |
| `.env.local` non gitignore vérifié (présent dans repo ?) | 🟡 **VÉRIFIER** |
| DevTools accessible en prod (pas de `NODE_ENV=production` forcé) | 🟡 **VÉRIFIER** |

| A06:2021 - Vulnerable Components | Statut |
|----------------------------------|--------|
| `npm audit` non exécuté dans CI | 🟡 **INCONNU** |
| `package-lock.json` présent — versions figées OK | 🟢 **OK** |

| A07:2021 - Identification and Authentication Failures | Statut |
|------------------------------------------------------|--------|
| Pas de 2FA admin (setting `admin2fa` existe mais non implémenté) | 🔴 **FAIL** |
| Pas de verrouillage compte après échecs (sauf newsletter) | 🔴 **FAIL** |
| Session admin sans expiration forcée (pas de `exp` vérifié côté client) | 🟠 **RISQUE** |

| A08:2021 - Software and Data Integrity Failures | Statut |
|-------------------------------------------------|--------|
| Pas de signature/validation des assets GED | 🟡 **ATTENTION** |
| `gedStore` écriture manifeste sans signature — modification indétectable | 🟡 **ATTENTION** |
| CI/CD non visible — pas de SBOM, pas de sigstore | 🟡 **INCONNU** |

| A09:2021 - Security Logging and Monitoring Failures | Statut |
|-----------------------------------------------------|--------|
| **Aucun log de sécurité** (échecs login, changements droits, upload, admin actions) | 🔴 **FAIL** |
| `console.error` seulement — pas de strukturée, pas d'alerting | 🔴 **FAIL** |

| A10:2021 - Server-Side Request Forgery | Statut |
|----------------------------------------|--------|
| `callVerificationApi` appelle URL admin-configurable — SSRF possible vers metadata cloud (169.254.169.254), localhost, réseau interne | 🔴 **FAIL** |
| `cmsFetch` rewrite `/api/v1` vers `CMS_API_INTERNAL_URL` — SSRF si variable compromise | 🟠 **RISQUE** |

---

### 3.5 Anti-Spam

| Mesure | Implémentée | Qualité |
|--------|-------------|---------|
| Honeypot (champ `website`) | ✅ Newsletter, Vérification | Bien |
| Rate limiting par IP | ✅ Newsletter (6/5min), Vérification (12/5min) | Partiel (pas global) |
| Captcha image | ✅ Newsletter, Vérification (server-side) | **Bien** |
| Captcha image | ❌ Contact (client-side `ImageCaptcha`) | **BROKEN** |
| Captcha image | ❌ Inscription, Connexion, Devis | **ABSENT** |
| Validation email (format + MX) | ❌ Regex seulement | **FAIBLE** |
| Double opt-in newsletter | ✅ Token email | **Bien** |
| Modération commentaires | ❌ Pas de système commentaires visible | N/A |

### 3.6 Anti-Fraude

| Mesure | Implémentée | Qualité |
|--------|-------------|---------|
| Détection comptes en masse | ❌ | **ABSENT** |
| Détection connexions anormales (geo, device, velocity) | ❌ | **ABSENT** |
| Verrouillage compte | ❌ (setting existe, non utilisé) | **ABSENT** |
| Logs d'audit admin | ❌ | **ABSENT** |
| RGPD (export/suppression données) | ❌ | **ABSENT** |
| PCI-DSS (paiements) | ❌ Pas de scope visible | **INCONNU** |

---

## 4. Plan de Correction Priorisé

### Phase 1 — Bloquants Production (Semaine 1-2)
1. **[C1]** Remplacer `ImageCaptcha` client-side par captcha server-side (réutiliser `newsletter-captcha`)
2. **[C2]** Migrer session admin → cookies `httpOnly` + `secure` + `SameSite=Strict` + CSRF token
3. **[C3]** Implémenter headers sécurité via `next.config.mjs` `headers()` + middleware
4. **[C4]** Sécuriser upload : validation MIME (magic bytes), taille max, scan ClamAV optionnel, nommage sûr
5. **[C5]** Masquer `apiKey` dans GET `/api/admin/verification`, chiffrer settings sensibles

### Phase 2 — Durcissement (Semaine 2-3)
6. Middleware serveur validant rôle admin sur `/admin/*` et `/api/admin/*`
7. Rate limiting global (middleware) + par endpoint critique
8. CSP strict (`script-src 'self' 'nonce-...'`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: https:`, `connect-src 'self'`, `frame-ancestors 'none'`)
9. Audit logging structuré (winston/pino) : login, logout, échecs, actions admin, upload, changements config
10. Validation entrées : Zod schemas sur toutes les API routes
11. SSRF protection : allowlist domaines pour `verification.api.url` et `CMS_API_INTERNAL_URL`
12. Remplacer `Math.random()` → `crypto.randomBytes` partout

### Phase 3 — Qualité & Conformité (Semaine 3-4)
13. Tests E2E Playwright : auth, upload, formulaires, builder
14. Tests charge k6 : scenarios lecture/écriture, pic, endurance
15. `security.txt`, `robots.txt`, `.well-known/`
16. RGPD : endpoints export/suppression données utilisateur
17. Documentation runbooks incident réponse

---

## 5. Checklist Go/No-Go Pré-Production

| Critère | Statut | Preuve Requise |
|---------|--------|----------------|
| CSP header présent et strict | ❌ | `curl -I https://prod/` |
| HSTS preload ready | ❌ | `hstspreload.org` check |
| Session admin httpOnly + CSRF | ❌ | DevTools Application > Cookies |
| Captcha server-side sur TOUS formulaires publics | ❌ | Code review + test manuel |
| Upload validation MIME + taille + scan | ❌ | Test upload .php, .svg+js, 100MB |
| Rate limiting global + endpoints critiques | ❌ | k6 test 100 req/s |
| Audit logs structurés + alerting | ❌ | Log sample + dashboard |
| SSRF protection (allowlist) | ❌ | Test appel 169.254.169.254 |
| Secrets hors code (.env, vault) | ❌ | `grep -r "apiKey\|password" --include="*.ts" --include="*.js"` |
| npm audit clean (0 high/critical) | ❌ | `npm audit` output |
| Tests E2E passent (CI) | ❌ | Pipeline vert |
| Tests charge : <200ms P95, 1000 req/s | ❌ | Rapport k6 |
| RGPD export/delete implémenté | ❌ | Démonstration |

---

## 6. Score de Confiance Global Honnête

| Dimension | Score | Justification |
|-----------|-------|---------------|
| **Authentification/Autorisation** | 2/10 | Côté client seulement, pas de 2FA, session localStorage |
| **Protection Entrées/Sorties** | 3/10 | Validation partielle, pas de CSP, XSS facile via builder/GED |
| **Gestion Fichiers** | 2/10 | Upload sans validation contenu, path traversal risque |
| **Monitoring/Logging** | 1/10 | Inexistant |
| **Architecture Sécurisée** | 3/10 | Design localStorage, pas de défense en profondeur |
| **Dépendances** | 6/10 | Lockfile OK, mais audit non automatisé |
| **Conformité** | 2/10 | RGPD/PCI absent, OWASP 7/10 FAIL |

**SCORE GLOBAL : 2.7 / 10** — **NON PRÊT POUR PRODUCTION**

---

## 7. Recommandation Immédiate

**ARRÊTER TOUT DÉPLOIEMENT PRODUCTION.** Corriger les 5 problèmes critiques (C1-C5) en priorité absolue. Estimation : **10-15 jours développeur** pour atteindre un niveau "Go conditionnel" (score ≥ 7/10 avec monitoring actif).