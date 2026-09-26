import { PRISMA_MODEL_FIELDS } from './model-fields';
import { stalePrismaModels } from './prisma.service';

/**
 * Le contrôle qui aurait évité le 500 de « Journal des paiements ».
 *
 * Un `prisma generate` raté en postinstall (`|| true` l'avale) laisse l'API
 * démarrer et n'importe quel écran neuf répond 500 : la liste des modèles connus
 * dans le message d'erreur est la seule piste, et elle ne tombe pas sous les yeux
 * de celui qui déploie.
 */
describe('stalePrismaModels', () => {
  it('ignore les membres techniques du client', () => {
    const client = { $connect: () => undefined, _internal: {}, user: {}, order: {} };
    expect(stalePrismaModels(client, ['user', 'order'])).toEqual([]);
  });

  it('compare sans tenir compte de la casse des noms générés', () => {
    // Le map généré écrit `paymentrecord`, la délégation Prisma s'appelle
    // `paymentRecord` : une comparaison brute signalerait un modèle périmé pour
    // chaque ligne du schéma, ce qui rendrait l'alerte inutilisable.
    const client = { paymentRecord: {}, contactInfo: {} };
    expect(stalePrismaModels(client, ['paymentrecord', 'contactinfo'])).toEqual([]);
  });

  it('nomme le modèle absent, et rien d’autre', () => {
    const client = { user: {}, order: {} };
    expect(stalePrismaModels(client, ['user', 'order', 'paymentRecord'])).toEqual(['paymentRecord']);
  });

  it('ne dit rien sans client (pilote JSON, ou connexion échouée avant)', () => {
    expect(stalePrismaModels(undefined, Object.keys(PRISMA_MODEL_FIELDS))).toEqual([]);
  });

  it('traite chaque modèle connu du schéma comme une délégation attendue', () => {
    // Garde-fou de l'hypothèse du service : si un `@@ignore` entre au schéma, la
    // comparaison devra l'exclure — sinon l'alerte mentira à chaque démarrage.
    const schema = require('fs')
      .readFileSync(require('path').join(__dirname, '../../../../prisma/schema.prisma'), 'utf8');
    expect(schema).not.toMatch(/@@ignore/);
    expect(Object.keys(PRISMA_MODEL_FIELDS).length).toBeGreaterThan(20);
  });
});
