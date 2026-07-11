import React, { useRef, useState } from 'react';
import {
  Image,
  Modal,
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

function renderBackText(text: string, color: string, baseStyle: object) {
  const normalized = text.trim();
  const hasTip = normalized.startsWith('💡');

  if (!hasTip) {
    return (
      <Text style={[baseStyle, { color }]} numberOfLines={2}>
        {text}
      </Text>
    );
  }

  const content = normalized.replace(/^💡\s*/, '');

  return (
    <Text style={[baseStyle, { color }]} numberOfLines={2}>
      <Text style={[baseStyle, { color: '#ffff7f', fontStyle: 'italic' }]}>💡 </Text>
      <Text style={[baseStyle, { color: '#ffff7f', fontStyle: 'italic' }]}>{content}</Text>
    </Text>
  );
}

export function NoteCard({ note, onPress, onLongPress }: NoteCardProps) {
  const colors = useColors();
  const wasLongPressed = useRef(false);
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
        onLongPress();
      }}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          opacity: pressed ? 0.8 : 1,
          borderWidth: note.completed ? 2 : 0,
          borderColor: note.completed ? colors.success : 'transparent',
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
        ]}
        numberOfLines={2}
      >
        {note.front}
      </Text>

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      {/* Back */}
      {renderBackText(note.back, colors.mutedForeground, styles.back)}

      {note.imageUrl ? (
        <Pressable onPress={() => setImageVisible(true)} style={styles.imageWrapper}>
          <Image source={{ uri: note.imageUrl }} style={styles.noteImage} />
        </Pressable>
      ) : null}
    </Pressable>

    {note.imageUrl ? (
      <Modal visible={imageVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setImageVisible(false)}>
          <View style={styles.modalContent}>
            <Pressable
              onPress={() => setImageVisible(false)}
              style={({ pressed }) => [
                styles.closeButton,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="x" size={24} color="#fff" />
            </Pressable>
            <Image source={{ uri: note.imageUrl }} style={styles.modalImage} resizeMode="contain" />
          </View>
        </Pressable>
      </Modal>
    ) : null}
  </>);
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
  imageWrapper: {
    borderRadius: 16,
    overflow: 'hidden',
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
  noteImage: {
    marginTop: 12,
    width: '100%',
    height: 160,
    borderRadius: 16,
    backgroundColor: '#000',
  },
});
