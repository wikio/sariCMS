import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { createTransport, Transporter } from 'nodemailer';

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

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;
  private readonly outboxPath: string;
  private readonly host: string;

  constructor(private readonly config: ConfigService) {
    this.host = String(config.get('SMTP_HOST') || '').trim();
    const jsonPath = config.get<string>('JSON_STORE_PATH') || './storage/json';
    // Les emails « envoyés » hors SMTP sont journalisés dans un fichier dédié.
    this.outboxPath = path.resolve(
      path.dirname(jsonPath),
      'mail',
      'outbox.json',
    );

    if (this.host) {
      const port = Number(config.get('SMTP_PORT') || 587);
      const secure = String(config.get('SMTP_SECURE') || '').toLowerCase() === 'true';
      const user = config.get('SMTP_USER');
      const pass = config.get('SMTP_PASS');
      this.transporter = createTransport({
        host: this.host,
        port,
        secure,
        auth: user && pass ? { user: String(user), pass: String(pass) } : undefined,
      } as Parameters<typeof createTransport>[0]);
      this.logger.log(`SMTP transport prêt (${this.host}:${port})`);
    } else {
      this.logger.warn('SMTP_HOST non défini — mode « fichier » (outbox JSON), aucun email réel envoyé.');
    }
  }

  private from(): string {
    return this.config.get<string>('SMTP_FROM') || 'SARI Système <noreply@sarisysteme.com>';
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
    fs.mkdirSync(path.dirname(this.outboxPath), { recursive: true });
    fs.writeFileSync(this.outboxPath, JSON.stringify(rows.slice(0, 200), null, 2));
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
