import { PublicPaymentMethodsController } from './public-payment-methods.controller';
import { SettingsDocsService } from './settings-docs.service';

function controller(document: Record<string, unknown> | null) {
  const docs = new SettingsDocsService(jest.fn());
  jest.spyOn(docs, 'read').mockResolvedValue(document);
  return new PublicPaymentMethodsController(docs);
}
describe('Modes proposés au visiteur', () => {
  it('ne publie aucun exemple si l’opérateur n’a rien enregistré', async () => {
    await expect(controller(null).list()).resolves.toEqual([]);
  });
  it('ne publie que les champs utiles des modes manuels actifs', async () => {
    const mode = { id: 'p1', type: 'cod', name: 'Livraison', active: true, apiKey: 'private', account: 'unused' };
    const items = [mode, null, { ...mode, active: false }, ...['card-intl', 'cib', 'paypal'].map(type => ({ ...mode, type }))];
    await expect(controller({ items }).list()).resolves.toEqual([{ id: 'p1', type: 'cod', name: 'Livraison', active: true, fees: 0, instructions: '' }]);
  });
});
