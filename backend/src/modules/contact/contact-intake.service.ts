import { Injectable } from '@nestjs/common';
import { isEmail } from 'class-validator';
import { ContactInfoService } from './contact-info.service';
import { ActorContext } from '../../common/crud/base-crud.service';
import { ContactAiService } from './contact-ai.service';
import { ContactMeta, ContactPolicy, IntakeResult, isSingleMailbox, RoutingPlan } from './contact-contract';
import { ContactDossierService } from './contact-dossier.service';
import { ContactMessagesService } from './contact-messages.service';
import { ContactPolicyService, decide, Decision } from './contact-policy.service';
import { CreateContactMessageDto } from './dto/contact.dto';

@Injectable()
export class ContactIntakeService {
  constructor(
    private readonly policies: ContactPolicyService,
    private readonly ai: ContactAiService,
    private readonly messages: ContactMessagesService,
    private readonly dossier: ContactDossierService,
    private readonly info: ContactInfoService,
  ) {}

  async submit(dto: CreateContactMessageDto, actor: ActorContext): Promise<IntakeResult> {
    const { name, email, phone, subject, message } = dto;
    const locale = dto.locale || 'fr';
    const meta: ContactMeta = { selectedSubject: subject, locale, ...(dto.company && { company: dto.company }) };
    let decision: Decision = { action: 'review', reason: 'policy_unavailable' };
    let policy: ContactPolicy | null = null;
    try {
      policy = await this.policies.read();
    } catch {
      /* Pas de destinataire de secours improvisé. */
    }
    if (policy) {
      const verdict = await this.ai.classify(subject, message, locale);
      decision = decide(policy, subject, verdict);
      if (verdict?.suggestedSubject) meta.suggestedSubject = verdict.suggestedSubject;
    }
    if (decision.action === 'discard') {
      if (actor.id != null && policy && policy.penaltyPoints > 0) {
        await this.dossier.deduct(actor.id, policy.penaltyPoints, decision.reason);
      }
      return { decision: 'discard' }; // ni message, ni corbeille, ni audit du texte
    }
    meta.reason = decision.reason;
    if (decision.action === 'accept' && policy) {
      const rule = policy.routes[decision.subject];
      let route: RoutingPlan;
      if (rule.mode === 'company') {
        // Les adresses de démonstration/repli visuel de getConfig() ne sont pas des autorisations d'envoi.
        const email = (await this.info.findByLocale(locale).catch(() => null))?.email?.trim();
        route = { mode: 'company', email: isSingleMailbox(email) && isEmail(email) ? email : null };
      } else route = rule;
      const row = (await this.messages.create(
        { name, email, phone, subject: decision.subject, message, status: 'new', meta: { ...meta, route } },
        actor,
      )) as { id: number };
      return { decision: 'accept', id: row.id, subject: decision.subject, route };
    }
    await this.messages.create({ name, email, phone, subject, message, status: 'review', meta }, actor);
    return { decision: 'review' };
  }
}
