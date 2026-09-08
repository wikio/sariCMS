import { registerDecorator, ValidationOptions } from 'class-validator';

/**
 * Identifiant d'entité, indépendant du driver.
 *
 * Les ids sont des entiers auto-incrémentés avec MySQL/Postgres (Prisma) et
 * des UUID avec le driver JSON. Un `@IsUUID()` en dur rendait donc certaines
 * routes inutilisables en base SQL — c'est ce qui empêchait d'affecter un
 * rôle à un utilisateur et de cocher une permission.
 */
export function IsEntityId(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isEntityId',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (typeof value === 'number') return Number.isInteger(value) && value > 0;
          if (typeof value !== 'string') return false;
          const s = value.trim();
          if (!s) return false;
          // entier positif ("12") ou UUID
          return /^\d+$/.test(s) ||
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
        },
        defaultMessage() {
          return `${propertyName} must be a positive integer id or a UUID`;
        },
      },
    });
  };
}
