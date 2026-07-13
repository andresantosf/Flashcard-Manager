import JSZip from 'jszip';
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

function formatBackForExport(value: string): string {
  return value.replace(/^💡\s*(.*)$/gm, (_, content) => {
    const safeContent = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return `<br><font color="#ffff7f"><i>💡 ${safeContent}</i></font><br>`;
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
 * 1. Detects every Anki profile under %APPDATA%\Anki2 that has a
 *    collection.media folder, and lets the user pick one if there's more
 *    than one (fixes the case where multiple profiles/collections exist
 *    on the same machine).
 * 2. Copies the exported images into that profile's collection.media
 *    folder.
 * 3. Launches anki.exe pointing at cartoes_anki.txt, which makes Anki open
 *    its import dialog for that file automatically.
 *
 * Progress is echoed step by step (1/4..4/4) with short pauses so the
 * window doesn't look like it "flashes and closes", and every failure path
 * ends in a paused error screen instead of silently closing.
 */
function buildImportBat(): string {
  return [
    '@echo off',
    'setlocal EnableExtensions EnableDelayedExpansion',
    'chcp 1252 >nul',
    'title Importador de Cartoes - Anki',
    '',
    'echo ============================================',
    'echo   IMPORTADOR DE CARTOES PARA O ANKI',
    'echo ============================================',
    'echo.',
    '',
    'set "SCRIPT_DIR=%~dp0"',
    'set "ANKI2_DIR=%APPDATA%\\Anki2"',
    'set "MEDIA_DIR="',
    'set "COUNT=0"',
    '',
    'echo [1/4] Procurando perfis do Anki...',
    '',
    'if not exist "%ANKI2_DIR%" (',
    '  echo   [ERRO] Pasta do Anki nao encontrada: "%ANKI2_DIR%"',
    '  set "ERRO=1"',
    ')',
    '',
    'if not defined ERRO (',
    '  for /f "delims=" %%P in (\'dir /b /ad "%ANKI2_DIR%" 2^>nul\') do (',
    '    if /I not "%%P"=="addons21" (',
    '      if exist "%ANKI2_DIR%\\%%P\\collection.media" (',
    '        set /a COUNT+=1',
    '        set "PERFIL_!COUNT!=%%P"',
    '        echo   [!COUNT!] %%P',
    '      )',
    '    )',
    '  )',
    ')',
    '',
    'if not defined ERRO if "!COUNT!"=="0" (',
    '  echo   [ERRO] Nao encontrei nenhum perfil com collection.media.',
    '  set "ERRO=1"',
    ')',
    '',
    'if defined ERRO goto :falhou',
    '',
    'if "!COUNT!"=="1" (',
    '  set "PERFIL_ESCOLHIDO=!PERFIL_1!"',
    '  echo       Apenas um perfil encontrado, usando: "!PERFIL_ESCOLHIDO!"',
    ') else (',
    '  echo.',
    '  set /p "ESCOLHA=Digite o numero do perfil que voce usa: "',
    ')',
    '',
    'if not "!COUNT!"=="1" (',
    '  call set "PERFIL_ESCOLHIDO=%%PERFIL_!ESCOLHA!%%"',
    '  if not defined PERFIL_ESCOLHIDO (',
    '    echo   [ERRO] Opcao invalida.',
    '    set "ERRO=1"',
    '  )',
    ')',
    '',
    'if defined ERRO goto :falhou',
    '',
    'set "MEDIA_DIR=%ANKI2_DIR%\\!PERFIL_ESCOLHIDO!\\collection.media"',
    'echo       OK - usando perfil: "!PERFIL_ESCOLHIDO!"',
    'echo.',
    '',
    'echo [2/4] Copiando imagens para o Anki...',
    'set "IMAGES_SRC=%SCRIPT_DIR%images"',
    '',
    'if not exist "!IMAGES_SRC!" (',
    '  echo       Nenhuma pasta "images" encontrada - pulando esta etapa.',
    '  goto :pulou_imagens',
    ')',
    '',
    'robocopy "!IMAGES_SRC!" "!MEDIA_DIR!" /E >nul',
    'if !ERRORLEVEL! GEQ 8 (',
    '  echo       [ERRO] Falha ao copiar as imagens ^(codigo !ERRORLEVEL!^).',
    '  set "ERRO=1"',
    '  goto :pulou_imagens',
    ')',
    'echo       OK - imagens copiadas para "!PERFIL_ESCOLHIDO!".',
    '',
    ':pulou_imagens',
    'if defined ERRO goto :falhou',
    'timeout /t 1 /nobreak >nul',
    'echo.',
    '',
    'echo [3/4] Procurando o executavel do Anki...',
    'set "ANKI_EXE="',
    'if exist "%LOCALAPPDATA%\\Programs\\Anki\\anki.exe" set "ANKI_EXE=%LOCALAPPDATA%\\Programs\\Anki\\anki.exe"',
    'if not defined ANKI_EXE if exist "%PROGRAMFILES%\\Anki\\anki.exe" set "ANKI_EXE=%PROGRAMFILES%\\Anki\\anki.exe"',
    'if not defined ANKI_EXE if exist "%PROGRAMFILES(X86)%\\Anki\\anki.exe" set "ANKI_EXE=%PROGRAMFILES(X86)%\\Anki\\anki.exe"',
    '',
    'if not defined ANKI_EXE (',
    '  echo   [ERRO] Nao encontrei o anki.exe automaticamente.',
    '  echo   Abra o Anki manualmente e importe o arquivo:',
    '  echo     "%SCRIPT_DIR%cartoes_anki.txt"',
    '  set "ERRO=1"',
    ')',
    '',
    'if defined ERRO goto :falhou',
    '',
    'echo       OK - encontrado em "%ANKI_EXE%".',
    'timeout /t 1 /nobreak >nul',
    'echo.',
    '',
    'echo [4/4] Abrindo o Anki para importar os cartoes...',
    'start "" "%ANKI_EXE%" "%SCRIPT_DIR%cartoes_anki.txt"',
    'timeout /t 1 /nobreak >nul',
    'echo.',
    '',
    'echo ============================================',
    'echo   CONCLUIDO COM SUCESSO',
    'echo ============================================',
    'echo Se a janela de importacao nao abrir automaticamente,',
    'echo va em Arquivo ^> Importar e selecione cartoes_anki.txt',
    'echo.',
    'pause',
    'exit /b 0',
    '',
    ':falhou',
    'echo.',
    'echo ============================================',
    'echo   PROCESSO INTERROMPIDO - VEJA O ERRO ACIMA',
    'echo ============================================',
    'echo.',
    'pause',
    'exit /b 1',
  ].join('\r\n');
}

/**
 * Encodes text as single-byte "ANSI" (Windows-1252) — one byte per
 * character code. This is what cmd.exe expects by default on pt-BR
 * Windows installs (code page 1252), and it's what was manually confirmed
 * to work when saving the .bat from Notepad as "ANSI".
 *
 * buildImportBat() is written to be pure ASCII on purpose (no "ã", "ç",
 * etc. — e.g. "Cartoes" instead of "Cartões") specifically so this
 * encoding is safe: for codes 0-255 this is a direct byte-for-byte
 * mapping, so as long as the source string stays within that range the
 * output is unambiguous regardless of which single-byte code page cmd.exe
 * ends up using.
 */
function encodeAnsi(text: string): Uint8Array {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) {
    bytes[i] = text.charCodeAt(i) & 0xff;
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
    zip.file('IMPORTAR_NO_ANKI.bat', encodeAnsi(buildImportBat()));

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
