/**
 * lib/upload-validation.ts — Validation sécurisée des uploads de fichiers.
 *
 * Protections :
 * - Vérification des magic bytes (signature de fichier) vs extension déclarée
 * - Liste blanche des types MIME autorisés
 * - Limite de taille configurable
 * - Sanitisation des noms de fichiers
 * - Protection contre la traversée de répertoire (path traversal)
 * - Détection basique de polyglots (fichiers valides dans plusieurs formats)
 */
import { createHash } from 'crypto';
import path from 'path';

// Types MIME autorisés avec leurs magic bytes correspondants
export const ALLOWED_MIME_TYPES: Record<string, { extensions: string[]; magicBytes: number[][] }> = {
  'image/jpeg': {
    extensions: ['.jpg', '.jpeg', '.jpe'],
    magicBytes: [[0xFF, 0xD8, 0xFF]], // JPEG SOI marker
  },
  'image/png': {
    extensions: ['.png'],
    magicBytes: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]], // PNG signature
  },
  'image/gif': {
    extensions: ['.gif'],
    magicBytes: [
      [0x47, 0x49, 0x46, 0x38, 0x37, 0x61], // GIF87a
      [0x47, 0x49, 0x46, 0x38, 0x39, 0x61], // GIF89a
    ],
  },
  'image/webp': {
    extensions: ['.webp'],
    magicBytes: [[0x52, 0x49, 0x46, 0x46]], // RIFF (vérification WEBP supplémentaire nécessaire)
  },
  'image/svg+xml': {
    extensions: ['.svg'],
    magicBytes: [[0x3C, 0x3F, 0x78, 0x6D, 0x6C], [0x3C, 0x73, 0x76, 0x67]], // <?xml ou <svg
  },
  'application/pdf': {
    extensions: ['.pdf'],
    magicBytes: [[0x25, 0x50, 0x44, 0x46, 0x2D]], // %PDF-
  },
};

export interface UploadValidationOptions {
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
  allowedExtensions?: string[];
  scanForPolyglots?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  mimeType?: string;
  extension?: string;
  error?: string;
  warnings?: string[];
}

/**
 * Vérifie les magic bytes d'un buffer pour confirmer le type MIME réel
 */
export function validateMagicBytes(buffer: Buffer, declaredMimeType: string): ValidationResult {
  const allowed = ALLOWED_MIME_TYPES[declaredMimeType];
  if (!allowed) {
    return { valid: false, error: `Type MIME non autorisé : ${declaredMimeType}` };
  }

  // Vérifier si les magic bytes correspondent
  const matches = allowed.magicBytes.some(pattern => {
    if (buffer.length < pattern.length) return false;
    return pattern.every((byte, i) => buffer[i] === byte);
  });

  if (!matches) {
    // Vérification spéciale pour WebP (RIFF + "WEBP" à l'offset 8)
    if (declaredMimeType === 'image/webp' && buffer.length >= 12) {
      const riff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
      const webp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
      if (riff && webp) return { valid: true, mimeType: declaredMimeType, extension: '.webp' };
    }
    return { valid: false, error: `Signature de fichier invalide pour ${declaredMimeType}` };
  }

  return { valid: true, mimeType: declaredMimeType, extension: allowed.extensions[0] };
}

/**
 * Détecte le type MIME réel depuis les magic bytes (sans type déclaré)
 */
export function detectMimeType(buffer: Buffer): { mimeType: string; extension: string } | null {
  for (const [mimeType, config] of Object.entries(ALLOWED_MIME_TYPES)) {
    const matches = config.magicBytes.some(pattern => {
      if (buffer.length < pattern.length) return false;
      return pattern.every((byte, i) => buffer[i] === byte);
    });
    if (matches) {
      // Cas spécial WebP
      if (mimeType === 'image/webp' && buffer.length >= 12) {
        const riff = buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46;
        const webp = buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
        if (!(riff && webp)) continue;
      }
      return { mimeType, extension: config.extensions[0] };
    }
  }
  return null;
}

/**
 * Vérifie la taille du fichier
 */
export function validateFileSize(size: number, maxSize: number = 50 * 1024 * 1024): ValidationResult {
  if (size > maxSize) {
    return { valid: false, error: `Fichier trop volumineux : ${size} octets (max ${maxSize})` };
  }
  return { valid: true };
}

/**
 * Sanitise un nom de fichier pour éviter path traversal et caractères dangereux
 */
export function sanitizeFileName(fileName: string): string {
  // Supprimer les séquences de traversée de répertoire
  let sanitized = fileName
    .replace(/\.\./g, '')           // Supprimer ..
    .replace(/[\/\\]/g, '_')        // Remplacer / et \ par _
    .replace(/[<>:"|?*\x00-\x1f]/g, '') // Supprimer caractères de contrôle et spéciaux Windows
    .replace(/\s+/g, '_')           // Espaces -> underscores
    .substring(0, 255);             // Limiter la longueur

  // S'assurer qu'il reste une extension valide
  const lastDot = sanitized.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === sanitized.length - 1) {
    sanitized += '.bin'; // Extension par défaut si invalide
  }

  return sanitized;
}

/**
 * Vérifie si le chemin est sûr (pas de path traversal)
 */
export function isSafePath(basePath: string, requestedPath: string): boolean {
  const resolvedBase = path.resolve(basePath);
  const resolvedRequested = path.resolve(requestedPath);
  return resolvedRequested.startsWith(resolvedBase + path.sep) || resolvedRequested === resolvedBase;
}

/**
 * Détection basique de polyglots (fichiers valides dans plusieurs formats)
 * Attention : détection heuristique, pas exhaustive
 */
export function scanForPolyglots(buffer: Buffer, mimeType: string): string[] {
  const warnings: string[] = [];

  // JPEG + ZIP (polyglot classique)
  if (mimeType === 'image/jpeg' && buffer.includes(Buffer.from([0x50, 0x4B, 0x05, 0x06]))) {
    warnings.push('Possible polyglot JPEG/ZIP détecté (signature ZIP en fin de fichier)');
  }
  if (mimeType === 'image/jpeg' && buffer.includes(Buffer.from([0x50, 0x4B, 0x03, 0x04]))) {
    warnings.push('Possible polyglot JPEG/ZIP détecté (signature ZIP locale)');
  }

  // PNG + données cachées après IEND
  if (mimeType === 'image/png') {
    const iendIndex = buffer.indexOf(Buffer.from([0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]));
    if (iendIndex !== -1 && iendIndex + 8 < buffer.length) {
      const remaining = buffer.length - (iendIndex + 8);
      if (remaining > 100) {
        warnings.push(`Données suspectes après chunk IEND PNG (${remaining} octets)`);
      }
    }
  }

  // SVG avec scripts potentiels
  if (mimeType === 'image/svg+xml') {
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
    if (/<script/i.test(content) || /on\w+\s*=/i.test(content) || /javascript:/i.test(content)) {
      warnings.push('Contenu SVG potentiellement dangereux (scripts/handlers détectés)');
    }
  }

  // PDF avec JavaScript embarqué
  if (mimeType === 'application/pdf') {
    const content = buffer.toString('latin1', 0, Math.min(buffer.length, 50000));
    if (/\/JavaScript/i.test(content) || /\/JS\s/i.test(content) || /\/Launch/i.test(content)) {
      warnings.push('PDF avec JavaScript/action potentiellement dangereuse détecté');
    }
  }

  return warnings;
}

/**
 * Génère un hash SHA-256 du fichier pour déduplication/integrity
 */
export function computeFileHash(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Validation complète d'un fichier uploadé
 */
export async function validateUpload(
  file: File | Buffer,
  options: UploadValidationOptions = {}
): Promise<ValidationResult> {
  const {
    maxSizeBytes = 50 * 1024 * 1024, // 50MB par défaut
    allowedMimeTypes = Object.keys(ALLOWED_MIME_TYPES),
    scanForPolyglots: shouldScan = true,
  } = options;

  // Convertir File en Buffer si nécessaire
  let buffer: Buffer;
  let originalName = 'unknown';
  let declaredMimeType = '';

  if (file instanceof File) {
    originalName = file.name;
    declaredMimeType = file.type || '';
    const arrayBuffer = await file.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else {
    buffer = file;
  }

  const warnings: string[] = [];

  // 1. Vérifier la taille
  const sizeCheck = validateFileSize(buffer.length, maxSizeBytes);
  if (!sizeCheck.valid) return { valid: false, error: sizeCheck.error };

  // 2. Détecter le type MIME réel depuis les magic bytes
  const detected = detectMimeType(buffer);
  if (!detected) {
    return { valid: false, error: 'Type de fichier non reconnu ou non autorisé' };
  }

  // 3. Vérifier que le type détecté est dans la liste autorisée
  if (!allowedMimeTypes.includes(detected.mimeType)) {
    return { valid: false, error: `Type de fichier non autorisé : ${detected.mimeType}` };
  }

  // 4. Si un type MIME était déclaré, vérifier la cohérence
  if (declaredMimeType && declaredMimeType !== detected.mimeType) {
    warnings.push(`Type MIME déclaré (${declaredMimeType}) différent du type détecté (${detected.mimeType})`);
  }

  // 5. Scanner pour polyglots si demandé
  if (shouldScan) {
    const polyglotWarnings = scanForPolyglots(buffer, detected.mimeType);
    warnings.push(...polyglotWarnings);
  }

  // 6. Sanitiser le nom de fichier
  const sanitizedName = sanitizeFileName(originalName);
  if (sanitizedName !== originalName) {
    warnings.push('Nom de fichier sanitisé pour la sécurité');
  }

  return {
    valid: true,
    mimeType: detected.mimeType,
    extension: detected.extension,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}