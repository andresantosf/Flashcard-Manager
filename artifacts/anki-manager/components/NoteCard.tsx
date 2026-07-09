import React, { useRef } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
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
  // Guard: prevent onPress from firing right after a long-press release
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
      {note.completed && (
        <View style={styles.completedBadge}>
          <Feather name="check-circle" size={14} color={colors.success} />
        </View>
      )}
      <Text style={[styles.date, { color: colors.mutedForeground }]}>
        {formatDate(note.createdAt)}
      </Text>
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
  completedBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  date: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
