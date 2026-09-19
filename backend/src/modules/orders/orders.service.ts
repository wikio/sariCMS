import { Inject, Injectable } from '@nestjs/common';
import { AppCacheService } from '../../common/cache/cache.service';
import { AuditService } from '../../common/audit/audit.service';
import { ORDER_REPOSITORY } from '../../common/constants/tokens';
import { BaseCrudService, CrudServiceOptions } from '../../common/crud/base-crud.service';
import { ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { OrderEntity } from './entities/order.entity';

@Injectable()
export class OrdersService extends BaseCrudService<OrderEntity> {
  protected readonly repository: ICrudRepository<OrderEntity>;
  protected readonly options: CrudServiceOptions = {
    resource: 'orders',
    // Table sans colonne `legacyId` (contenu non traduit par fiches sœurs) :
    // l'injecter faisait échouer la création sous MySQL.
    hasLegacyId: false,
    searchFields: ['code', 'client', 'email', 'company', 'phone'],
    sortableFields: ['createdAt', 'updatedAt', 'date', 'total', 'status'],
    listFields: ['id', 'code', 'client', 'email', 'company', 'date', 'status', 'total', 'currency', 'paid', 'userId'],
    cardFields: ['id', 'code', 'client', 'email', 'date', 'status', 'total', 'currency', 'paid'],
  };

  constructor(
    @Inject(ORDER_REPOSITORY) repository: ICrudRepository<OrderEntity>,
    cache: AppCacheService,
    audit: AuditService,
  ) {
    super(cache, audit);
    this.repository = repository;
  }

  private formatOrderCode(id: number, year?: number): string {
    const y = year ?? new Date().getFullYear();
    const yy = String(y % 100).padStart(2, '0');
    return `SARI-WCMD${yy}-${String(id).padStart(5, '0')}`;
  }

  override async create(dto: Partial<OrderEntity>, actor?: import('../../common/crud/base-crud.service').ActorContext): Promise<unknown> {
    // Si un code est fourni mais déjà pris, on le neutralise pour générer un code unique basé sur l'auto-incrément
    if (dto.code) {
      const dup = await this.repository.findOne({ code: dto.code }, true).catch(() => null);
      if (dup) delete (dto as Record<string, unknown>).code;
    }
    const created = (await super.create(dto, actor)) as OrderEntity & { code?: string; id: number; date?: unknown };
    // Génère le code formaté SARI-WCMD{YY}-{ID} si aucun code n'a été fourni (ou doublon neutralisé) — boucle anti-collision
    if (!created.code) {
      const baseYear = created.date ? new Date(String(created.date)).getFullYear() : undefined;
      let suffix = created.id;
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const code = this.formatOrderCode(suffix, baseYear);
        const exists = await this.repository.findOne({ code }, true).catch(() => null);
        if (!exists) {
          try {
            const updated = await this.repository.update(created.id, { code } as Partial<OrderEntity>);
            return this.toView(updated as OrderEntity, 'block');
          } catch {
            suffix += 1;
            continue;
          }
        }
        suffix += 1;
      }
    }
    return created;
  }

  protected override beforeSave(
    dto: Partial<OrderEntity>,
    op: 'create' | 'update',
    existing?: OrderEntity,
  ): Partial<OrderEntity> {
    const out: Record<string, unknown> & Partial<OrderEntity> = { ...dto } as Record<string, unknown> & Partial<OrderEntity>;
    // --- Compat vitrine legacy : mappe les anciens noms vers les colonnes canoniques ---
    const compat = out as Record<string, unknown>;
    if (compat.customerName && !compat.client) compat.client = compat.customerName;
    if (compat.customerEmail && !compat.email) compat.email = compat.customerEmail;
    if (compat.customerPhone && !compat.phone) compat.phone = compat.customerPhone;
    if (compat.customerCompany && !compat.company) compat.company = compat.customerCompany;
    if ((compat.grandTotal !== undefined || compat.totalAmount !== undefined) && (compat.total === undefined || Number(compat.total) === 0)) {
      const gt = compat.grandTotal !== undefined ? Number(compat.grandTotal) : Number(compat.totalAmount);
      if (Number.isFinite(gt)) compat.total = gt;
    }
    if (compat.taxAmount !== undefined && compat.taxTotal === undefined) compat.taxTotal = compat.taxAmount;
    if (typeof compat.userId === 'string') {
      const n = Number(String(compat.userId).trim());
      if (Number.isFinite(n) && n > 0) (compat as Record<string, unknown>).userId = n;
      else delete (compat as Record<string, unknown>).userId;
    }
    // Supprime les champs legacy qui n'ont pas de colonne (évite le warn + garde le payload propre)
    // NB: les champs breakdown (subtotal, shippingFee, etc.) et zones sont désormais persistés (schema 2026-09)
    delete compat.customerName; delete compat.customerEmail; delete compat.customerPhone; delete compat.customerCompany;
    delete compat.customerType; delete compat.isGuest; delete compat.isQuote;
    delete compat.totalAmount; delete compat.taxAmount; delete compat.grandTotal;
    // Normalise les montants breakdown (2 décimales) — garde les valeurs admin si fournies
    const round2 = (n: number) => Math.round(Number(n) * 100) / 100;
    for (const k of ['subtotal','discountTotal','productDiscount','globalDiscount','couponDiscount','shippingFee','productShipping','globalShipping','taxTotal']) {
      if (compat[k] !== undefined && compat[k] !== null && compat[k] !== '') {
        const v = Number(compat[k]);
        if (Number.isFinite(v)) (compat as Record<string, unknown>)[k] = round2(v);
        else delete (compat as Record<string, unknown>)[k];
      }
    }
    if (compat.deliveryZone !== undefined && typeof compat.deliveryZone === 'string') compat.deliveryZone = String(compat.deliveryZone).slice(0,80);
    if (compat.saleZone !== undefined && typeof compat.saleZone === 'string') compat.saleZone = String(compat.saleZone).slice(0,80);
    if (compat.deliveryAddress !== undefined && typeof compat.deliveryAddress === 'string') compat.deliveryAddress = String(compat.deliveryAddress).slice(0,500);
    if (compat.country !== undefined && typeof compat.country === 'string') compat.country = String(compat.country).slice(0,80);
    if (compat.notes !== undefined && typeof compat.notes === 'string') compat.notes = String(compat.notes).slice(0,2000);
    if (compat.adminNotes !== undefined && typeof compat.adminNotes === 'string') compat.adminNotes = String(compat.adminNotes).slice(0,2000);
    // Suivi & transporteur : bornés comme en base (VARCHAR(80)).
    for (const k of ['trackingNumber', 'carrier'] as const) {
      if (compat[k] !== undefined && typeof compat[k] === 'string') {
        (compat as Record<string, unknown>)[k] = String(compat[k]).slice(0, 80);
      }
    }
    // Dates métier : une valeur vide ou illisible doit disparaître du payload.
    // Sinon Prisma refuse l'écriture entière au lieu d'ignorer le champ.
    for (const k of ['shippedAt', 'deliveredAt', 'paidAt'] as const) {
      const v = (compat as Record<string, unknown>)[k];
      if (v === undefined) continue;
      if (v === null || v === '') { delete (compat as Record<string, unknown>)[k]; continue; }
      const parsed = new Date(String(v));
      if (Number.isNaN(parsed.getTime())) delete (compat as Record<string, unknown>)[k];
      else (compat as Record<string, unknown>)[k] = parsed.toISOString();
    }
    // taxLines : garde Json tel quel si array, nettoie les entrées vides type [[]] ou {name:undefined}
    if (compat.taxLines !== undefined) {
      if (!Array.isArray(compat.taxLines)) delete compat.taxLines;
      else {
        const cleaned = (compat.taxLines as any[]).filter((tl:any)=> tl && typeof tl==='object' && !Array.isArray(tl) && tl.name && typeof tl.amount==='number' && Number.isFinite(tl.amount) && tl.amount!==0);
        // Si après nettoyage il ne reste que des entrées invalides type [[]], on vide pour éviter "undefined 0,00 DA" en vitrine/PDF
        if (cleaned.length !== (compat.taxLines as any[]).length) {
          if (cleaned.length) (compat as Record<string, unknown>).taxLines = cleaned;
          else delete (compat as Record<string, unknown>).taxLines;
        }
      }
    }

    // Sur update, ne jamais écraser le code avec un doublon (cause 500 Unique constraint)
    if (op === 'update' && compat.code && existing) {
      if (String(compat.code) === String((existing as unknown as Record<string, unknown>).code)) {
        // même code -> inutile de le renvoyer
        delete compat.code;
      }
      // si code différent, on le laisse mais create() gère déjà le doublon; update laissera 500 si collision
      // on préfère supprimer pour éviter 500 sur les vieux localStorage qui rejouent d'anciens codes
      else {
        delete compat.code;
      }
    }
    if (op === 'create') {
      out.status = out.status || 'pending';
      out.currency = out.currency || 'DZD';
      out.paid = out.paid ?? false;
      if (!out.date) out.date = new Date().toISOString();
      const rawClient = String((out as Record<string, unknown>).client || '').trim();
      if (!rawClient || rawClient.length < 2) (out as Record<string, unknown>).client = 'Client';
      const rawEmail = String((out as Record<string, unknown>).email || '').trim().toLowerCase();
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail);
      if (!emailOk) (out as Record<string, unknown>).email = 'no-reply@sari.dz';
      else (out as Record<string, unknown>).email = rawEmail;
      const t = Number((out as Record<string, unknown>).total);
      (out as Record<string, unknown>).total = Number.isFinite(t) && t >= 0 ? Math.round(t * 100) / 100 : 0;
      if (!Array.isArray((out as Record<string, unknown>).items)) (out as Record<string, unknown>).items = [];
      (out as Record<string, unknown>).items = ((out as Record<string, unknown>).items as unknown[]).map((it: unknown) => {
        const r = (it || {}) as Record<string, unknown>;
        const name = String(r.name || 'Article').slice(0, 300) || 'Article';
        const qty = Math.max(1, Math.min(9999, Math.floor(Number(r.quantity) || 1)));
        const priceRaw = r.price;
        const priceNum = typeof priceRaw === 'string' ? Number(String(priceRaw).replace(/[^0-9.]/g, '')) : Number(priceRaw);
        const price = Math.max(0, Math.min(10000000, Math.round((Number.isFinite(priceNum) ? priceNum : 0) * 100) / 100));
        // garde image si présent, mais sanitise ; conserve les champs enrichis (discount, vat, livraison, zones)
        const clean: Record<string, unknown> = { ...r, name, quantity: qty, price };
        if (clean.image && typeof clean.image === 'string' && String(clean.image).length > 800) clean.image = String(clean.image).slice(0, 800);
        if (clean.discountValue !== undefined) { const v=Number(clean.discountValue); clean.discountValue = Number.isFinite(v) ? Math.round(Math.max(0,v)*100)/100 : 0; }
        if (clean.discount !== undefined) { const v=Number(clean.discount); clean.discount = Number.isFinite(v) ? Math.round(Math.max(0,v)*100)/100 : 0; }
        if (clean.vatRate !== undefined) { const v=Number(clean.vatRate); if (Number.isFinite(v)) clean.vatRate = Math.max(0, Math.min(100, Math.round(v*100)/100)); else delete clean.vatRate; }
        if (clean.taxRate !== undefined) { const v=Number(clean.taxRate); if (Number.isFinite(v)) clean.taxRate = Math.max(0, Math.min(100, Math.round(v*100)/100)); else delete clean.taxRate; }
        if (clean.shippingFee !== undefined) { const v=Number(clean.shippingFee); if (Number.isFinite(v)) clean.shippingFee = Math.max(0, Math.min(100000, Math.round(v*100)/100)); else delete clean.shippingFee; }
        if (clean.zones !== undefined && !Array.isArray(clean.zones)) delete clean.zones;
        return clean;
      });
    }
    if (typeof (out as Record<string, unknown>).email === 'string') (out as Record<string, unknown>).email = String((out as Record<string, unknown>).email).toLowerCase().trim();
    if (op === 'update' && (out as Record<string, unknown>).status && existing && (out as Record<string, unknown>).status !== (existing as unknown as Record<string, unknown>).status) {
      const history = Array.isArray((existing as unknown as Record<string, unknown>).history) ? [...((existing as unknown as Record<string, unknown>).history as unknown[])] : [];
      history.push({ status: (out as Record<string, unknown>).status as string, at: new Date().toISOString() });
      (out as Record<string, unknown>).history = history;
    }
    // sanitize items même en update (garde les champs enrichis, tronque image)
    if (op === 'update' && Array.isArray((out as Record<string, unknown>).items)) {
      (out as Record<string, unknown>).items = ((out as Record<string, unknown>).items as unknown[]).map((it: unknown) => {
        const r = (it || {}) as Record<string, unknown>;
        if (typeof r.image === 'string' && r.image.length > 800) r.image = r.image.slice(0, 800);
        if (r.discountValue !== undefined) { const v=Number(r.discountValue); r.discountValue = Number.isFinite(v) ? Math.round(Math.max(0,v)*100)/100 : 0; }
        if (r.vatRate !== undefined) { const v=Number(r.vatRate); if (Number.isFinite(v)) r.vatRate = Math.max(0, Math.min(100, Math.round(v*100)/100)); else delete r.vatRate; }
        if (r.shippingFee !== undefined) { const v=Number(r.shippingFee); if (Number.isFinite(v)) r.shippingFee = Math.max(0, Math.min(100000, Math.round(v*100)/100)); else delete r.shippingFee; }
        return r;
      });
    }
    return out as Partial<OrderEntity>;
  }
}
