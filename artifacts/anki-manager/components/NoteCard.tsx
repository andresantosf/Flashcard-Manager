import React, { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { ProfileAvatar } from '@/components/ProfileMenu';
import { PROFILES } from '@/context/ProfileContext';
import type { Note } from '@/context/StorageContext';

interface NoteCardProps {
  note: Note;
  onPress: () => void;
  onLongPress: () => void;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function NoteCard({ note, onPress, onLongPress }: NoteCardProps) {
  const colors = useColors();
  const wasLongPressed = useRef(false);

  return (
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
        onLongPress();
      }}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          opacity: note.completed ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {/* Author row */}
      <View style={styles.authorRow}>
        {note.authorInitials && note.authorColor ? (
          <ProfileAvatar
            photo={PROFILES.find((p) => p.id === note.authorId)?.photo}
            initials={note.authorInitials}
            color={note.authorColor}
            size={28}
          />
        ) : (
          <View style={[styles.authorAvatarFallback, { backgroundColor: colors.border }]}>
            <Feather name="user" size={13} color={colors.mutedForeground} />
          </View>
        )}
        <Text style={[styles.authorName, { color: note.authorColor ?? colors.mutedForeground }]}>
          {note.authorName ?? '—'}
        </Text>
        <Text style={[styles.date, { color: colors.mutedForeground }]}>
          {formatDate(note.createdAt)}
        </Text>
        {note.completed && (
          <Feather name="check-circle" size={14} color={colors.success} />
        )}
      </View>

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
      <Text
        style={[styles.back, { color: colors.mutedForeground }]}
        numberOfLines={2}
      >
        {note.back}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  authorAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  date: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  front: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 22,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
  divider: {
    height: 1,
    marginVertical: 10,
  },
  back: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
});
