// Déménagement de l'appli vers sa nouvelle adresse.
// Les données (séances, profil…) sont liées à l'adresse du site : elles ne suivent pas toutes seules.
// L'ancienne adresse emballe tout dans un « code de transfert », envoyé par le lien et copié dans le
// presse-papiers ; la nouvelle adresse le déballe (automatiquement par le lien, ou en le collant).

import { exportAll, importAll, isBackupFile, type BackupFile } from '../../data/backup';
import { MuscuDB } from '../../data/dexie/db';
import { dbNameFor, people, type Person } from '../../data/people';
import { isLang } from '../../i18n';
import { CUSTOM_PHOTO, isImageDataUrl, SPLASH_PHOTOS } from '../../ui/splashPhotos';

/** Nouvelle adresse de l'appli. */
export const NEW_ORIGIN = 'https://workanddiscipline.github.io';
/** Ancienne adresse (GitHub Pages). */
export const OLD_HOST = 'w45ffvv7k6-eng.github.io';

export const isOldAddress = () => location.hostname === OLD_HOST;

/** Début de l'adresse qui porte le code de transfert : …/#transfert=<code>. */
const HASH_PREFIX = '#transfert=';
/** Au-delà, le code ne passe plus par le lien (trop long) : seul le presse-papiers le transporte. */
const MAX_LINK_LENGTH = 1_000_000;
/** Préfixes du code : compressé (gzip) ou non (navigateur trop ancien pour compresser). */
const GZIP = 'g';
const PLAIN = 'p';

interface TransferPerson {
  name: string;
  photo?: string;
  avatar?: string;
  lang?: string;
  data: BackupFile['data'];
}

interface Transfer {
  app: 'work-discipline-transfer';
  version: 1;
  people: TransferPerson[];
  /** Personne identifiée sur l'ancien téléphone (index dans `people`). */
  active: number;
}

// ---------- Emballage ----------

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function pipe(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const body = new Blob([bytes as Uint8Array<ArrayBuffer>])
    .stream()
    .pipeThrough(stream as unknown as TransformStream<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(body).arrayBuffer());
}

export async function encodeTransfer(transfer: Transfer): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(transfer));
  if (typeof CompressionStream === 'undefined') return PLAIN + toBase64Url(bytes);
  return GZIP + toBase64Url(await pipe(bytes, new CompressionStream('gzip')));
}

export async function decodeTransfer(code: string): Promise<Transfer | null> {
  try {
    const clean = code.trim().replace(/^.*#transfert=/, '');
    const bytes = fromBase64Url(clean.slice(1));
    const raw = clean[0] === GZIP ? await pipe(bytes, new DecompressionStream('gzip')) : bytes;
    const value = JSON.parse(new TextDecoder().decode(raw)) as Transfer;
    const valid =
      value?.app === 'work-discipline-transfer' &&
      value.version === 1 &&
      Array.isArray(value.people) &&
      value.people.every(
        (p) =>
          typeof p?.name === 'string' &&
          isBackupFile({ app: 'work-discipline', version: 1, exportedAt: 0, data: p.data }),
      );
    return valid ? value : null;
  } catch {
    return null;
  }
}

// ---------- Ancienne adresse : tout emballer ----------

/** Code de transfert de toutes les personnes du téléphone (photo de fond exclue : trop lourde). */
export async function buildTransferCode(): Promise<string> {
  const list: Person[] = people.list().length > 0 ? people.list() : [{ id: 'default', name: '', createdAt: 0 }];
  const out: TransferPerson[] = [];
  for (const person of list) {
    const db = new MuscuDB(dbNameFor(person.id));
    try {
      const backup = await exportAll(db);
      out.push({ name: person.name, photo: person.photo, avatar: person.avatar, lang: person.lang, data: backup.data });
    } finally {
      db.close();
    }
  }
  const active = Math.max(
    0,
    list.findIndex((p) => p.id === people.activeId()),
  );
  return encodeTransfer({ app: 'work-discipline-transfer', version: 1, people: out, active });
}

/** Adresse de la nouvelle appli, avec le code quand il n'est pas trop long. */
export function transferUrl(code: string): string {
  return code.length <= MAX_LINK_LENGTH ? `${NEW_ORIGIN}/${HASH_PREFIX}${code}` : `${NEW_ORIGIN}/`;
}

// ---------- Nouvelle adresse : tout déballer ----------

/** Code de transfert présent dans l'adresse (arrivée depuis l'ancienne appli), sinon null. */
export function transferCodeFromAddress(): string | null {
  return location.hash.startsWith(HASH_PREFIX) ? location.hash.slice(HASH_PREFIX.length) : null;
}

/** Indique au prochain démarrage que le transfert vient de réussir (message de bienvenue). */
const DONE_KEY = 'wd-transfer-done';

export function takeTransferDone(): boolean {
  try {
    const done = sessionStorage.getItem(DONE_KEY) === '1';
    sessionStorage.removeItem(DONE_KEY);
    return done;
  } catch {
    return false;
  }
}

/**
 * Installe les personnes et leurs données. Une personne déjà présente (même prénom) est remplacée.
 * Renvoie false si le code est invalide.
 */
export async function applyTransfer(code: string): Promise<boolean> {
  const transfer = await decodeTransfer(code);
  if (!transfer) return false;
  const ids: string[] = [];
  for (const p of transfer.people) {
    const existing = people.list().find((q) => q.name.trim().toLowerCase() === p.name.trim().toLowerCase());
    // Données venues d'un code : on n'accepte que des valeurs attendues.
    const photo =
      typeof p.photo === 'string' && [...SPLASH_PHOTOS, CUSTOM_PHOTO].includes(p.photo) ? p.photo : undefined;
    const person = existing ?? people.add(p.name || 'Moi', photo, isLang(p.lang) ? p.lang : undefined);
    if (isImageDataUrl(p.avatar)) people.setAvatar(person.id, p.avatar);
    const db = new MuscuDB(dbNameFor(person.id));
    try {
      await importAll(db, { app: 'work-discipline', version: 1, exportedAt: Date.now(), data: p.data });
    } finally {
      db.close();
    }
    ids.push(person.id);
  }
  people.select(ids[transfer.active] ?? ids[0]);
  try {
    sessionStorage.setItem(DONE_KEY, '1');
  } catch {
    // message de bienvenue perdu : sans gravité
  }
  return true;
}
