import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CONTACT_PENALTY_REPOSITORY } from '../../common/constants/tokens';
import { AuditService } from '../../common/audit/audit.service';
import { BaseEntity, ICrudRepository } from '../../common/crud/interfaces/repository.interface';
import { ContactDossier, Violation } from './contact-contract';

const accountKey = (id: string | number) => (/^\d+$/.test(String(id)) ? Number(id) : id);
interface Penalty extends BaseEntity {
  userId: number | string;
  points: number;
  reason: Violation;
}

@Injectable()
export class ContactDossierService {
  constructor(
    @Inject(CONTACT_PENALTY_REPOSITORY) private readonly repo: ICrudRepository<Penalty>,
    private readonly audit: AuditService,
  ) {}

  /** Chaque remarque EST un mouvement de points : pas de solde concurrent à écraser. */
  async deduct(verifiedUserId: number, points: number, reason: Violation) {
    const now = new Date();
    await this.repo.create({
      userId: accountKey(verifiedUserId),
      points: -points,
      reason,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });
  }

  async read(account: string): Promise<ContactDossier> {
    // Les comptes historiques du magasin JSON peuvent avoir un UUID, les comptes SQL un Int.
    const userId = accountKey(account);
    const result: ContactDossier = { score: 0, total: 0, notes: [] };
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      const rows = await this.repo.findMany({
        filters: [{ field: 'userId', value: userId }],
        page,
        limit: 100,
        sortBy: 'id',
        sortOrder: 'desc',
      });
      pages = rows.meta.totalPages;
      result.total = rows.meta.total;
      for (const { id, reason, points, createdAt } of rows.data) {
        result.score += points;
        if (result.notes.length < 20)
          result.notes.push({ id, points, reason, createdAt: new Date(createdAt).toISOString() });
      }
    }
    return result;
  }
  async retract(account: string, id: number, actorId?: number) {
    const note = await this.repo.findById(id);
    if (!note || String(note.userId) !== account) throw new NotFoundException();
    await this.repo.softDelete(id);
    await this.audit.record({ actorId, action: 'retract', resource: 'contact_penalties', resourceId: id });
    return { ok: true };
  }
}
