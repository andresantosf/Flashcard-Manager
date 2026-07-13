import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';
import { NO_DECK, type Deck } from '@/context/StorageContext';

interface DeckPickerSheetProps {
  visible: boolean;
  decks: Deck[];
  onClose: () => void;
  onSelectDeck: (deckId: string) => void;
}

/**
 * Bottom sheet listing every deck (plus the virtual "Sem baralho") so the
 * user can pick a destination — used by the bulk "Alterar baralho" action.
 */
export function DeckPickerSheet({ visible, decks, onClose, onSelectDeck }: DeckPickerSheetProps) {
  const colors = useColors();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleSelect = (deckId: string) => {
    onClose();
    setTimeout(() => onSelectDeck(deckId), 150);
  };

  const backdropOpacity = backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });

  const allDecks: Deck[] = [NO_DECK, ...decks];

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Pressable onPress={onClose} style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: '#000' }]} />
      </Pressable>

      <Animated.View
        style={[styles.sheet, { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.handle} />
        <Text style={[styles.title, { color: colors.foreground }]}>Mover para qual baralho?</Text>

        {allDecks.map((deck) => (
          <Pressable
            key={deck.id}
            onPress={() => handleSelect(deck.id)}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
          >
            {deck.id === NO_DECK.id ? (
              <Feather name="inbox" size={16} color={deck.color} style={styles.rowIcon} />
            ) : (
              <View style={[styles.dot, { backgroundColor: deck.color }]} />
            )}
            <Text style={[styles.rowLabel, { color: colors.foreground }]} numberOfLines={1}>
              {deck.name}
            </Text>
          </Pressable>
        ))}

        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.cancelBtn,
            { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[styles.cancelText, { color: colors.foreground }]}>Cancelar</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    maxHeight: '75%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  rowIcon: { width: 10, textAlign: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter_500Medium' },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
