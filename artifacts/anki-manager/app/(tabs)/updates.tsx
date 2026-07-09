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
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { useStorage, type Note } from '@/context/StorageContext';
import { useProfile, PROFILES } from '@/context/ProfileContext';
import { NoteModal } from '@/components/NoteModal';
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
}

function FeedItem({ note, deckName, deckColor, onPress }: FeedItemProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.item,
        {
          backgroundColor: colors.card,
          opacity: pressed ? 0.8 : 1,
          borderLeftColor: deckColor,
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
          <Feather name="check-circle" size={13} color={colors.success} />
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
          note.completed && styles.strikethrough,
        ]}
        numberOfLines={2}
      >
        {note.front}
      </Text>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Back */}
      <Text style={[styles.back, { color: colors.mutedForeground }]} numberOfLines={2}>
        {note.back}
      </Text>
    </Pressable>
  );
}

export default function UpdatesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { notes, decks } = useStorage();
  const { activeProfile } = useProfile();

  const [page, setPage] = useState(1);
  const [editNote, setEditNote] = useState<Note | null>(null);
  const [profileMenuVisible, setProfileMenuVisible] = useState(false);

  const deckMap = useMemo(() => {
    const m: Record<string, { name: string; color: string }> = {};
    decks.forEach((d) => { m[d.id] = { name: d.name, color: d.color }; });
    return m;
  }, [decks]);

  const sorted = useMemo(
    () => [...notes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [notes],
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
