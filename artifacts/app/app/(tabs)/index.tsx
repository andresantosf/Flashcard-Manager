import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useStorage, type Deck, NO_DECK_ID, NO_DECK } from '@/context/StorageContext';
import { useProfile } from '@/context/ProfileContext';
import { DeckCard } from '@/components/DeckCard';
import { SpeedDial } from '@/components/SpeedDial';
import { DeckModal } from '@/components/DeckModal';
import { NoteModal } from '@/components/NoteModal';
import { ProfileMenu, ProfileAvatar } from '@/components/ProfileMenu';
import { DeckContextMenu } from '@/components/DeckContextMenu';
import { exportAnki } from '@/lib/exportAnki';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { decks, notes } = useStorage();
  const { activeProfile } = useProfile();

  const [deckModalVisible, setDeckModalVisible] = useState(false);
  const [deckToEdit, setDeckToEdit] = useState<Deck | undefined>(undefined);

  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [noteModalDeckId, setNoteModalDeckId] = useState<string | undefined>(undefined);

  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  // Long-press deck context menu
  const [contextDeck, setContextDeck] = useState<Deck | null>(null);

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  const pendingNotes = useMemo(
    () => notes.filter((note) => !note.completed),
    [notes],
  );
  const pendingCount = pendingNotes.length;

  const noteCountByDeckId = useMemo(() => {
    return notes.reduce<Record<string, number>>((acc, note) => {
      acc[note.deckId] = (acc[note.deckId] ?? 0) + 1;
      return acc;
    }, {});
  }, [notes]);

  const noDeckCount = noteCountByDeckId[NO_DECK_ID] ?? 0;
  const hasAnyContent = decks.length > 0 || noDeckCount > 0;

  const openCreateDeckModal = useCallback(() => {
    setDeckToEdit(undefined);
    setDeckModalVisible(true);
  }, []);

  const openCreateNoteModal = useCallback(() => {
    setNoteModalDeckId(undefined);
    setNoteModalVisible(true);
  }, []);

  const closeDeckModal = useCallback(() => {
    setDeckModalVisible(false);
    setDeckToEdit(undefined);
  }, []);

  const closeNoteModal = useCallback(() => {
    setNoteModalVisible(false);
    setNoteModalDeckId(undefined);
  }, []);

  const openDeckContextMenu = useCallback((deck: Deck) => {
    setContextDeck(deck);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextDeck(null);
  }, []);

  const handleAddNoteToContextDeck = useCallback(() => {
    setNoteModalDeckId(contextDeck?.id);
    setNoteModalVisible(true);
  }, [contextDeck?.id]);

  const handleExportPending = useCallback(() => {
    exportAnki(pendingNotes, decks);
  }, [decks, pendingNotes]);

  const speedDialOptions = useMemo(
    () => [
      {
        label: 'Novo Baralho',
        icon: 'layers' as const,
        onPress: openCreateDeckModal,
      },
      {
        label: 'Nova Nota',
        icon: 'file-plus' as const,
        onPress: openCreateNoteModal,
      },
      {
        label: `Baixar para Anki (${pendingCount})`,
        icon: 'download' as const,
        onPress: handleExportPending,
      },
    ],
    [handleExportPending, openCreateDeckModal, openCreateNoteModal, pendingCount],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Meus Baralhos
            </Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {decks.length} {decks.length === 1 ? 'baralho' : 'baralhos'}
            </Text>
          </View>

          {/* Profile avatar button */}
          <Pressable
            onPress={() => setProfileMenuVisible(true)}
            style={({ pressed }) => [styles.avatarBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <ProfileAvatar
              photo={activeProfile.photo}
              initials={activeProfile.initials}
              color={activeProfile.color}
              size={38}
            />
          </Pressable>
        </View>
      </View>

      {/* Deck list */}
      <FlatList
        data={decks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 120 + (insets.bottom || 0) },
        ]}
        scrollEnabled={hasAnyContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          noDeckCount === 0 ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyIcon, { color: colors.border }]}>▤</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Nenhum baralho ainda
              </Text>
              <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
                Toque no + para criar seu primeiro baralho
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          noDeckCount > 0 ? (
            <DeckCard
              deck={NO_DECK}
              cardCount={noDeckCount}
              onPress={() => router.push(`/deck/${NO_DECK_ID}`)}
              onLongPress={() => openDeckContextMenu(NO_DECK)}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <DeckCard
            deck={item}
            cardCount={noteCountByDeckId[item.id] ?? 0}
            onPress={() => router.push(`/deck/${item.id}`)}
            onLongPress={() => openDeckContextMenu(item)}
          />
        )}
      />

      <SpeedDial
        options={speedDialOptions}
        onLongPress={() => {
          setNoteModalDeckId(undefined);
          setNoteModalVisible(true);
        }}
      />

      {/* Deck create / edit modal */}
      <DeckModal
        visible={deckModalVisible}
        onClose={closeDeckModal}
        deckToEdit={deckToEdit}
      />

      {/* Note create modal (optionally pre-selects a deck) */}
      <NoteModal
        visible={noteModalVisible}
        onClose={closeNoteModal}
        deckId={noteModalDeckId}
      />

      <ProfileMenu
        visible={profileMenuVisible}
        onClose={() => setProfileMenuVisible(false)}
      />

      {/* Deck long-press context menu */}
      <DeckContextMenu
        visible={contextDeck !== null}
        deck={contextDeck}
        onClose={closeContextMenu}
        onAddNote={handleAddNoteToContextDeck}
        onEditDeck={() => {
          setDeckToEdit(contextDeck ?? undefined);
          setDeckModalVisible(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    marginTop: 2,
  },
  avatarBtn: {
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  empty: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyIcon: { fontSize: 56, marginBottom: 8 },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
});
