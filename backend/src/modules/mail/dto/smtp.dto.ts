import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Réglages SMTP tels que l'écran Paramètres les envoie.
 *
 * Le serveur d'API les range dans `storage/mail/smtp.json` et reconstruit son
 * transport aussitôt : plus besoin de poser des variables d'environnement ni de
 * redémarrer pour qu'un envoi parte. Les variables restent lues en secours quand
 * aucun fichier n'a été enregistré (hébergement cPanel, conteneur…).
 *
 * `pass` absent ou vide = **on garde le mot de passe déjà enregistré**. C'est ce
 * qui permet de corriger un port sans retaper le secret ; l'écran ne reçoit
 * jamais le mot de passe en retour, seulement `hasPassword`.
 */
export class SaveSmtpDto {
  @IsString()
  @MaxLength(255)
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  user?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  pass?: string;

  /** Expéditeur affiché, ex. `SARI Système <noreply@exemple.dz>`. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  from?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  replyTo?: string;

  /** `true` = connexion chiffrée d'emblée (port 465). `false` = STARTTLS (587). */
  @IsOptional()
  @IsBoolean()
  secure?: boolean;
}

/**
 * Demande de test.
 *
 * Sans `to`, le serveur se contente d'ouvrir la session et de s'authentifier —
 * c'est la vérification qui ne dérange personne. Avec `to`, il envoie en plus un
 * vrai message : seule façon de confirmer que la boîte de réception le reçoit.
 */
export class TestSmtpDto {
  @IsOptional()
  @IsEmail()
  to?: string;
}
