import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { useStorage, type Note } from '@/context/StorageContext';

interface NoteModalProps {
  visible: boolean;
  onClose: () => void;
  deckId?: string;
  noteToEdit?: Note;
}

export function NoteModal({ visible, onClose, deckId, noteToEdit }: NoteModalProps) {
  const colors = useColors();
  const { createNote, updateNote, decks } = useStorage();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const slideAnim = useRef(new Animated.Value(600)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const backInputRef = useRef<TextInput>(null);

  const isEdit = !!noteToEdit;
  const needsDeckPicker = !deckId && !isEdit;

  useEffect(() => {
    if (visible) {
      setFront(noteToEdit?.front ?? '');
      setBack(noteToEdit?.back ?? '');
      setSelectedDeckId(deckId ?? noteToEdit?.deckId ?? decks[0]?.id ?? '');
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 70,
          friction: 10,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 600,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleSave = async () => {
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) return;
    const targetDeckId = deckId ?? selectedDeckId;
    if (!targetDeckId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isEdit && noteToEdit) {
      await updateNote(noteToEdit.id, { front: f, back: b });
    } else {
      await createNote(targetDeckId, f, b);
    }
    onClose();
  };

  const backdropOpacity = backdropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable onPress={() => { Keyboard.dismiss(); onClose(); }} style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: '#000' }]} />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.handle} />

          <Text style={[styles.title, { color: colors.foreground }]}>
            {isEdit ? 'Editar Nota' : 'Nova Nota'}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {needsDeckPicker && decks.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  BARALHO
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.deckPicker}
                >
                  {decks.map((d) => (
                    <Pressable
                      key={d.id}
                      onPress={() => setSelectedDeckId(d.id)}
                      style={[
                        styles.deckChip,
                        {
                          backgroundColor:
                            selectedDeckId === d.id ? colors.primary : colors.secondary,
                          borderLeftColor: d.color,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.deckChipText,
                          {
                            color:
                              selectedDeckId === d.id
                                ? colors.primaryForeground
                                : colors.foreground,
                          },
                        ]}
                      >
                        {d.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              FRENTE
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.secondary,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Pergunta ou termo..."
              placeholderTextColor={colors.mutedForeground}
              value={front}
              onChangeText={setFront}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => backInputRef.current?.focus()}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              VERSO
            </Text>
            <TextInput
              ref={backInputRef}
              style={[
                styles.input,
                {
                  backgroundColor: colors.secondary,
                  color: colors.foreground,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Resposta ou definição..."
              placeholderTextColor={colors.mutedForeground}
              value={back}
              onChangeText={setBack}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </ScrollView>

          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.btnSecondary,
                { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: colors.foreground }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                styles.btnPrimary,
                { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
                {isEdit ? 'Salvar' : 'Adicionar'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    maxHeight: '90%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  deckPicker: {
    marginBottom: 20,
  },
  deckChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderLeftWidth: 3,
  },
  deckChipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  input: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginBottom: 16,
    borderWidth: 1,
    minHeight: 80,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimary: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
});
