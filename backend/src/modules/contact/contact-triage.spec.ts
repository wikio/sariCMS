import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import * as fs from 'node:fs';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { AuditService } from '../../common/audit/audit.service';
import { AppCacheService } from '../../common/cache/cache.service';
import {
  AUDIT_LOG_REPOSITORY,
  CONTACT_INFO_REPOSITORY,
  CONTACT_MESSAGE_REPOSITORY,
  CONTACT_PENALTY_REPOSITORY,
  SETTING_REPOSITORY,
  USER_REPOSITORY,
} from '../../common/constants/tokens';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { JsonRepository } from '../../database/adapters/json/json-repository';
import { JsonStore } from '../../database/adapters/json/json-store';
import { AuthService } from '../auth/auth.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { SUBJECTS } from './contact-contract';
import { ContactAiSettingsService } from './contact-ai-settings.service';
import { ContactAiService } from './contact-ai.service';
import { ContactDossierService } from './contact-dossier.service';
import { ContactInfoService } from './contact-info.service';
import { ContactIntakeService } from './contact-intake.service';
import { ContactMessagesController } from './contact-messages.controller';
import { ContactMessagesService } from './contact-messages.service';
import { ContactPolicyService, defaultPolicy } from './contact-policy.service';
import { ContactTriageController } from './contact-triage.controller';

const key = 'shared-test-key',
  secret = 'jwt-test-secret';
const signer = new JwtService({ secret });
const token = (id: number, typ = 'access') => `Bearer ${signer.sign({ sub: id, typ }, { expiresIn: '1h' })}`;
const dto = {
  name: 'Nadia Test',
  email: 'other@example.test',
  phone: '+12025550101',
  company: 'Fixture',
  locale: 'fr',
  subject: 'devis',
  message: 'Demande de devis pour du matériel de test.',
};
const matched = {
  spam: false,
  inappropriate: false,
  matchesSubject: true,
  suggestedSubject: null,
  confidence: 98,
};
const response = (v: unknown) =>
  Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(v) } }] });
const external = { mode: 'external', email: 'assistance@example.test' };
const policy = () => ({
  ...defaultPolicy(),
  spam: 'discard',
  inappropriate: 'discard',
  mismatch: 'reclassify',
  penaltyPoints: 3,
  routes: { ...defaultPolicy().routes, technique: external },
});

describe('Contact — relais, décision et dossier avec le vrai JWT et un magasin jetable', () => {
  let dir: string,
    app: INestApplication,
    store: JsonStore,
    ai: jest.SpiedFunction<typeof fetch>,
    config: ConfigService;
  const submit = (body = dto, authorization?: string) => {
    const req = request(app.getHttpServer()).post('/contact/messages').set('x-mail-internal-key', key);
    return (authorization ? req.set('Authorization', authorization) : req).send(body);
  };
  const url = '/contact/triage/policy';
  const setPolicy = (p: unknown) =>
    request(app.getHttpServer())
      .put(url)
      .set('Authorization', token(2))
      .send(p as object);
  const dossier = (id: number) =>
    request(app.getHttpServer()).get(`/contact/triage/accounts/${id}`).set('Authorization', token(2));

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'contact-spec-'));
    store = new JsonStore(join(dir, 'json'));
    await store.write('users', [
      { id: 1, email: 'actual@example.test', status: 'active', type: 'client' },
      { id: 2, email: 'staff@example.test', status: 'active', type: 'admin' },
      { id: 3, email: dto.email, status: 'active', type: 'client' },
      { id: 5, email: 'reader@example.test', status: 'active', type: 'employee' },
      { id: 4, email: 'inactive@example.test', status: 'blocked', type: 'client' },
    ]);
    await store.write('contact_info', [{ id: 1, locale: 'fr', email: 'published@example.test' }]);
    const vars: Record<string, string> = {
      JSON_STORE_PATH: join(dir, 'json'),
      MAIL_INTERNAL_KEY: key,
      JWT_ACCESS_SECRET: secret,
      CONTACT_AI_API_KEY: 'only-for-fake-provider',
      CONTACT_AI_MODEL: 'local-test',
      CONTACT_AI_URL: 'https://classifier.invalid/completions',
    };
    config = {
      get: (k: string) => vars[k],
      set: (k: string, v: string) => {
        vars[k] = v;
      },
    } as ConfigService;
    const cache = new Map();
    const mod = await Test.createTestingModule({
      controllers: [ContactMessagesController, ContactTriageController],
      providers: [
        ContactInfoService,
        ContactIntakeService,
        ContactPolicyService,
        ContactAiSettingsService,
        ContactAiService,
        ContactDossierService,
        ContactMessagesService,
        AuditService,
        JwtStrategy,
        JwtAuthGuard,
        PermissionsGuard,
        { provide: ConfigService, useValue: config },
        {
          provide: AuthService,
          useValue: {
            resolveRoleSlug: () => undefined,
            resolvePermissions: (u: { type: string }) =>
              u.type === 'admin' ? ['*'] : u.type === 'employee' ? ['settings:read'] : [],
          },
        },
        {
          provide: AppCacheService,
          useValue: {
            delByPrefix: () => undefined,
            set: cache.set.bind(cache),
            get: cache.get.bind(cache),
            del: cache.delete.bind(cache),
          },
        },
        ...[
          [SETTING_REPOSITORY, 'settings'],
          [USER_REPOSITORY, 'users'],
          [CONTACT_MESSAGE_REPOSITORY, 'contact_messages'],
          [CONTACT_INFO_REPOSITORY, 'contact_info'],
          [CONTACT_PENALTY_REPOSITORY, 'contact_penalties'],
          [AUDIT_LOG_REPOSITORY, 'audit_logs'],
        ].map(([provide, name]) => ({
          provide: provide as symbol,
          useValue: new JsonRepository(name as string, store),
        })),
      ],
    }).compile();
    app = mod.createNestApplication();
    app.useGlobalGuards(mod.get(JwtAuthGuard), mod.get(PermissionsGuard));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
    ai = jest.spyOn(global, 'fetch').mockImplementation(async () => response(matched));
  });
  afterEach(async () => {
    jest.restoreAllMocks();
    await app?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('bloque le POST direct, les identités/destinations imposées et les sujets hors liste avant toute analyse', async () => {
    await request(app.getHttpServer()).post('/contact/messages').send(dto).expect(401);
    await request(app.getHttpServer())
      .post('/contact/messages')
      .set('Authorization', token(2))
      .set('x-mail-internal-key', 'wrong')
      .send(dto)
      .expect(401);
    await submit({ ...dto, userId: 3, route: external } as typeof dto, token(1)).expect(400);
    await submit({ ...dto, subject: 'other' }).expect(400);
    expect(ai).not.toHaveBeenCalled();
    expect(store.read('contact_messages')).toEqual([]);
  });
  it('la classification précède la première écriture et ne reçoit pas les coordonnées ni les jetons du visiteur', async () => {
    ai.mockImplementationOnce(async (target, opts) => {
      expect(String(target)).toBe('https://classifier.invalid/completions');
      expect(store.read('contact_messages')).toEqual([]);
      const body = JSON.parse(String(opts?.body));
      expect(body.model).toBe('local-test');
      expect(JSON.parse(body.messages[1].content)).toEqual({
        subject: 'devis',
        locale: 'fr',
        message: dto.message,
      });
      expect(JSON.stringify(body)).not.toContain(dto.email);
      expect(opts?.redirect).toBe('error');
      return response(matched);
    });
    const result = await submit(dto, token(1)).expect(201);
    expect(result.body).toEqual({
      decision: 'accept',
      subject: 'devis',
      id: 1,
      route: { mode: 'company', email: 'published@example.test' },
    });
    expect(store.read('contact_messages')[0]).toMatchObject({
      status: 'new',
      createdBy: 1,
      meta: { locale: 'fr', company: 'Fixture' },
    });
    expect(JSON.stringify(store.read('audit_logs'))).not.toContain(dto.message);
  });
  it('aucune adresse CMS publiée dans la langue du message : conserve la demande sans inventer de destinataire', async () => {
    const r = await submit({ ...dto, locale: 'ar' }).expect(201);
    expect(r.body.route).toEqual({ mode: 'company', email: null });
    expect(store.read('contact_messages')[0].status).toBe('new');
  });
  it('chaque motif dispose de sa propre destination et le retrait à zéro ne crée pas de remarque', async () => {
    const routes = Object.fromEntries(
      SUBJECTS.map((s) => [s, { mode: 'external', email: `${s}@example.test` }]),
    );
    await setPolicy({ ...policy(), routes, penaltyPoints: 0 }).expect(200);
    for (const subject of SUBJECTS) {
      const r = await submit({ ...dto, subject }).expect(201);
      expect(r.body.route).toEqual(routes[subject]);
    }
    ai.mockResolvedValueOnce(response({ ...matched, inappropriate: true }));
    expect((await submit(dto, token(1))).body.decision).toBe('discard');
    expect(store.read('contact_penalties')).toEqual([]);
  });
  it('reclasse un sujet non concordant et choisit exclusivement la règle du nouveau sujet', async () => {
    await setPolicy(policy()).expect(200);
    ai.mockResolvedValueOnce(response({ ...matched, matchesSubject: false, suggestedSubject: 'technique' }));
    expect((await submit().expect(201)).body).toMatchObject({
      decision: 'accept',
      subject: 'technique',
      route: external,
    });
    expect(store.read('contact_messages')[0]).toMatchObject({
      status: 'new',
      subject: 'technique',
      meta: { selectedSubject: 'devis', suggestedSubject: 'technique', route: external },
    });
  });
  it.each(['spam', 'inappropriate'] as const)(
    'rejet %s : le texte disparaît, un seul débit et une remarque sur le compte vérifié, réversible',
    async (reason) => {
      await setPolicy(policy()).expect(200);
      ai.mockImplementation(async () => response({ ...matched, [reason]: true }));
      for (const authorization of [undefined, 'Bearer invalid', token(1, 'refresh'), token(4), token(1)]) {
        expect((await submit(dto, authorization).expect(201)).body).toEqual({ decision: 'discard' });
      }
      expect(store.read('contact_messages')).toEqual([]);
      expect(JSON.stringify(store.snapshot())).not.toContain(dto.message);
      const result = await dossier(1).expect(200);
      expect(result.body).toMatchObject({ score: -3, total: 1, notes: [{ reason, points: -3 }] });
      expect((await dossier(3)).body.score).toBe(0);
      const id = result.body.notes[0].id;
      await request(app.getHttpServer())
        .delete(`/contact/triage/accounts/3/penalties/${id}`)
        .set('Authorization', token(2))
        .expect(404);
      await request(app.getHttpServer())
        .delete(`/contact/triage/accounts/1/penalties/${id}`)
        .set('Authorization', token(2))
        .expect(200);
      expect((await dossier(1)).body).toEqual({ score: 0, total: 0, notes: [] });
    },
  );
  it.each([
    ['score faible', { ...matched, spam: true, confidence: 60 }, 'uncertain'],
    ['mauvais schéma', { ...matched, spam: 'false' }, 'ai_unavailable'],
    ['destinataire proposé par le modèle', { ...matched, email: external.email }, 'ai_unavailable'],
    [
      'catégorie inconnue',
      { ...matched, matchesSubject: false, suggestedSubject: 'inconnu' },
      'ai_unavailable',
    ],
    ['catégorie contradictoire', { ...matched, suggestedSubject: 'rh' }, 'ai_unavailable'],
    ['désaccord sans suggestion', { ...matched, matchesSubject: false }, 'mismatch'],
  ])('quarantaine sans sanction ni destinataire : %s', async (_label, verdict, reason) => {
    await setPolicy(policy()).expect(200);
    ai.mockResolvedValueOnce(response(verdict));
    expect((await submit(dto, token(1))).body).toEqual({ decision: 'review' });
    expect(store.read('contact_messages')[0]).toMatchObject({ status: 'review', meta: { reason } });
    expect(store.read('contact_messages')[0].meta).not.toHaveProperty('route');
    expect(store.read('contact_penalties')).toEqual([]);
  });
  it('aucun modèle, timeout, réponse illisible, refus HTTP ou règles illisibles : aucune acceptation', async () => {
    ai.mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(new Response('not json'))
      .mockResolvedValueOnce(new Response('', { status: 429 }));
    for (let i = 0; i < 3; i++) expect((await submit()).body.decision).toBe('review');
    config.set('CONTACT_AI_API_KEY', '');
    expect((await submit()).body.decision).toBe('review');
    await store.write('settings', [{ id: 1, key: 'contact_triage', value: {} }]);
    expect((await submit()).body.decision).toBe('review');
    expect(ai).toHaveBeenCalledTimes(3);
    expect(store.read('contact_messages')[4]).toMatchObject({
      status: 'review',
      meta: { reason: 'policy_unavailable' },
    });
  });
  it('par défaut pas de suppression ; un opérateur peut accepter, reclasser, noter puis purger sans effet implicite', async () => {
    ai.mockResolvedValueOnce(response({ ...matched, spam: true }));
    await submit(dto, token(1)).expect(201);
    const path = '/contact/messages/1';
    const q = await request(app.getHttpServer())
      .get('/contact/messages')
      .set('Authorization', token(2))
      .query({ filter: JSON.stringify({ status: 'review' }) })
      .expect(200);
    expect(q.body.meta.total).toBe(1);
    const saved = await request(app.getHttpServer())
      .patch(path)
      .set('Authorization', token(2))
      .send({ status: 'new', subject: 'rh', followUp: 'Appeler lundi' })
      .expect(200);
    expect(saved.body).toMatchObject({
      status: 'new',
      subject: 'rh',
      meta: { selectedSubject: 'devis', followUp: 'Appeler lundi' },
    });
    const req = await request(app.getHttpServer())
      .post(`${path}/purge`)
      .set('Authorization', token(2))
      .expect(200);
    await request(app.getHttpServer())
      .delete(`${path}/purge`)
      .query({ confirm: req.body.confirm })
      .set('Authorization', token(2))
      .expect(200);
    expect(ai).toHaveBeenCalledTimes(1);
    expect(store.read('contact_penalties')).toEqual([]);
    expect(JSON.stringify(store.snapshot())).not.toContain(dto.message);
  });
  it('la lecture et la configuration ne sont pas publiques ; clés, multi-destinataires et points hors limites sont refusés', async () => {
    for (const path of [url, '/contact/messages', '/contact/triage/accounts/1']) {
      await request(app.getHttpServer()).get(path).expect(401);
      await request(app.getHttpServer()).get(path).set('Authorization', token(1)).expect(403);
    }
    await request(app.getHttpServer()).put(url).set('Authorization', token(1)).send(policy()).expect(403);
    const state = (await request(app.getHttpServer()).get(url).set('Authorization', token(2))).body;
    expect(state.ai).toMatchObject({ configured: true, model: 'local-test', source: 'env' });
    for (const diff of [
      { CONTACT_AI_API_KEY: 'secret' },
      { penaltyPoints: -1 },
      { minConfidence: 0 },
      { routes: {} },
      { routes: { ...policy().routes, devis: { mode: 'external', email: 'a@example.test,b@example.test' } } },
    ]) {
      await setPolicy({ ...policy(), ...diff }).expect(400);
    }
    expect(store.read('settings')).toEqual([]);
  });
  it('deux débits simultanés sont deux remarques persistées, pas une écriture écrasée', async () => {
    const d = app.get(ContactDossierService);
    await Promise.all([d.deduct(1, 2, 'spam'), d.deduct(1, 5, 'inappropriate')]);
    expect(await d.read('1')).toMatchObject({ total: 2, score: -7 });
  });
  describe('Connexion LLM depuis les paramètres', () => {
    const path = '/contact/triage/connection';
    const empty = { url: '', model: '' };
    const form = {
      url: 'https://model.example.test/v1/chat/completions',
      model: 'modele-admin',
      apiKey: 'fixture-page-key',
    };
    const envUrl = 'https://classifier.invalid/completions';
    const getStatus = async (id = 2) =>
      (await request(app.getHttpServer()).get(url).set('Authorization', token(id)).expect(200)).body.ai;
    const put = (v: object) => request(app.getHttpServer()).put(path).set('Authorization', token(2)).send(v);
    const testDraft = (v: object) =>
      request(app.getHttpServer()).post(`${path}/test`).set('Authorization', token(2)).send(v);
    const clear = () => request(app.getHttpServer()).delete(path).set('Authorization', token(2));
    const privateFile = () => join(dir, 'private/contact-ai.json');
    const lastCall = () => {
      const [target, opts] = ai.mock.calls[ai.mock.calls.length - 1];
      return {
        url: String(target),
        auth: new Headers(opts?.headers).get('authorization'),
        body: JSON.parse(String(opts?.body)),
      };
    };

    it('teste les valeurs non enregistrées sans message réel, sauvegarde ou effet sur le tri actif', async () => {
      expect(await getStatus()).toEqual({
        configured: true,
        model: 'local-test',
        source: 'env',
        overrides: { ...empty, hasKey: false },
      });
      expect((await testDraft(form).expect(200)).body).toEqual({ code: 'ok' });
      const probe = lastCall();
      expect(probe).toMatchObject({
        url: form.url,
        auth: `Bearer ${form.apiKey}`,
        body: { model: form.model },
      });
      expect(JSON.parse(probe.body.messages[1].content)).toEqual({
        subject: 'devis',
        locale: 'fr',
        message: expect.stringContaining('test de connexion'),
      });
      expect(fs.existsSync(privateFile())).toBe(false);
      expect(store.read('contact_messages')).toEqual([]);
      expect(store.read('contact_penalties')).toEqual([]);
      expect(store.read('settings')).toEqual([]);
      await submit().expect(201);
      expect(lastCall()).toMatchObject({
        url: envUrl,
        auth: 'Bearer only-for-fake-provider',
        body: { model: 'local-test' },
      });
    });
    it('applique la priorité de la page, survit à une nouvelle instance, conserve la clé masquée et revient au .env', async () => {
      const saved = (await put(form).expect(200)).body;
      expect(saved).toEqual({
        configured: true,
        source: 'admin',
        model: form.model,
        overrides: { url: form.url, model: form.model, hasKey: true },
      });
      expect(new ContactAiSettingsService(config).status()).toEqual(saved);
      expect(await getStatus(5)).toEqual(saved);
      expect(fs.statSync(privateFile()).mode & 0o777).toBe(0o600);
      expect(fs.readdirSync(join(dir, 'private'))).toEqual(['contact-ai.json']);
      await put({ url: form.url, model: 'v2', apiKey: '' }).expect(200);
      await submit().expect(201);
      expect(lastCall()).toMatchObject({
        url: form.url,
        auth: `Bearer ${form.apiKey}`,
        body: { model: 'v2' },
      });
      expect(JSON.stringify(store.snapshot())).not.toContain(form.apiKey);
      expect((await clear().expect(200)).body.source).toBe('env');
      expect(fs.existsSync(privateFile())).toBe(false);
      await submit().expect(201);
      expect(lastCall()).toMatchObject({
        url: envUrl,
        auth: 'Bearer only-for-fake-provider',
        body: { model: 'local-test' },
      });
    });
    it('utilise les champs .env manquants sans copier sa clé ; une clé saisie reste liée à son URL', async () => {
      await put({ ...empty, model: 'autre-modele' }).expect(200);
      expect(JSON.parse(fs.readFileSync(privateFile(), 'utf8'))).toEqual({ url: '', model: 'autre-modele' });
      config.set('CONTACT_AI_API_KEY', 'rotated-env-key');
      await submit().expect(201);
      expect(lastCall()).toMatchObject({
        url: envUrl,
        auth: 'Bearer rotated-env-key',
        body: { model: 'autre-modele' },
      });
      await put({ ...empty, apiKey: form.apiKey }).expect(200);
      config.set('CONTACT_AI_URL', 'https://second.example.test/completions');
      await submit().expect(201);
      expect(lastCall()).toMatchObject({
        url: envUrl,
        auth: `Bearer ${form.apiKey}`,
        body: { model: 'local-test' },
      });
      expect((await put({ ...empty, apiKey: '' }).expect(200)).body.source).toBe('env');
      expect(fs.existsSync(privateFile())).toBe(false);
    });
    it('ne réutilise ni une clé .env ni une clé mémorisée pour un endpoint différent, même sur la même origine', async () => {
      for (const draft of [
        { url: form.url, model: '' },
        { url: `${envUrl}/other`, model: 'm' },
      ]) {
        expect((await testDraft(draft).expect(200)).body).toEqual({ code: 'incomplete' });
        await put(draft).expect(400);
      }
      await put(form).expect(200);
      const changed = { url: `${form.url}/other`, model: 'v2' };
      expect((await testDraft(changed).expect(200)).body).toEqual({ code: 'incomplete' });
      await put(changed).expect(400);
      expect(ai).not.toHaveBeenCalled();
      expect((await getStatus()).overrides.url).toBe(form.url);
      expect((await testDraft({ ...changed, apiKey: 'second-key' }).expect(200)).body.code).toBe('ok');
      expect(lastCall().auth).toBe('Bearer second-key');
    });
    it('création depuis la page même sans les trois variables ; absence totale et fichier illisible gardent la demande à vérifier', async () => {
      for (const name of ['URL', 'MODEL', 'API_KEY']) config.set(`CONTACT_AI_${name}`, '');
      expect((await getStatus()).source).toBe('none');
      expect((await testDraft(empty).expect(200)).body.code).toBe('incomplete');
      expect((await submit()).body.decision).toBe('review');
      await put(form).expect(200);
      expect((await submit()).body.decision).toBe('accept');
      config.set('CONTACT_AI_URL', envUrl);
      config.set('CONTACT_AI_MODEL', 'fallback');
      config.set('CONTACT_AI_API_KEY', 'fallback-key');
      fs.writeFileSync(privateFile(), 'corrompu');
      expect(await getStatus()).toMatchObject({ source: 'unreadable', configured: false });
      expect((await submit()).body.decision).toBe('review');
      expect(ai).toHaveBeenCalledTimes(1);
      expect((await clear()).body.source).toBe('env');
      const q = await request(app.getHttpServer())
        .get('/contact/messages')
        .query({ view: 'block', filter: JSON.stringify({ status: 'review' }) })
        .set('Authorization', token(2))
        .expect(200);
      expect(q.body.data).toHaveLength(2);
      expect(q.body.data[0].message).toBe(dto.message);
    });
    it('test : diagnostic borné, jamais le corps ni l’erreur du fournisseur', async () => {
      for (const [reply, code] of [
        [new Response(form.apiKey, { status: 401 }), 'auth'],
        [new Response(form.apiKey, { status: 502 }), 'unavailable'],
        [new Response('non JSON: ' + form.apiKey), 'invalidResponse'],
        [new Response('x'.repeat(80_000)), 'invalidResponse'],
        [response({ ...matched, confidence: 101 }), 'invalidResponse'],
      ] as const) {
        ai.mockResolvedValueOnce(reply);
        expect((await testDraft(form).expect(200)).body).toEqual({ code });
      }
      ai.mockRejectedValueOnce(new Error(form.apiKey));
      expect((await testDraft(form).expect(200)).body).toEqual({ code: 'unavailable' });
      expect(fs.existsSync(privateFile())).toBe(false);
    });
    it('seuls les administrateurs habilités peuvent tester, écrire ou effacer ; refuse les données inattendues avant tout appel', async () => {
      for (const req of [
        () => request(app.getHttpServer()).put(path).send(form),
        () => request(app.getHttpServer()).post(`${path}/test`).send(form),
        () => request(app.getHttpServer()).delete(path),
      ]) {
        await req().expect(401);
        await req().set('Authorization', token(5)).expect(403); // settings:read uniquement
      }
      for (const diff of [
        { url: 'http://model.example.test/completions' },
        { url: 'https://name:password@model.example.test/' },
        { url: form.url + '?key=never-in-a-url' },
        { url: form.url + '#frag' },
        { apiKey: 'a\r\nb' },
        { model: 'x'.repeat(257) },
        { message: dto.message },
      ]) {
        const body = { ...form, ...diff };
        const res = await testDraft(body).expect(400);
        expect(res.text).not.toContain(form.apiKey);
        await put(body).expect(400);
      }
      expect(ai).not.toHaveBeenCalled();
      expect(fs.existsSync(privateFile())).toBe(false);
    });
    it('valide l’appel HTTP Chat Completions de bout en bout sur un fournisseur simulé local', async () => {
      ai.mockRestore();
      let received: { url?: string; auth?: string; data?: string } = {};
      const server = createServer(async (req, res) => {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        received = {
          url: req.url,
          auth: req.headers.authorization,
          data: Buffer.concat(chunks).toString('utf8'),
        };
        res.setHeader('content-type', 'application/json');
        res.end(
          JSON.stringify({
            choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(matched) } }],
          }),
        );
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      try {
        const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/chat/completions`;
        expect((await testDraft({ ...form, url }).expect(200)).body).toEqual({ code: 'ok' });
        expect(received.url).toBe('/v1/chat/completions');
        expect(received.auth).toBe(`Bearer ${form.apiKey}`);
        expect(JSON.parse(received.data!).model).toBe(form.model);
        expect(store.read('contact_messages')).toEqual([]);
      } finally {
        await new Promise<void>((resolve) => server.close(() => resolve()));
      }
    });
  });
});
