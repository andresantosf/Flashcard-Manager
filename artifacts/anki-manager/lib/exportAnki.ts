import JSZip from 'jszip';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import type { Note, Deck } from '@/context/StorageContext';

/**
 * Name of the Anki profile whose collection.media folder will receive the
 * exported images. Edit this if your Anki profile has a different name —
 * it's also editable directly in the generated .bat file.
 */
const ANKI_PROFILE_NAME = 'André Santos';

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

function formatBackForExport(value: string): string {
  return value.replace(/^💡\s*(.*)$/gm, (_, content) => {
    const safeContent = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return `<font color="#ffff7f"><i>💡 ${safeContent}</i></font>`;
  });
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
export function buildAnkiTsv(
  notes: Note[],
  decks: Deck[],
  imageFilenames?: Record<string, string>,
): string {
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
    let back = formatBackForExport(note.back);
    const imageFile = imageFilenames?.[note.id];
    if (imageFile) {
      back = `${back}<br><img src="${imageFile}">`;
    }
    return [
      escapeField('Básico'),
      escapeField(deckName),
      escapeField(note.front),
      escapeField(back),
      '', // tags column — empty
    ].join('\t');
  });

  return [header, ...rows].join('\n');
}

/**
 * Guesses a file extension for an exported image from its remote URL or
 * blob content-type. Defaults to "jpg" when nothing useful is found.
 */
function guessImageExtension(url: string, contentType?: string | null): string {
  const fromType = contentType?.split('/')[1]?.split(';')[0]?.split('+')[0];
  if (fromType && /^[a-z0-9]+$/i.test(fromType)) return fromType.toLowerCase();
  const match = url.match(/\.([a-zA-Z0-9]{2,5})(?:\?|#|$)/);
  return match ? match[1].toLowerCase() : 'jpg';
}

/**
 * Downloads a remote image (e.g. an imgbb URL) and returns it as base64
 * plus a guessed extension, ready to be embedded in a zip file.
 */
async function fetchImageAsBase64(
  url: string,
): Promise<{ base64: string; ext: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();
    const ext = guessImageExtension(url, blob.type);
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read image blob'));
      reader.onload = () => {
        const result = reader.result as string;
        const comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.readAsDataURL(blob);
    });
    return { base64, ext };
  } catch (err) {
    console.error('[exportAnki] failed to fetch image for export', url, err);
    return null;
  }
}

/**
 * Builds a Windows .bat script that:
 * 1. Copies the exported images into the local Anki profile's
 *    collection.media folder.
 * 2. Launches anki.exe pointing at cartoes_anki.txt, which makes Anki open
 *    its import dialog for that file automatically.
 */
function buildImportBat(): string {
  return [
    '@echo off',
    'setlocal',
    '',
    'rem Se o nome do seu perfil no Anki for diferente, edite a linha abaixo:',
    `set "PERFIL=${ANKI_PROFILE_NAME}"`,
    '',
    'set "MEDIA_DIR=%APPDATA%\\Anki2\\%PERFIL%\\collection.media"',
    'set "SCRIPT_DIR=%~dp0"',
    '',
    'if not exist "%MEDIA_DIR%" (',
    '  echo Pasta de midia do Anki nao encontrada:',
    '  echo   "%MEDIA_DIR%"',
    '  echo Edite a linha "set PERFIL=" neste arquivo com o nome exato do seu perfil no Anki.',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'if exist "%SCRIPT_DIR%images\\*" (',
    '  echo Copiando imagens para o Anki...',
    '  xcopy /Y /I "%SCRIPT_DIR%images\\*" "%MEDIA_DIR%\\" >nul',
    ')',
    '',
    'set "ANKI_EXE="',
    'if exist "%LOCALAPPDATA%\\Programs\\Anki\\anki.exe" set "ANKI_EXE=%LOCALAPPDATA%\\Programs\\Anki\\anki.exe"',
    'if not defined ANKI_EXE if exist "%PROGRAMFILES%\\Anki\\anki.exe" set "ANKI_EXE=%PROGRAMFILES%\\Anki\\anki.exe"',
    'if not defined ANKI_EXE if exist "%PROGRAMFILES(X86)%\\Anki\\anki.exe" set "ANKI_EXE=%PROGRAMFILES(X86)%\\Anki\\anki.exe"',
    '',
    'if not defined ANKI_EXE (',
    '  echo Nao encontrei o anki.exe automaticamente.',
    '  echo Abra o Anki manualmente e importe o arquivo:',
    '  echo   "%SCRIPT_DIR%cartoes_anki.txt"',
    '  pause',
    '  exit /b 1',
    ')',
    '',
    'echo Abrindo o Anki para importar os cartoes...',
    'start "" "%ANKI_EXE%" "%SCRIPT_DIR%cartoes_anki.txt"',
    '',
    'echo.',
    'echo Pronto! Se a janela de importacao nao abrir automaticamente,',
    'echo vá em Arquivo ^> Importar e selecione cartoes_anki.txt',
    'pause',
  ].join('\r\n');
}

/**
 * Encodes text as UTF-16LE with a leading BOM (0xFF 0xFE).
 *
 * cmd.exe has reliably supported Unicode .bat files in this exact encoding
 * since very old Windows versions (it's the classic "save as Unicode in
 * Notepad" trick) — unlike UTF-8, which cmd only auto-detects on newer
 * Windows builds. This is what lets the .bat carry an accented profile
 * name (e.g. "André Santos") without the path getting mangled.
 */
function encodeUtf16LeWithBom(text: string): Uint8Array {
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[2 + i * 2] = code & 0xff;
    bytes[2 + i * 2 + 1] = (code >> 8) & 0xff;
  }
  return bytes;
}

/**
 * Builds a .zip package ready to import into Anki on Windows:
 *   cartoes_anki.txt      — the Anki-importable TSV (images referenced as
 *                            <img src="arquivo.jpg">)
 *   images/*               — every image used by the exported cards
 *   IMPORTAR_NO_ANKI.bat   — copies the images into collection.media and
 *                            launches anki.exe with the .txt file so the
 *                            import dialog opens automatically
 *
 * Triggers a download (web) or the native share sheet (iOS/Android) with
 * the resulting .zip.
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
    const zip = new JSZip();
    const imagesFolder = zip.folder('images');
    const imageFilenames: Record<string, string> = {};

    for (const note of notes) {
      if (!note.imageUrl || !imagesFolder) continue;
      const result = await fetchImageAsBase64(note.imageUrl);
      if (!result) continue;
      const filename = `img_${note.id}.${result.ext}`;
      imagesFolder.file(filename, result.base64, { base64: true });
      imageFilenames[note.id] = filename;
    }

    const tsv = buildAnkiTsv(notes, decks, imageFilenames);
    zip.file('cartoes_anki.txt', tsv);
    zip.file('IMPORTAR_NO_ANKI.bat', encodeUtf16LeWithBom(buildImportBat()));

    const fileName = `anki_export_${new Date().toISOString().slice(0, 10)}.zip`;

    if (Platform.OS === 'web') {
      const blob = await zip.generateAsync({ type: 'blob' });
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

    // Native: write the zip to cache dir then open the share sheet
    const base64Zip = await zip.generateAsync({ type: 'base64' });
    const path = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(path, base64Zip, {
      encoding: FileSystem.EncodingType.Base64,
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
      mimeType: 'application/zip',
      dialogTitle: 'Exportar cartões para o Anki',
      UTI: 'com.pkware.zip-archive',
    });
  } catch (err) {
    console.error('[exportAnki]', err);
    Alert.alert('Erro ao exportar', 'Não foi possível gerar o arquivo. Tente novamente.');
  }
}
