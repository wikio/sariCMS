/**
 * Règle de validation des slugs multilingues.
 *
 * L'ancienne expression `^[a-z0-9]+(?:-[a-z0-9]+)*$` n'acceptait que l'ASCII :
 * tout slug arabe (`التشخيص-والتصوير`) ou accentué était rejeté par l'API, ce
 * qui rendait impossible la création d'une fiche traduite depuis l'admin.
 *
 * On accepte désormais toute lettre ou chiffre Unicode, séparés par des tirets,
 * en continuant d'interdire les espaces, la ponctuation et les tirets en
 * doublon / en bordure.
 */
export const SLUG_REGEX = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export const SLUG_MESSAGE =
  'Le slug ne doit contenir que des lettres, des chiffres et des tirets simples (ex. « diagnostic-imagerie » ou « التشخيص-والتصوير »).';
