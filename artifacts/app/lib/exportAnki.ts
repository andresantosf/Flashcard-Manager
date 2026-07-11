import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import type { Note, Deck } from '@/context/StorageContext';

/**
 * Escapes a single TSV field per Anki import spec:
 * - If the value contains a tab, newline, or double-quote, wrap in double
 *   quotes and double any internal double-quotes.
 */
function escapeField(value: string): string {
  if (value.includes('\t') || value.includes('\n') || value.includes('"')) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Builds the Anki-compatible TSV string from the given (already-filtered) notes.
 *
 * File format:
 *   #separator:tab
 *   #html:true
 *   #notetype column:1
 *   #deck column:2
 *   #tags column:5
 *   Basic (and reversed card)  <tab>  <deck>  <tab>  <front>  <tab>  <back>  <tab>  (empty tags)
 */
export function buildAnkiTsv(notes: Note[], decks: Deck[]): string {
  const deckMap: Record<string, string> = {};
  decks.forEach((d) => { deckMap[d.id] = d.name; });

  const header = [
    '#separator:tab',
    '#html:true',
    '#notetype column:1',
    '#deck column:2',
    '#tags column:5',
  ].join('\n');

  const rows = notes.map((note) => {
    const deckName = deckMap[note.deckId] ?? 'Sem baralho';
    return [
      escapeField('Basic (and reversed card)'),
      escapeField(deckName),
      escapeField(note.front),
      escapeField(note.back),
      '', // tags column — empty
    ].join('\t');
  });

  return [header, ...rows].join('\n');
}

/**
 * Triggers a download/share of the Anki TSV file.
 * - On web   → Blob URL + hidden <a> click.
 * - On native → expo-file-system write + expo-sharing sheet.
 *
 * Accepts the already-filtered pending notes (caller's responsibility).
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
    const content = buildAnkiTsv(notes, decks);
    const fileName = `cartoes_anki_${new Date().toISOString().slice(0, 10)}.txt`;

    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return;
    }

    // Native: write to cache dir then open share sheet
    const path = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(path, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert(
        'Compartilhamento indisponível',
        `O arquivo foi salvo em: ${path}`,
      );
      return;
    }

    await Sharing.shareAsync(path, {
      mimeType: 'text/plain',
      dialogTitle: 'Exportar cartões para o Anki',
      UTI: 'public.plain-text',
    });
  } catch (err) {
    console.error('[exportAnki]', err);
    Alert.alert('Erro ao exportar', 'Não foi possível gerar o arquivo. Tente novamente.');
  }
}
