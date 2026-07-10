import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useStorage, type Note, NO_DECK_ID, NO_DECK } from '@/context/StorageContext';
import { NoteCard } from '@/components/NoteCard';
import { SpeedDial } from '@/components/SpeedDial';
import { NoteModal } from '@/components/NoteModal';
import { DeckModal } from '@/components/DeckModal';
import { ContextMenu } from '@/components/ContextMenu';
import { ProfileMenu, ProfileAvatar } from '@/components/ProfileMenu';
import { useProfile } from '@/context/ProfileContext';

export default function DeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { decks, getNotesByDeck, toggleNoteCompleted, deleteNote, deleteDeck } =
    useStorage();
  const { activeProfile } = useProfile();

  // Support the virtual "Sem baralho" deck that lives only in the client
  const isVirtualDeck = id === NO_DECK_ID;
  const deck = isVirtualDeck ? NO_DECK : decks.find((d) => d.id === id);
  const notes = deck
    ? [...getNotesByDeck(deck.id)].sort((a, b) => {
        if (a.completed === b.completed) {
          return a.createdAt.localeCompare(b.createdAt);
        }
        return a.completed ? 1 : -1;
      })
    : [];

  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [editDeckVisible, setEditDeckVisible] = useState(false);
  const [contextNote, setContextNote] = useState<Note | null>(null);
  const [editNoteVisible, setEditNoteVisible] = useState(false);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  const bottomPad = (insets.bottom || 0) + (Platform.OS === 'web' ? 34 : 0);

  const speedDialOptions = [
    {
      label: 'Nova Nota',
      icon: 'file-plus' as const,
      onPress: () => setNoteModalVisible(true),
    },
  ];

  if (!deck) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Baralho' }} />
        <Text style={{ color: colors.mutedForeground, textAlign: 'center', marginTop: 40 }}>
          Baralho não encontrado.
        </Text>
      </View>
    );
  }

  const handleDeleteDeck = () => {
    Alert.alert(
      'Excluir baralho',
      `Tem certeza que quer excluir "${deck.name}"? Todos os cartões dentro dele também serão excluídos permanentemente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await deleteDeck(deck.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: deck.name,
          headerRight: () => (
            <View style={styles.headerActions}>
              {/* Profile avatar */}
              <Pressable
                onPress={() => setProfileMenuVisible(true)}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <ProfileAvatar
                  photo={activeProfile.photo}
                  initials={activeProfile.initials}
                  color={activeProfile.color}
                  size={30}
                />
              </Pressable>
              {/* More options — hidden for the virtual deck */}
              {!isVirtualDeck && (
                <Pressable
                  onPress={() => setEditDeckVisible(true)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Feather name="more-horizontal" size={22} color={colors.foreground} />
                </Pressable>
              )}
            </View>
          ),
        }}
      />

      {/* Deck color accent bar */}
      <View style={[styles.colorAccent, { backgroundColor: deck.color + '20' }]}>
        <View style={[styles.colorDot, { backgroundColor: deck.color }]} />
        <Text style={[styles.accentText, { color: deck.color }]}>
          {notes.length} {notes.length === 1 ? 'cartão' : 'cartões'}
        </Text>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 120 + bottomPad },
        ]}
        scrollEnabled={notes.length > 0}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyIcon, { color: colors.border }]}>✦</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Nenhum cartão ainda
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Toque no + para adicionar sua primeira nota
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <NoteCard
            note={item}
            onPress={() => {
              setContextNote(item);
              setEditNoteVisible(true);
            }}
            onLongPress={() => {
              setContextNote(item);
            }}
          />
        )}
      />

      <SpeedDial options={speedDialOptions} />

      <NoteModal
        visible={noteModalVisible}
        onClose={() => setNoteModalVisible(false)}
        deckId={deck.id}
      />

      <NoteModal
        visible={editNoteVisible}
        onClose={() => {
          setEditNoteVisible(false);
          setContextNote(null);
        }}
        deckId={deck.id}
        noteToEdit={contextNote ?? undefined}
      />

      <DeckModal
        visible={editDeckVisible}
        onClose={() => setEditDeckVisible(false)}
        deckToEdit={deck}
      />

      <ContextMenu
        visible={!!contextNote && !editNoteVisible}
        onClose={() => setContextNote(null)}
        onEdit={() => setEditNoteVisible(true)}
        onToggleCompleted={async () => {
          if (contextNote) {
            await toggleNoteCompleted(contextNote.id);
            setContextNote(null);
          }
        }}
        onDelete={() => {
          if (contextNote) {
            const note = contextNote;
            setContextNote(null);
            Alert.alert(
              'Excluir cartão',
              'Tem certeza que quer excluir este cartão? Esta ação não pode ser desfeita.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Excluir',
                  style: 'destructive',
                  onPress: async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    await deleteNote(note.id);
                  },
                },
              ],
            );
          }
        }}
        isCompleted={contextNote?.completed ?? false}
      />

      <ProfileMenu
        visible={profileMenuVisible}
        onClose={() => setProfileMenuVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  colorAccent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 8,
  },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  accentText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  empty: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
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
