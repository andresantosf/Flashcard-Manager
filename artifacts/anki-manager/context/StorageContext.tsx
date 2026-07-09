import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
}

interface StorageContextType {
  decks: Deck[];
  notes: Note[];
  loading: boolean;
  createDeck: (name: string, color: string) => Promise<void>;
  updateDeck: (id: string, updates: Partial<Deck>) => Promise<void>;
  deleteDeck: (id: string) => Promise<void>;
  createNote: (deckId: string, front: string, back: string) => Promise<void>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  toggleNoteCompleted: (id: string) => Promise<void>;
  getNotesByDeck: (deckId: string) => Note[];
}

const StorageContext = createContext<StorageContextType | null>(null);

const DECKS_KEY = '@anki_decks';
const NOTES_KEY = '@anki_notes';

const generateId = () =>
  `${Date.now().toString()}_${Math.random().toString(36).substr(2, 9)}`;

export function StorageProvider({ children }: { children: React.ReactNode }) {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // Refs always hold the latest array — avoids stale-closure data loss
  // when multiple operations happen in quick succession.
  const decksRef = useRef<Deck[]>([]);
  const notesRef = useRef<Note[]>([]);

  // Keep refs in sync with state
  useEffect(() => { decksRef.current = decks; }, [decks]);
  useEffect(() => { notesRef.current = notes; }, [notes]);

  useEffect(() => {
    const load = async () => {
      try {
        const [rawDecks, rawNotes] = await Promise.all([
          AsyncStorage.getItem(DECKS_KEY),
          AsyncStorage.getItem(NOTES_KEY),
        ]);
        const loadedDecks: Deck[] = rawDecks ? JSON.parse(rawDecks) : [];
        const loadedNotes: Note[] = rawNotes ? JSON.parse(rawNotes) : [];
        decksRef.current = loadedDecks;
        notesRef.current = loadedNotes;
        setDecks(loadedDecks);
        setNotes(loadedNotes);
      } catch (e) {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const persistDecks = useCallback(async (next: Deck[]) => {
    decksRef.current = next;
    setDecks(next);
    await AsyncStorage.setItem(DECKS_KEY, JSON.stringify(next));
  }, []);

  const persistNotes = useCallback(async (next: Note[]) => {
    notesRef.current = next;
    setNotes(next);
    await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(next));
  }, []);

  const createDeck = useCallback(
    async (name: string, color: string) => {
      const deck: Deck = {
        id: generateId(),
        name,
        color,
        createdAt: new Date().toISOString(),
      };
      // Read from ref for the freshest array, not from closure
      await persistDecks([...decksRef.current, deck]);
    },
    [persistDecks],
  );

  const updateDeck = useCallback(
    async (id: string, updates: Partial<Deck>) => {
      await persistDecks(
        decksRef.current.map((d) => (d.id === id ? { ...d, ...updates } : d)),
      );
    },
    [persistDecks],
  );

  const deleteDeck = useCallback(
    async (id: string) => {
      await persistDecks(decksRef.current.filter((d) => d.id !== id));
      await persistNotes(notesRef.current.filter((n) => n.deckId !== id));
    },
    [persistDecks, persistNotes],
  );

  const createNote = useCallback(
    async (deckId: string, front: string, back: string) => {
      const note: Note = {
        id: generateId(),
        deckId,
        front,
        back,
        completed: false,
        createdAt: new Date().toISOString(),
      };
      await persistNotes([...notesRef.current, note]);
    },
    [persistNotes],
  );

  const updateNote = useCallback(
    async (id: string, updates: Partial<Note>) => {
      await persistNotes(
        notesRef.current.map((n) => (n.id === id ? { ...n, ...updates } : n)),
      );
    },
    [persistNotes],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      await persistNotes(notesRef.current.filter((n) => n.id !== id));
    },
    [persistNotes],
  );

  const toggleNoteCompleted = useCallback(
    async (id: string) => {
      await persistNotes(
        notesRef.current.map((n) =>
          n.id === id ? { ...n, completed: !n.completed } : n,
        ),
      );
    },
    [persistNotes],
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
