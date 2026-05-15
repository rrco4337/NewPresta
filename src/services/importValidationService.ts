// ==========================================
// TYPES
// ==========================================

export interface ColumnSpec {
  canonical: string;
  aliases: string[];
  required: boolean;
}

// ==========================================
// COLUMN SPECS PAR FICHIER
// ==========================================

export const FICHIER1_COLUMN_SPECS: ColumnSpec[] = [
  { canonical: 'date_availability_produit', aliases: ['date_produit', 'date produit', 'date'], required: false },
  { canonical: 'nom',        aliases: ['name'],                           required: true },
  { canonical: 'reference',  aliases: ['référence', 'ref'],              required: true },
  { canonical: 'prix_ttc',   aliases: ['prix ttc', 'price_ttc'],         required: true },
  { canonical: 'taxe',       aliases: ['taux_tva', 'tva', 'tax'],        required: true },
  { canonical: 'categorie',  aliases: ['catégorie', 'category'],          required: true },
  { canonical: 'prix_achat', aliases: ['prix achat', 'wholesale_price'], required: true },
];

export const FICHIER2_COLUMN_SPECS: ColumnSpec[] = [
  { canonical: 'reference',      aliases: ['référence', 'ref'],                           required: true  },
  { canonical: 'specificité',    aliases: ['specificite', 'specifite'],                   required: false },
  { canonical: 'karazany',       aliases: [],                                              required: false },
  { canonical: 'stock_initial',  aliases: ['stock', 'quantite', 'qty', 'stock initial'], required: true  },
  { canonical: 'prix_vente_ttc', aliases: ['prix_ttc', 'prix vente ttc', 'prix vente'],  required: false },
];

export const FICHIER3_COLUMN_SPECS: ColumnSpec[] = [
  { canonical: 'date',    aliases: [],                                required: true  },
  { canonical: 'nom',     aliases: ['name'],                          required: true  },
  { canonical: 'email',   aliases: ['mail', 'courriel'],             required: true  },
  { canonical: 'pwd',     aliases: ['password', 'mot_de_passe'],     required: true  },
  { canonical: 'adresse', aliases: ['address', 'adresse_livraison'], required: true  },
  { canonical: 'achat',   aliases: ['commande', 'panier', 'achats'], required: true  },
  { canonical: 'etat',    aliases: ['statut', 'status', 'état'],     required: false },
];

// ==========================================
// VALIDATION DES EN-TÊTES
// ==========================================

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Vérifie que les en-têtes reçus correspondent aux colonnes attendues.
 * Détecte : colonnes inconnues (avec suggestion si faute de frappe), colonnes obligatoires manquantes.
 */
export function validateHeaders(receivedHeaders: string[], specs: ColumnSpec[]): string[] {
  const errors: string[] = [];
  const normalizedReceived = receivedHeaders.map(h => h.trim().toLowerCase());
  const allKnown = new Set(
    specs.flatMap(s => [s.canonical.toLowerCase(), ...s.aliases.map(a => a.toLowerCase())])
  );

  // Colonnes inconnues (avec détection de fautes de frappe)
  for (const h of receivedHeaders) {
    const hNorm = h.trim().toLowerCase();
    if (allKnown.has(hNorm)) continue;
    let bestMatch = '';
    let bestDist = Infinity;
    for (const k of allKnown) {
      const d = levenshtein(hNorm, k);
      if (d < bestDist) { bestDist = d; bestMatch = k; }
    }
    const suggestion = bestDist <= 3 ? ` — vouliez-vous écrire "${bestMatch}" ?` : '';
    errors.push(`Colonne inconnue : "${h}"${suggestion} (en-tête ligne 1)`);
  }

  // Colonnes obligatoires manquantes
  for (const spec of specs) {
    if (!spec.required) continue;
    const allAliases = [spec.canonical.toLowerCase(), ...spec.aliases.map(a => a.toLowerCase())];
    if (!normalizedReceived.some(h => allAliases.includes(h))) {
      errors.push(`Colonne obligatoire manquante : "${spec.canonical}" (attendu dans l'en-tête, ligne 1)`);
    }
  }

  return errors;
}

// ==========================================
// RÉSOLUTION D'INDEX DE COLONNE PAR NOM
// ==========================================

export function resolveColumnIndex(header: string[], names: string[]): number {
  const normalized = header.map(h => h.trim().toLowerCase());
  for (const name of names) {
    const idx = normalized.indexOf(name.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

// ==========================================
// VALIDATION DE DATE
// ==========================================

const DATE_FORMATS = 'DD/MM/YYYY, YYYY-MM-DD ou MM/DD/YYYY';

/**
 * Valide une date avec message d'erreur enrichi.
 * Retourne null si valide, sinon le message d'erreur.
 */
export function validateDateField(
  raw: string,
  fieldName: string,
  lineNumber: number,
  parser: (s: string) => Date | null,
): string | null {
  if (!raw.trim()) return null;
  if (!parser(raw)) {
    return `Ligne ${lineNumber} — "${fieldName}" : date invalide "${raw}". Formats acceptés : ${DATE_FORMATS}`;
  }
  return null;
}

// ==========================================
// VALIDATION DE MONTANT (strictement positif)
// ==========================================

/**
 * Vérifie qu'un montant est strictement positif (> 0), numérique et non vide.
 * Accepte le format français (virgule comme séparateur décimal).
 * Retourne null si valide, sinon le message d'erreur.
 */
export function validatePositiveAmount(
  raw: string,
  fieldName: string,
  lineNumber: number,
  required = true,
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return required
      ? `Ligne ${lineNumber} — "${fieldName}" : montant manquant (valeur obligatoire)`
      : null;
  }
  const value = Number(trimmed.replace(',', '.').replace('%', ''));
  if (isNaN(value)) {
    return `Ligne ${lineNumber} — "${fieldName}" : valeur non numérique "${raw}"`;
  }
  if (value <= 0) {
    return `Ligne ${lineNumber} — "${fieldName}" : le montant doit être strictement positif (valeur reçue : "${raw}")`;
  }
  return null;
}
