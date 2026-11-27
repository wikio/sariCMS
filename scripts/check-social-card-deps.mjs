const requiredPackages = ['@napi-rs/canvas', 'qrcode'];
const missing = [];

for (const packageName of requiredPackages) {
  try {
    await import(packageName);
  } catch (error) {
    if (error?.code === 'ERR_MODULE_NOT_FOUND' || error?.code === 'MODULE_NOT_FOUND') {
      missing.push(packageName);
    } else {
      console.error(`Échec du chargement de ${packageName}:`, error);
      process.exitCode = 1;
      break;
    }
  }
}

if (missing.length) {
  console.error(`Dépendance(s) manquante(s) pour le rendu social : ${missing.join(', ')}.`);
  console.error('Depuis la racine du dépôt, exécutez « npm ci », puis redémarrez le serveur Next.js.');
  process.exitCode = 1;
} else if (!process.exitCode) {
  console.log('Dépendances du rendu social présentes : @napi-rs/canvas, qrcode.');
}
