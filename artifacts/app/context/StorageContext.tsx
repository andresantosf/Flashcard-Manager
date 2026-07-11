import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function todayKey(): string {
  return formatDate(new Date());
}

function currentStreakFromNotes(notes: { createdAt: string }[]): number {
  const dateSet = new Set(notes.map((note) => note.createdAt.slice(0, 10)));
  if (dateSet.size === 0) return 0;

  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  if (!dateSet.has(formatDate(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (dateSet.has(formatDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

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

  const notesByDeckId = useMemo(() => {
    return notes.reduce<Map<string, Note[]>>((groups, note) => {
      const currentGroup = groups.get(note.deckId) ?? [];
      currentGroup.push(note);
      groups.set(note.deckId, currentGroup);
      return groups;
    }, new Map());
  }, [notes]);

  const getNotesByDeck = useCallback(
    (deckId: string) => notesByDeckId.get(deckId) ?? [],
    [notesByDeckId],
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
