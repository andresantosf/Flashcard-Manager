import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { Deck } from '@/context/StorageContext';

interface DeckCardProps {
  deck: Deck;
  cardCount: number;
  onPress: () => void;
  onLongPress?: () => void;
}

export function DeckCard({ deck, cardCount, onPress, onLongPress }: DeckCardProps) {
  const colors = useColors();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View
        style={[styles.colorBar, { backgroundColor: deck.color }]}
      />
      <View style={styles.content}>
        <Text
          style={[styles.name, { color: colors.foreground }]}
          numberOfLines={1}
        >
          {deck.name}
        </Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {cardCount} {cardCount === 1 ? 'cartão' : 'cartões'}
        </Text>
      </View>
      <View style={styles.chevron}>
        <Text style={[styles.chevronText, { color: colors.mutedForeground }]}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  colorBar: {
    width: 5,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  name: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 3,
  },
  count: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  chevron: {
    paddingRight: 16,
  },
  chevronText: {
    fontSize: 22,
    lineHeight: 26,
  },
});
