import React, { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useStorage, type Note, NO_DECK_ID, NO_DECK } from '@/context/StorageContext';
import { useProfile, PROFILES } from '@/context/ProfileContext';
import { NoteModal } from '@/components/NoteModal';
import { ContextMenu } from '@/components/ContextMenu';
import { ProfileMenu, ProfileAvatar } from '@/components/ProfileMenu';

const PAGE_SIZE = 20;

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface FeedItemProps {
  note: Note;
  deckName: string;
  deckColor: string;
  onPress: () => void;
  onLongPress?: () => void;
}

function renderBackText(text: string, color: string, baseStyle: object) {
  const tipIndex = text.indexOf('💡');

  if (tipIndex === -1) {
    return (
      <Text style={[baseStyle, { color }]}> 
        {text}
      </Text>
    );
  }

  const beforeTip = text.substring(0, tipIndex);
  const afterTip = text.substring(tipIndex);

  return (
    <Text style={[baseStyle, { color }]}> 
      {beforeTip && <Text>{beforeTip}</Text>}
      <Text style={[baseStyle, { color: '#000', fontStyle: 'italic' }]}>{afterTip}</Text>
    </Text>
  );
}

function FeedItem({ note, deckName, deckColor, onPress, onLongPress }: FeedItemProps) {
  const colors = useColors();
  const wasLongPressed = React.useRef(false);
  const [imageVisible, setImageVisible] = useState(false);
  return (
    <>
      <Pressable
        onPress={() => {
          if (wasLongPressed.current) {
            wasLongPressed.current = false;
            return;
          }
          onPress();
        }}
        onLongPress={() => {
          wasLongPressed.current = true;
          if (onLongPress) onLongPress();
        }}
        delayLongPress={400}
        style={({ pressed }) => [
          styles.item,
          {
            backgroundColor: note.completed ? colors.muted : colors.card,
            opacity: pressed ? 0.8 : 1,
            borderLeftColor: note.completed ? colors.border : deckColor,
          },
        ]}
      >
        {/* Author + deck + date row */}
        <View style={styles.itemHeader}>
          {/* Author avatar */}
          {note.authorInitials && note.authorColor ? (
            <ProfileAvatar
              photo={PROFILES.find((p) => p.id === note.authorId)?.photo}
              initials={note.authorInitials}
              color={note.authorColor}
              size={26}
            />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: colors.border }]}> 
              <Feather name="user" size={12} color={colors.mutedForeground} />
            </View>
          )}

          {/* Author name */}
          <Text
            style={[
              styles.authorName,
              { color: note.authorColor ?? colors.mutedForeground },
            ]}
            numberOfLines={1}
          >
            {note.authorName ?? '—'}
          </Text>

          {/* Deck badge */}
          <View style={styles.deckBadge}>
            <View style={[styles.deckDot, { backgroundColor: deckColor }]} />
            <Text style={[styles.deckName, { color: deckColor }]} numberOfLines={1}>
              {deckName}
            </Text>
          </View>

          {note.completed && (
            <Feather name="check-circle" size={13} color={colors.mutedForeground} />
          )}
        </View>

        {/* Date */}
        <Text style={[styles.dateText, { color: colors.mutedForeground }]}> 
          {formatDateTime(note.createdAt)}
        </Text>

        {/* Front */}
        <Text
          style={[
            styles.front,
            { color: colors.foreground },
          ]}
        >
          {note.front}
        </Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Back */}
        {renderBackText(note.back, colors.mutedForeground, styles.back)}

        {note.imageUrl ? (
          <Pressable onPress={() => setImageVisible(true)} style={styles.feedImageWrapper}>
            <Image source={{ uri: note.imageUrl }} style={styles.feedImage} />
          </Pressable>
        ) : null}
      </Pressable>

      {note.imageUrl ? (
        <Modal visible={imageVisible} transparent animationType="fade">
          <Pressable style={styles.modalOverlay} onPress={() => setImageVisible(false)}>
            <View style={styles.modalContent}>
              <Pressable
                onPress={() => setImageVisible(false)}
                style={({ pressed }) => [styles.closeButton, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="x" size={24} color="#fff" />
              </Pressable>
              <Image source={{ uri: note.imageUrl }} style={styles.modalImage} resizeMode="contain" />
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

export default function UpdatesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { notes, decks, toggleNoteCompleted, deleteNote } = useStorage();
  const [contextNote, setContextNote] = useState<Note | null>(null);
  const { activeProfile } = useProfile();

  const [page, setPage] = useState(1);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');

  const deckMap = useMemo(() => {
    const m: Record<string, { name: string; color: string }> = {};
    // Always include the virtual "Sem baralho" entry
    m[NO_DECK_ID] = { name: NO_DECK.name, color: NO_DECK.color };
    decks.forEach((d) => { m[d.id] = { name: d.name, color: d.color }; });
    return m;
  }, [decks]);

  const hasNoDeckNotes = useMemo(
    () => notes.some((n) => n.deckId === NO_DECK_ID),
    [notes],
  );

  const filteredNotes = useMemo(() => {
    if (selectedDeckId === 'all') return notes;
    return notes.filter((note) => note.deckId === selectedDeckId);
  }, [notes, selectedDeckId]);

  const sorted = useMemo(
    () => [...filteredNotes].sort((a, b) => {
      if (a.completed === b.completed) {
        return b.createdAt.localeCompare(a.createdAt);
      }
      return a.completed ? 1 : -1;
    }),
    [filteredNotes],
  );

  const visible = useMemo(() => sorted.slice(0, page * PAGE_SIZE), [sorted, page]);

  const loadMore = useCallback(() => {
    if (visible.length < sorted.length) setPage((p) => p + 1);
  }, [visible.length, sorted.length]);

  const topPad = insets.top + (Platform.OS === 'web' ? 67 : 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Atualizações
            </Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {notes.length} {notes.length === 1 ? 'cartão' : 'cartões'} no total
            </Text>
          </View>

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

      <View style={styles.deckFilterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.deckFilterScroll}
        >
          <Pressable
            onPress={() => setSelectedDeckId('all')}
            style={({ pressed }) => [
              styles.deckChip,
              {
                backgroundColor:
                  selectedDeckId === 'all' ? colors.primary + '22' : colors.secondary,
                borderColor: selectedDeckId === 'all' ? colors.primary : 'transparent',
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text
              style={[
                styles.deckChipText,
                { color: selectedDeckId === 'all' ? colors.primary : colors.foreground },
              ]}
            >
              Todos
            </Text>
          </Pressable>

          {decks.map((deck) => {
            const selected = selectedDeckId === deck.id;
            return (
              <Pressable
                key={deck.id}
                onPress={() => setSelectedDeckId(deck.id)}
                style={({ pressed }) => [
                  styles.deckChip,
                  {
                    backgroundColor: selected ? deck.color + '22' : colors.secondary,
                    borderColor: selected ? deck.color : 'transparent',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <View style={[styles.deckChipDot, { backgroundColor: deck.color }]} />
                <Text
                  style={[
                    styles.deckChipText,
                    { color: selected ? deck.color : colors.foreground },
                  ]}
                >
                  {deck.name}
                </Text>
              </Pressable>
            );
          })}

          {/* "Sem baralho" chip — visible only when such notes exist */}
          {hasNoDeckNotes && (() => {
            const selected = selectedDeckId === NO_DECK_ID;
            return (
              <Pressable
                key={NO_DECK_ID}
                onPress={() => setSelectedDeckId(NO_DECK_ID)}
                style={({ pressed }) => [
                  styles.deckChip,
                  {
                    backgroundColor: selected ? NO_DECK.color + '22' : colors.secondary,
                    borderColor: selected ? NO_DECK.color : 'transparent',
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Feather
                  name="inbox"
                  size={11}
                  color={selected ? NO_DECK.color : colors.mutedForeground}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.deckChipText,
                    { color: selected ? NO_DECK.color : colors.foreground },
                  ]}
                >
                  {NO_DECK.name}
                </Text>
              </Pressable>
            );
          })()}
        </ScrollView>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 32 + (insets.bottom || 0) },
        ]}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyIcon, { color: colors.border }]}>◎</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Nenhum cartão ainda
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Crie baralhos e cartões para vê-los aqui
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const deck = deckMap[item.deckId];
          return (
            <FeedItem
              note={item}
              deckName={deck?.name ?? 'Baralho removido'}
              deckColor={deck?.color ?? colors.mutedForeground}
              onPress={() => setEditNote(item)}
              onLongPress={() => setContextNote(item)}
            />
          );
        }}
        ListFooterComponent={
          visible.length < sorted.length ? (
            <Text style={[styles.loadingMore, { color: colors.mutedForeground }]}>
              Carregando mais…
            </Text>
          ) : null
        }
      />

      <NoteModal
        visible={!!editNote}
        onClose={() => setEditNote(null)}
        noteToEdit={editNote ?? undefined}
      />

      <ContextMenu
        visible={!!contextNote && !editNote}
        onClose={() => setContextNote(null)}
        onEdit={() => {
          setEditNote(contextNote);
          setContextNote(null);
        }}
        onToggleCompleted={async () => {
          if (contextNote) {
            await toggleNoteCompleted(contextNote.id);
            setContextNote(null);
          }
        }}
        onDelete={async () => {
          if (contextNote) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await deleteNote(contextNote.id);
            setContextNote(null);
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
  avatarBtn: { marginTop: 4 },
  list: { paddingHorizontal: 16, paddingTop: 8 },
  deckFilterContainer: { paddingHorizontal: 16, marginBottom: 12 },
  deckFilterScroll: { paddingBottom: 12 },
  deckChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1.5,
  },
  deckChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deckChipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  item: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'nowrap',
  },
  avatarFallback: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    flexShrink: 1,
    maxWidth: 70,
  },
  deckBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  deckDot: { width: 7, height: 7, borderRadius: 3.5, flexShrink: 0 },
  deckName: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    flexShrink: 1,
  },
  dateText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginBottom: 8,
  },
  front: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 22,
  },
  strikethrough: { textDecorationLine: 'line-through' },
  divider: { height: 1, marginVertical: 10 },
  back: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  feedImageWrapper: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  feedImage: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    backgroundColor: '#000',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '75%',
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  modalImage: {
    width: '100%',
    height: '100%',
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
  loadingMore: {
    textAlign: 'center',
    paddingVertical: 16,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
});
