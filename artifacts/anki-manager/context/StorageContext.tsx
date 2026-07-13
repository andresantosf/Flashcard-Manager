import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  query,
  orderBy,
  writeBatch,
  getDocs,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import uploadImage from '@/lib/imgbb';
import {
  sendNewCardNotification,
  scheduleDailyReminder,
  cancelDailyReminder,
} from '@/lib/notifications';

// ── Notification helpers ──────────────────────────────────────────────────────

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentStreakFromNotes(notes: { createdAt: string }[]): number {
  const dateSet = new Set(notes.map((n) => n.createdAt.slice(0, 10)));
  if (dateSet.size === 0) return 0;
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (!dateSet.has(key(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dateSet.has(key(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }
  return streak;
}

export interface Deck {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface Note {
  id: string;
  deckId: string;
  front: string;
  back: string;
  completed: boolean;
  createdAt: string;
  /** Profile info — optional so old notes without author still work */
  authorId?: string;
  authorName?: string;
  authorColor?: string;
  authorInitials?: string;
  imageUrl?: string;
}

export interface NoteAuthor {
  id: string;
  name: string;
  color: string;
  initials: string;
}

interface StorageContextType {
  decks: Deck[];
  notes: Note[];
  loading: boolean;
  createDeck: (name: string, color: string) => Promise<void>;
  updateDeck: (id: string, updates: Partial<Omit<Deck, 'id'>>) => Promise<void>;
  deleteDeck: (id: string) => Promise<void>;
  createNote: (
    deckId: string,
    front: string,
    back: string,
    author: NoteAuthor,
    imageUri?: string,
  ) => Promise<void>;
  updateNote: (id: string, updates: Partial<Omit<Note, 'id'>>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  toggleNoteCompleted: (id: string) => Promise<void>;
  getNotesByDeck: (deckId: string) => Note[];
  /** Moves every listed note to `deckId` in one/few Firestore batches. */
  bulkMoveNotes: (ids: string[], deckId: string) => Promise<void>;
  /** Marks every listed note completed/not-completed in one/few batches. */
  bulkSetCompleted: (ids: string[], completed: boolean) => Promise<void>;
  /** Deletes every listed note in one/few Firestore batches. */
  bulkDeleteNotes: (ids: string[]) => Promise<void>;
}

/** Virtual deck id — notes without a real deck are stored under this id */
export const NO_DECK_ID = '__no_deck__';

/** Synthetic Deck object representing "no deck assigned" */
export const NO_DECK: Deck = {
  id: NO_DECK_ID,
  name: 'Sem baralho',
  color: '#9CA3AF',
  createdAt: '',
};

const StorageContext = createContext<StorageContextType | null>(null);

const DECKS = 'decks';
const NOTES = 'notes';

export function StorageProvider({ children }: { children: React.ReactNode }) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [decksLoaded, setDecksLoaded] = useState(false);
  const [notesLoaded, setNotesLoaded] = useState(false);

  const loading = !decksLoaded || !notesLoaded;

  useEffect(() => {
    const q = query(collection(db, DECKS), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      setDecks(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deck)));
      setDecksLoaded(true);
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, NOTES), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      const loaded = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Note));
      setNotes(loaded);
      setNotesLoaded(true);
      // Schedule or cancel tonight's reminder based on today's activity
      const addedToday = loaded.some((n) => n.createdAt.startsWith(todayKey()));
      if (addedToday) {
        cancelDailyReminder();
      } else {
        scheduleDailyReminder(currentStreakFromNotes(loaded));
      }
    });
  }, []);

  const createDeck = useCallback(async (name: string, color: string) => {
    await addDoc(collection(db, DECKS), {
      name,
      color,
      createdAt: new Date().toISOString(),
    });
  }, []);

  const updateDeck = useCallback(
    async (id: string, updates: Partial<Omit<Deck, 'id'>>) => {
      await updateDoc(doc(db, DECKS, id), updates);
    },
    [],
  );

  const deleteDeck = useCallback(async (id: string) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, DECKS, id));
    const notesSnap = await getDocs(
      query(collection(db, NOTES), where('deckId', '==', id)),
    );
    notesSnap.forEach((n) => batch.delete(n.ref));
    await batch.commit();
  }, []);

  const createNote = useCallback(
    async (
      deckId: string,
      front: string,
      back: string,
      author: NoteAuthor,
      imageUri?: string,
    ) => {
      const noteRef = doc(collection(db, NOTES));
      const noteData: Partial<Note> = {
        deckId,
        front,
        back,
        completed: false,
        createdAt: new Date().toISOString(),
        authorId: author.id,
        authorName: author.name,
        authorColor: author.color,
        authorInitials: author.initials,
      };

      if (imageUri) {
        // Let upload errors propagate to the caller so the UI can surface them.
        noteData.imageUrl = await uploadImage(imageUri);
      }

      await setDoc(noteRef, noteData);

      // Fire "X adicionou um novo cartão" notification + cancel tonight's reminder
      sendNewCardNotification(author.name).catch(() => {});
      cancelDailyReminder().catch(() => {});
    },
    [],
  );

  const updateNote = useCallback(
    async (id: string, updates: Partial<Omit<Note, 'id'>>) => {
      await updateDoc(doc(db, NOTES, id), updates);
    },
    [],
  );

  const deleteNote = useCallback(async (id: string) => {
    await deleteDoc(doc(db, NOTES, id));
  }, []);

  const toggleNoteCompleted = useCallback(
    async (id: string) => {
      const note = notes.find((n) => n.id === id);
      if (!note) return;
      await updateDoc(doc(db, NOTES, id), { completed: !note.completed });
    },
    [notes],
  );

  const getNotesByDeck = useCallback(
    (deckId: string) => notes.filter((n) => n.deckId === deckId),
    [notes],
  );

  // Firestore caps a single batch at 500 writes, so bulk helpers below split
  // large selections into chunks and commit them back-to-back. Each chunk is
  // still atomic; this keeps bulk actions fast and consistent even for
  // selections spanning hundreds/thousands of cards.
  const BATCH_CHUNK_SIZE = 450;

  const runBatchedWrite = useCallback(
    async (ids: string[], apply: (batch: ReturnType<typeof writeBatch>, id: string) => void) => {
      for (let i = 0; i < ids.length; i += BATCH_CHUNK_SIZE) {
        const chunk = ids.slice(i, i + BATCH_CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((id) => apply(batch, id));
        await batch.commit();
      }
    },
    [],
  );

  const bulkMoveNotes = useCallback(
    async (ids: string[], deckId: string) => {
      if (ids.length === 0) return;
      await runBatchedWrite(ids, (batch, id) => {
        batch.update(doc(db, NOTES, id), { deckId });
      });
    },
    [runBatchedWrite],
  );

  const bulkSetCompleted = useCallback(
    async (ids: string[], completed: boolean) => {
      if (ids.length === 0) return;
      await runBatchedWrite(ids, (batch, id) => {
        batch.update(doc(db, NOTES, id), { completed });
      });
    },
    [runBatchedWrite],
  );

  const bulkDeleteNotes = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      await runBatchedWrite(ids, (batch, id) => {
        batch.delete(doc(db, NOTES, id));
      });
    },
    [runBatchedWrite],
  );

  return (
    <StorageContext.Provider
      value={{
        decks,
        notes,
        loading,
        createDeck,
        updateDeck,
        deleteDeck,
        createNote,
        updateNote,
        deleteNote,
        toggleNoteCompleted,
        getNotesByDeck,
        bulkMoveNotes,
        bulkSetCompleted,
        bulkDeleteNotes,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage() {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error('useStorage must be used inside StorageProvider');
  return ctx;
}
