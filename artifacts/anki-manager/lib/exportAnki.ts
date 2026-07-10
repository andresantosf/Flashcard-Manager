import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { strToU8, zipSync } from 'fflate';
import type { Note, Deck } from '@/context/StorageContext';

/** Extract a safe filename from a URL, preserving jpg/png/gif/webp extension. */
function imageFilename(noteId: string, url: string): string {
  const match = url.match(/\.(jpe?g|png|gif|webp)(\?|$)/i);
  const ext = match ? match[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
  return `img_${noteId}.${ext}`;
}

/**
 * Escapes a single TSV field per Anki import spec:
 * wrap in double-quotes if it contains tabs, newlines, or quotes.
 */
function escapeField(value: string): string {
  if (value.includes('\t') || value.includes('\n') || value.includes('"')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Fetch a remote image and return its raw bytes.
 * Returns null on failure so the card is still exported without the image.
 */
async function fetchImageBytes(url: string): Promise<Uint8Array | null> {
  try {
    if (Platform.OS === 'web') {
      const res = await fetch(url);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    }
    // Native: download to a temp file and read as base64
    const tmpPath = `${FileSystem.cacheDirectory}tmp_img_${Date.now()}`;
    const dl = await FileSystem.downloadAsync(url, tmpPath);
    if (dl.status !== 200) return null;
    const b64 = await FileSystem.readAsStringAsync(tmpPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    // Decode base64 → Uint8Array
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * Build the ZIP containing the Anki TSV and all referenced images.
 *
 * Images are downloaded concurrently. Failed downloads are skipped
 * gracefully — the card row is still written but without the <img> tag.
 */
export async function exportAnki(notes: Note[], decks: Deck[]): Promise<void> {
  if (notes.length === 0) {
    Alert.alert(
      'Nenhum cartão pendente',
      'Todos os cartões já estão marcados como feitos.',
    );
    return;
  }

  try {
    const deckMap: Record<string, string> = {};
    decks.forEach((d) => { deckMap[d.id] = d.name; });

    // --- Fetch all images in parallel ---
    const notesWithImages = notes.filter((n) => !!n.imageUrl);
    const imageResults = await Promise.all(
      notesWithImages.map(async (n) => {
        const fname = imageFilename(n.id, n.imageUrl!);
        const bytes = await fetchImageBytes(n.imageUrl!);
        return { noteId: n.id, fname, bytes };
      }),
    );

    // Map noteId → { fname, bytes } for quick lookup
    const imageMap = new Map<string, { fname: string; bytes: Uint8Array | null }>();
    imageResults.forEach((r) => imageMap.set(r.noteId, r));

    // --- Build TSV ---
    const header = [
      '#separator:tab',
      '#html:true',
      '#notetype column:1',
      '#deck column:2',
      '#tags column:5',
    ].join('\n');

    const rows = notes.map((note) => {
      const deckName = deckMap[note.deckId] ?? 'Sem baralho';
      let back = note.back;

      // Append image tag if this note has one
      const img = imageMap.get(note.id);
      if (img?.bytes) {
        back = back + `<br><img src="${img.fname}">`;
      }

      return [
        escapeField('Basic (and reversed card)'),
        escapeField(deckName),
        escapeField(note.front),
        escapeField(back),
        '', // tags column
      ].join('\t');
    });

    const tsvContent = [header, ...rows].join('\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    const txtName = `cartoes_anki_${dateStr}.txt`;
    const zipName = `cartoes_anki_${dateStr}.zip`;

    // --- Assemble ZIP with fflate ---
    const zipEntries: Record<string, Uint8Array> = {
      [txtName]: strToU8(tsvContent),
    };
    imageResults.forEach(({ fname, bytes }) => {
      if (bytes) zipEntries[fname] = bytes;
    });

    const zipBytes = zipSync(zipEntries, { level: 6 });

    // --- Download / share ---
    if (Platform.OS === 'web') {
      const blob = new Blob([zipBytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // Native: write zip to cache and share
    const zipPath = `${FileSystem.cacheDirectory}${zipName}`;
    // fflate gives us a Uint8Array — convert to base64 for FileSystem
    let b64 = '';
    const chunk = 8192;
    for (let i = 0; i < zipBytes.length; i += chunk) {
      b64 += String.fromCharCode(...zipBytes.subarray(i, i + chunk));
    }
    b64 = btoa(b64);

    await FileSystem.writeAsStringAsync(zipPath, b64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Compartilhamento indisponível', `ZIP salvo em: ${zipPath}`);
      return;
    }
    await Sharing.shareAsync(zipPath, {
      mimeType: 'application/zip',
      dialogTitle: 'Exportar cartões para o Anki',
      UTI: 'public.zip-archive',
    });
  } catch (err) {
    console.error('[exportAnki]', err);
    Alert.alert('Erro ao exportar', 'Não foi possível gerar o ZIP. Tente novamente.');
  }
}
