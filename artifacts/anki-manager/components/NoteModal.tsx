import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
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
import * as ImagePicker from 'expo-image-picker';
import { deleteField } from 'firebase/firestore';
import { useColors } from '@/hooks/useColors';
import { useStorage, type Note } from '@/context/StorageContext';
import { useProfile } from '@/context/ProfileContext';
import uploadImage from '@/lib/imgbb';

interface NoteModalProps {
  visible: boolean;
  onClose: () => void;
  /** Pre-selected deck when creating inside a deck screen */
  deckId?: string;
  noteToEdit?: Note;
}

export function NoteModal({ visible, onClose, deckId, noteToEdit }: NoteModalProps) {
  const colors = useColors();
  const { createNote, updateNote, decks } = useStorage();
  const { activeProfile } = useProfile();

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageChanged, setImageChanged] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const slideAnim = useRef(new Animated.Value(600)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const backInputRef = useRef<TextInput>(null);

  const isEdit = !!noteToEdit;
  const [saving, setSaving] = useState(false);
  // Show deck picker when creating without a deck context, or always when editing
  const showDeckPicker = (!deckId || isEdit) && decks.length > 0;

  useEffect(() => {
    if (visible) {
      setFront(noteToEdit?.front ?? '');
      setBack(noteToEdit?.back ?? '');
      setImageUrl(noteToEdit?.imageUrl ?? null);
      setImageChanged(false);
      setSelectedDeckId(noteToEdit?.deckId ?? deckId ?? decks[0]?.id ?? '');
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 600, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleSave = async () => {
    const f = front.trim();
    const b = back.trim();
    if (!f || !b) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaving(true);
    try {
      if (isEdit && noteToEdit) {
        const updates: Partial<Note> = { front: f, back: b };
        if (selectedDeckId && selectedDeckId !== noteToEdit.deckId) {
          updates.deckId = selectedDeckId;
        }

        if (imageChanged) {
          if (imageUrl) {
            try {
              if (!imageUrl.startsWith('http')) {
                updates.imageUrl = await uploadImage(imageUrl);
              } else {
                updates.imageUrl = imageUrl;
              }
            } catch (err) {
              // log and surface error to user
              // eslint-disable-next-line no-console
              console.error('uploadImage failed during edit', err);
              Alert.alert('Erro', 'Não foi possível enviar a imagem. Tente novamente.');
            }
          } else {
            updates.imageUrl = undefined;
          }
        }

        await updateNote(noteToEdit.id, updates);
      } else {
        const targetDeckId = deckId ?? selectedDeckId;
        if (!targetDeckId) return;
        try {
          await createNote(targetDeckId, f, b, activeProfile, imageUrl ?? undefined);
        } catch (err) {
          // creation failed — show error
          // eslint-disable-next-line no-console
          console.error('createNote failed', err);
          Alert.alert('Erro', 'Não foi possível criar o cartão. Tente novamente.');
          return;
        }
      }
      onClose();
    } catch (err) {
      // generic catch
      // eslint-disable-next-line no-console
      console.error('handleSave error', err);
      Alert.alert('Erro', 'Ocorreu um erro ao salvar o cartão.');
    } finally {
      setSaving(false);
    }
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
        <Pressable
          onPress={() => { Keyboard.dismiss(); onClose(); }}
          style={StyleSheet.absoluteFill}
        >
          <Animated.View
            style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: '#000' }]}
          />
        </Pressable>

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.handle} />

          <Text style={[styles.title, { color: colors.foreground }]}>
            {isEdit ? 'Editar Cartão' : 'Nova Nota'}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Deck picker */}
            {showDeckPicker && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                  BARALHO
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.deckPicker}
                >
                  {decks.map((d) => {
                    const selected = selectedDeckId === d.id;
                    return (
                      <Pressable
                        key={d.id}
                        onPress={() => setSelectedDeckId(d.id)}
                        style={[
                          styles.deckChip,
                          {
                            backgroundColor: selected ? d.color + '22' : colors.secondary,
                            borderColor: selected ? d.color : 'transparent',
                          },
                        ]}
                      >
                        <View style={[styles.deckChipDot, { backgroundColor: d.color }]} />
                        <Text
                          style={[
                            styles.deckChipText,
                            { color: selected ? d.color : colors.foreground },
                          ]}
                        >
                          {d.name}
                        </Text>
                      </Pressable>
                    );
                  })}
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

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>IMAGEM</Text>
            {imageUrl ? (
              <View style={styles.imagePreviewWrapper}>
                <Image source={{ uri: imageUrl }} style={styles.imagePreview} />
                <Pressable
                  onPress={() => {
                    setImageUrl(null);
                    setImageChanged(true);
                  }}
                  style={({ pressed }) => [
                    styles.imageButton,
                    {
                      backgroundColor: colors.secondary,
                      opacity: pressed ? 0.75 : 1,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.imageButtonText, { color: colors.foreground }]}>Remover imagem</Text>
                </Pressable>
              </View>
            ) : null}

            <Pressable
              onPress={async () => {
                const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (!permission.granted) {
                  Alert.alert(
                    'Permissão necessária',
                    'Permita o acesso às imagens para anexar fotos ao cartão.',
                  );
                  return;
                }

                const result = await ImagePicker.launchImageLibraryAsync({
                  mediaTypes: ImagePicker.MediaTypeOptions.Images,
                  quality: 0.7,
                  allowsEditing: false,
                });

                if (result.canceled || result.assets.length === 0) return;
                setImageUrl(result.assets[0].uri);
                setImageChanged(true);
              }}
              style={({ pressed }) => [
                styles.imageButton,
                {
                  backgroundColor: colors.secondary,
                  opacity: pressed ? 0.75 : 1,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.imageButtonText, { color: colors.foreground }]}>Selecionar imagem</Text>
            </Pressable>
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
              onPress={() => { if (!saving) handleSave(); }}
              style={({ pressed }) => [
                styles.btnPrimary,
                { backgroundColor: colors.primary, opacity: pressed || saving ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}> 
                {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Adicionar'}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
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
  deckPicker: { marginBottom: 20 },
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
  deckChipDot: { width: 8, height: 8, borderRadius: 4 },
  deckChipText: { fontSize: 14, fontFamily: 'Inter_500Medium' },
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
  imagePreviewWrapper: {
    marginBottom: 16,
  },
  imagePreview: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    marginBottom: 10,
    backgroundColor: '#000',
  },
  imageButton: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  imageButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
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
  btnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
