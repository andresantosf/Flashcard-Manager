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
  query,
  orderBy,
  writeBatch,
  getDocs,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
  createNote: (deckId: string, front: string, back: string, author: NoteAuthor) => Promise<void>;
  updateNote: (id: string, updates: Partial<Omit<Note, 'id'>>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  toggleNoteCompleted: (id: string) => Promise<void>;
  getNotesByDeck: (deckId: string) => Note[];
}

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
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Note)));
      setNotesLoaded(true);
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
    async (deckId: string, front: string, back: string, author: NoteAuthor) => {
      await addDoc(collection(db, NOTES), {
        deckId,
        front,
        back,
        completed: false,
        createdAt: new Date().toISOString(),
        authorId: author.id,
        authorName: author.name,
        authorColor: author.color,
        authorInitials: author.initials,
      });
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
