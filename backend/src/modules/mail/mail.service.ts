import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { createTransport, Transporter } from 'nodemailer';
import { SaveSmtpDto } from './dto/smtp.dto';

export interface MailPayload {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
}

export interface OutboxEntry extends MailPayload {
  id: string;
  sentAt: string;
  provider: 'smtp' | 'file';
  messageId?: string;
  error?: string;
}

/** Réglages SMTP en vigueur, toutes sources confondues. */
export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from?: string;
  replyTo?: string;
}

/**
 * D'où viennent les réglages appliqués.
 *
 * `file` = enregistrés depuis l'écran Paramètres, `env` = variables
 * d'environnement, `none` = rien : les emails partent dans l'outbox JSON.
 */
export type SmtpSource = 'file' | 'env' | 'none';

/**
 * État renvoyé à l'écran d'administration.
 *
 * Le mot de passe n'en fait **jamais** partie : `hasPassword` dit seulement s'il
 * y en a un. L'écran peut ainsi afficher « enregistré » sans jamais recevoir le
 * secret en clair.
 */
export interface SmtpStatus {
  configured: boolean;
  source: SmtpSource;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  replyTo: string;
  hasPassword: boolean;
  /** Un fichier `smtp.json` existe : l'écran peut proposer de repartir de zéro. */
  stored: boolean;
}

/** Résultat d'un test, pensé pour être affiché tel quel à l'administrateur. */
export interface SmtpTestResult {
  ok: boolean;
  /** `connect` = session ouverte et authentifiée, `send` = message remis. */
  stage: 'connect' | 'send';
  message: string;
  /** Code nodemailer (`EAUTH`, `ECONNECTION`…) quand il y en a un. */
  code?: string;
  tookMs: number;
  host: string;
  port: number;
  messageId?: string;
}

const DEFAULT_FROM = 'SARI Système <noreply@sarisysteme.com>';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly outboxPath: string;
  private readonly smtpPath: string;
  private smtp: SmtpConfig = { host: '', port: 587, secure: false };
  private source: SmtpSource = 'none';
  /** Compteur de fichiers temporaires — voir `writeJsonAtomic`. */
  private tmpSeq = 0;

  constructor(private readonly config: ConfigService) {
    const jsonPath = config.get<string>('JSON_STORE_PATH') || './storage/json';
    // Les emails « envoyés » hors SMTP sont journalisés dans un fichier dédié,
    // et les réglages saisis depuis l'écran vivent à côté.
    const mailDir = path.resolve(path.dirname(jsonPath), 'mail');
    this.outboxPath = path.join(mailDir, 'outbox.json');
    this.smtpPath = path.join(mailDir, 'smtp.json');
    this.applyConfig();
  }

  /* -----------------------------------------------------------------------
   * Résolution des réglages
   * --------------------------------------------------------------------- */

  /** Réglages enregistrés depuis l'écran Paramètres, ou `null`. */
  private readStored(): SmtpConfig | null {
    try {
      if (!fs.existsSync(this.smtpPath)) return null;
      const parsed = JSON.parse(fs.readFileSync(this.smtpPath, 'utf8')) as Partial<SmtpConfig>;
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        host: String(parsed.host || '').trim(),
        port: Number(parsed.port) > 0 ? Number(parsed.port) : 587,
        secure: Boolean(parsed.secure),
        user: parsed.user ? String(parsed.user) : undefined,
        pass: parsed.pass ? String(parsed.pass) : undefined,
        from: parsed.from ? String(parsed.from) : undefined,
        replyTo: parsed.replyTo ? String(parsed.replyTo) : undefined,
      };
    } catch (err) {
      // Un fichier illisible ne doit pas empêcher l'API de démarrer : on retombe
      // sur les variables, et on le dit.
      this.logger.warn(`smtp.json illisible, ignoré : ${(err as Error).message}`);
      return null;
    }
  }

  /** Réglages issus des variables d'environnement. */
  private envConfig(): SmtpConfig {
    return {
      host: String(this.config.get('SMTP_HOST') || '').trim(),
      port: Number(this.config.get('SMTP_PORT') || 587),
      secure: String(this.config.get('SMTP_SECURE') || '').toLowerCase() === 'true',
      user: this.config.get('SMTP_USER') ? String(this.config.get('SMTP_USER')) : undefined,
      pass: this.config.get('SMTP_PASS') ? String(this.config.get('SMTP_PASS')) : undefined,
      from: this.config.get('SMTP_FROM') ? String(this.config.get('SMTP_FROM')) : undefined,
      replyTo: this.config.get('SMTP_REPLY_TO')
        ? String(this.config.get('SMTP_REPLY_TO'))
        : undefined,
    };
  }

  /**
   * Recalcule les réglages en vigueur et reconstruit le transport.
   *
   * Le fichier enregistré l'emporte : c'est le choix explicite de
   * l'administrateur, fait depuis l'écran. Les variables servent de secours tant
   * que rien n'a été enregistré — un déploiement cPanel configuré par `.env`
   * continue de fonctionner tel quel.
   */
  private applyConfig(): void {
    const stored = this.readStored();
    const fromEnv = this.envConfig();

    if (stored && stored.host) {
      this.smtp = stored;
      this.source = 'file';
    } else if (fromEnv.host) {
      this.smtp = fromEnv;
      this.source = 'env';
    } else {
      this.smtp = fromEnv;
      this.source = 'none';
    }

    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }

    if (this.smtp.host) {
      this.transporter = createTransport({
        host: this.smtp.host,
        port: this.smtp.port,
        secure: this.smtp.secure,
        auth:
          this.smtp.user && this.smtp.pass
            ? { user: this.smtp.user, pass: this.smtp.pass }
            : undefined,
      } as Parameters<typeof createTransport>[0]);
      this.logger.log(
        `SMTP transport prêt (${this.smtp.host}:${this.smtp.port}, source « ${this.source} »)`,
      );
    } else {
      this.logger.warn(
        'SMTP non configuré — mode « fichier » (outbox JSON), aucun email réel envoyé.',
      );
    }
  }

  /* -----------------------------------------------------------------------
   * Écriture atomique
   * --------------------------------------------------------------------- */

  /**
   * Écriture atomique au nom unique.
   *
   * Un temporaire à nom fixe faisait se marcher dessus deux écritures menées de
   * front (la première renommait, la seconde échouait en `ENOENT` et laissait le
   * fichier tronqué). Un échec nettoie son temporaire.
   */
  private writeJsonAtomic(file: string, data: unknown): void {
    const tmp = `${file}.${process.pid}.${++this.tmpSeq}.tmp`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    try {
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tmp, file);
    } catch (err) {
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        /* au mieux */
      }
      throw err;
    }
  }

  /* -----------------------------------------------------------------------
   * État, enregistrement, test
   * --------------------------------------------------------------------- */

  smtpStatus(): SmtpStatus {
    return {
      configured: !!this.transporter,
      source: this.source,
      host: this.smtp.host,
      port: this.smtp.port,
      secure: this.smtp.secure,
      user: this.smtp.user || '',
      from: this.from(),
      replyTo: this.smtp.replyTo || '',
      hasPassword: Boolean(this.smtp.pass),
      stored: fs.existsSync(this.smtpPath),
    };
  }

  /**
   * Enregistre les réglages et les applique aussitôt.
   *
   * Un mot de passe absent ou vide conserve celui déjà enregistré : corriger un
   * port ne demande pas de retaper le secret.
   */
  saveSmtp(dto: SaveSmtpDto): SmtpStatus {
    const host = String(dto.host || '').trim();
    if (!host) throw new BadRequestException('L’hôte SMTP est obligatoire.');

    const stored = this.readStored();
    const next: SmtpConfig = {
      host,
      port: Number(dto.port) > 0 ? Number(dto.port) : 587,
      secure: Boolean(dto.secure),
      user: dto.user ? String(dto.user).trim() : undefined,
      // Vide = on garde l'ancien. C'est le seul moyen de ne jamais renvoyer le
      // secret à l'écran tout en permettant une modification partielle.
      pass: dto.pass ? String(dto.pass) : stored?.pass,
      from: dto.from ? String(dto.from).trim() : undefined,
      replyTo: dto.replyTo ? String(dto.replyTo).trim() : undefined,
    };

    this.writeJsonAtomic(this.smtpPath, next);
    this.applyConfig();
    this.logger.log(`Réglages SMTP enregistrés (${next.host}:${next.port})`);
    return this.smtpStatus();
  }

  /** Supprime le fichier enregistré : les variables d'environnement reprennent la main. */
  clearSmtp(): SmtpStatus {
    try {
      fs.rmSync(this.smtpPath, { force: true });
    } catch (err) {
      this.logger.warn(`smtp.json non supprimé : ${(err as Error).message}`);
    }
    this.applyConfig();
    return this.smtpStatus();
  }

  /**
   * Ouvre une session SMTP et s'authentifie, sans rien envoyer.
   *
   * `transporter.verify()` fait exactement cela : c'est la vérification qui ne
   * dérange aucun destinataire, et elle distingue une mauvaise adresse d'un mot
   * de passe refusé.
   */
  async verifySmtp(): Promise<SmtpTestResult> {
    const started = Date.now();
    const base = {
      stage: 'connect' as const,
      host: this.smtp.host,
      port: this.smtp.port,
    };
    if (!this.transporter) {
      return {
        ...base,
        ok: false,
        tookMs: 0,
        message:
          'Aucun hôte SMTP n’est enregistré. Renseignez l’hôte et le port, enregistrez, puis relancez le test.',
      };
    }

    try {
      await this.transporter.verify();
      return {
        ...base,
        ok: true,
        tookMs: Date.now() - started,
        message: `Connexion établie avec ${this.smtp.host}:${this.smtp.port}${
          this.smtp.user ? `, authentifié en « ${this.smtp.user} »` : ', sans authentification'
        }.`,
      };
    } catch (err) {
      const e = err as Error & { code?: string };
      return {
        ...base,
        ok: false,
        tookMs: Date.now() - started,
        code: e.code,
        message: describeSmtpError(e),
      };
    }
  }

  /** Envoie un vrai message de test : seule preuve que la boîte le reçoit. */
  async testSend(to: string): Promise<SmtpTestResult> {
    const connection = await this.verifySmtp();
    if (!connection.ok) return connection;

    const started = Date.now();
    const base = {
      stage: 'send' as const,
      host: this.smtp.host,
      port: this.smtp.port,
    };
    try {
      const info = await this.transporter!.sendMail({
        from: this.from(),
        to,
        replyTo: this.smtp.replyTo || undefined,
        subject: 'Test SMTP — SARI Système',
        html:
          '<p>Bonjour,</p>'
          + `<p>Ce message confirme que l’envoi fonctionne via <strong>${this.smtp.host}:${this.smtp.port}</strong>.</p>`
          + `<p>Expéditeur : <strong>${this.from()}</strong></p>`
          + '<p>Si vous lisez ceci dans votre boîte de réception, la messagerie est opérationnelle.</p>',
        text: `Test SMTP réussi via ${this.smtp.host}:${this.smtp.port}.`,
      });
      return {
        ...base,
        ok: true,
        tookMs: Date.now() - started,
        messageId: info.messageId,
        message: `Message remis à ${to}. Pensez à vérifier le dossier indésirables s’il n’arrive pas.`,
      };
    } catch (err) {
      const e = err as Error & { code?: string };
      return {
        ...base,
        ok: false,
        tookMs: Date.now() - started,
        code: e.code,
        message: describeSmtpError(e),
      };
    }
  }

  private from(): string {
    return this.smtp.from || DEFAULT_FROM;
  }

  private readOutbox(): OutboxEntry[] {
    try {
      if (!fs.existsSync(this.outboxPath)) return [];
      const raw = fs.readFileSync(this.outboxPath, 'utf8');
      return JSON.parse(raw) as OutboxEntry[];
    } catch {
      return [];
    }
  }

  private appendOutbox(entry: OutboxEntry) {
    const rows = this.readOutbox();
    rows.unshift(entry);
    this.writeJsonAtomic(this.outboxPath, rows.slice(0, 200));
  }

  /** Envoie un email (SMTP) ou le journalise (mode fichier en dev / sans SMTP). */
  async send(payload: MailPayload): Promise<OutboxEntry> {
    const base: OutboxEntry = {
      ...payload,
      id: `mail-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sentAt: new Date().toISOString(),
      provider: this.transporter ? 'smtp' : 'file',
    };

    if (!this.transporter) {
      this.appendOutbox(base);
      this.logger.log(`[outbox] ${payload.to} — « ${payload.subject} »`);
      return base;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.from(),
        to: payload.toName ? { name: payload.toName, address: payload.to } : payload.to,
        replyTo: this.smtp.replyTo || undefined,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });
      base.messageId = info.messageId;
      this.appendOutbox(base);
      return base;
    } catch (err) {
      base.error = err instanceof Error ? err.message : String(err);
      base.provider = 'file';
      this.appendOutbox(base);
      this.logger.error(`Échec envoi SMTP vers ${payload.to}: ${base.error}`);
      throw err;
    }
  }

  /** Liste des emails envoyés / journalisés (pour l'historique admin). */
  outbox(): OutboxEntry[] {
    return this.readOutbox();
  }

  isSmtpConfigured(): boolean {
    return !!this.transporter;
  }
}

/**
 * Traduit les codes nodemailer en phrases utiles.
 *
 * Un administrateur qui voit `EAUTH` ne sait pas quoi en faire ; « identifiants
 * refusés » lui dit quoi corriger. Les codes non reconnus passent tels quels.
 */
function describeSmtpError(err: Error & { code?: string }): string {
  const raw = err.message || String(err);
  switch (err.code) {
    case 'EAUTH':
      return `Identifiants refusés par le serveur (${raw}). Vérifiez l’utilisateur et le mot de passe — chez la plupart des hébergeurs, il s’agit d’un mot de passe d’application et non du mot de passe de la boîte.`;
    case 'ECONNECTION':
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return `Serveur injoignable (${raw}). Vérifiez l’hôte, le port, et que le serveur autorise les connexions depuis cette machine.`;
    case 'ETIMEDOUT':
      return `Délai dépassé (${raw}). Le port est probablement filtré : 587 (STARTTLS, « TLS/SSL désactivé ») ou 465 (SSL, « TLS/SSL activé ») selon l’hébergeur.`;
    case 'ESOCKET':
      // nodemailer range sous ESOCKET aussi bien une connexion refusée qu'une
      // coupure en cours de session : annoncer « délai dépassé » dans les deux
      // cas enverrait l'administrateur chercher un pare-feu qui n'est pas en
      // cause. On regarde donc le détail.
      if (/ECONNREFUSED/i.test(raw)) {
        return `Connexion refusée (${raw}). Aucun service n’écoute sur cet hôte et ce port : vérifiez-les, ou activez l’accès SMTP sortant chez l’hébergeur.`;
      }
      return `Session interrompue (${raw}). Le serveur a coupé la connexion — port ou mode de chiffrement inadapté : essayez l’autre position de « TLS/SSL ».`;
    case 'ESOCKETTLS':
    case 'ERR_TLS_CERT_ALTNAME_INVALID':
    case 'CERT_HAS_EXPIRED':
      return `Échec du chiffrement TLS (${raw}). Essayez de basculer « TLS/SSL » dans l’autre position, ou vérifiez le certificat du serveur.`;
    case 'EMESSAGE':
    case 'EENVELOPE':
      return `Message refusé par le serveur (${raw}). L’expéditeur n’est peut-être pas autorisé pour ce compte.`;
    default:
      return raw;
  }
}
