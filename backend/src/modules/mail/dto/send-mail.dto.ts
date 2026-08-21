import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMailDto {
  @IsEmail()
  @IsNotEmpty()
  to!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  subject!: string;

  /** Contenu HTML du message. */
  @IsString()
  @IsNotEmpty()
  html!: string;

  /** Version texte brut (optionnelle, pour les clients qui n'affichent pas le HTML). */
  @IsOptional()
  @IsString()
  text?: string;

  /** Nom lisible du destinataire (utilisé pour « À »). */
  @IsOptional()
  @IsString()
  toName?: string;
}
