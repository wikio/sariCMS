import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Statuts d'un encaissement. C'est la seule énumération fermée du magasin, et
 * volontairement : le statut pilote l'écran (un « validé » compte dans les
 * encaissements, un « en attente » non) et la déduction du total. Une valeur
 * inconnue ici ne serait pas un libellé différent, ce serait une ligne qui
 * disparaît des chiffres — donc elle est refusée.
 */
export const PAYMENT_STATUSES = ['validated', 'pending', 'rejected'] as const;

/**
 * `method`, en revanche, est accepté en texte libre (longueur bornée). Les modes
 * de paiement se créent depuis l'écran « Devises & paiements » et un mode ajouté
 * là sans retoucher le backend est un libellé de plus, pas un comportement. Le
 * refuser ici ferait échouer l'enregistrement d'un paiement **réel** pour une
 * raison de vocabulaire : le coût est asymétrique, et dans le mauvais sens.
 */
export class PaymentRecordSyncRowDto {
  @ApiPropertyOptional({ description: 'Identifiant de ligne en base, si le poste le connaît' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id?: number;

  @ApiPropertyOptional({ description: 'Identifiant du navigateur (unique en base)' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  externalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  orderId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  orderCode?: string;

  @ApiProperty({ description: 'Nom du client tel que saisi' })
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  client!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  email?: string;

  // Facultatif bien que la colonne soit NOT NULL : le service pose `transfer` par
  // défaut, et un envoi qui ne dirait pas le mode doit être enregistré en attente
  // plutôt que rejeté — le mode se corrigera, l'encaissement ne se retrouverait pas.
  @ApiPropertyOptional({ description: 'Mode de paiement (transfer, card-intl, cib, cod…)' })
  @IsOptional()
  @IsString()
  @MaxLength(24)
  method?: string;

  @ApiPropertyOptional({ description: 'Libellé affiché' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  methodName?: string;

  @ApiProperty({ description: 'Montant en devise du poste ; la colonne est un nombre' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ enum: PAYMENT_STATUSES, default: 'pending' })
  @IsOptional()
  @IsIn(PAYMENT_STATUSES)
  status?: string;

  // Le champ de l'écran demande quatre chiffres, mais un opérateur qui colle un
  // numéro entier doit être toléré ici : le service ne garde que la fin et jette
  // le reste. Exiger `^\d{4}$` à la frontière aurait un effet de bord coûteux —
  // un seul caractère de trop fait rejeter le LOT ENTIER, donc perdre les autres
  // encaissements du même poste pour une question de mise en forme.
  @ApiPropertyOptional({ description: 'Chiffres de carte ; les quatre derniers sont conservés' })
  @IsOptional()
  @IsString()
  @Matches(/^[\d ]{4,32}$/, { message: 'cardLast4 ne peut contenir que des chiffres (et des espaces)' })
  cardLast4?: string;

  @ApiPropertyOptional({ description: 'Note de validation ou motif de refus' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  note?: string;

  // Facultatif : sans date, le service horodate à l'arrivée et le signale dans
  // `repaired`. Exiger cette chaîne aurait rendu le mécanisme de repli
  // inatteignable par HTTP — et une écriture refusée pour une date absente est
  // une écriture perdue.
  @ApiPropertyOptional({ description: 'Date de la transaction (ISO ou AAAA-MM-JJ)' })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({ description: 'Date de validation manuelle' })
  @IsOptional()
  @IsString()
  validatedAt?: string;
}

/**
 * Envoi par lot depuis l'écran.
 *
 * Comme pour les coupons : les suppressions viennent de `removed`, **jamais** des
 * absences. Un poste partiellement à jour (deux onglets, un poste neuf, une ligne
 * pas encore redescendue) enverait une liste amputée et effacerait des
 * encaissements enregistrés ailleurs.
 */
export class SyncPaymentRecordsDto {
  @ApiProperty({ type: [PaymentRecordSyncRowDto], description: 'Lignes à créer ou mettre à jour' })
  @IsArray()
  @ArrayMaxSize(2000)
  // Sans `@ValidateNested`, les objets du tableau ne sont pas contrôlés : un
  // statut hors énumération passerait jusqu'au service.
  @ValidateNested({ each: true })
  @Type(() => PaymentRecordSyncRowDto)
  records!: PaymentRecordSyncRowDto[];

  @ApiPropertyOptional({
    type: [String],
    description: '`externalId` des lignes à envoyer en corbeille',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2000)
  @IsString({ each: true })
  removed?: string[];
}

export class CreatePaymentRecordDto extends PaymentRecordSyncRowDto {}

export class UpdatePaymentRecordDto extends PartialType(CreatePaymentRecordDto) {}
