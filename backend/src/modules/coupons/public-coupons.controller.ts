import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';
import { Public } from '../../common/decorators/public.decorator';
import { CouponsService } from './coupons.service';

export class ValidateCouponDto {
  @ApiProperty({ description: 'Code saisi par le client' })
  @IsString()
  @MaxLength(40)
  code!: string;
}

/**
 * Résolution d'un code promo depuis le panier.
 *
 * Il n'y a volontairement **pas** de `GET /public/coupons` : une liste publique
 * des coupons actifs reviendrait à publier tous les codes, utilisables par
 * n'importe qui sans les avoir reçus. Le panier pose une question fermée — « ce
 * code existe-t-il ? » — et reçoit au plus une ligne.
 *
 * Les contrôles métier (panier minimum, périmètre, épuisement) restent côté
 * panier : ils dépendent du contenu du panier, que le serveur ne connaît pas à
 * ce stade. Ce point d'entrée ne répond que de l'existence et de l'activation.
 */
@ApiTags('public')
@Public()
@Controller('public/coupons')
export class PublicCouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Post('validate')
  // Une requête de vérification ne crée rien : 200, pas le 201 par défaut de Nest.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Vérifier un code promo (404 s\'il n\'existe pas)' })
  async validate(@Body() dto: ValidateCouponDto) {
    const coupon = await this.coupons.findByCode(dto.code);
    return { coupon };
  }
}
