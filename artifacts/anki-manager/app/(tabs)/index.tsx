import React, { useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useStorage } from '@/context/StorageContext';
import { DeckCard } from '@/components/DeckCard';
import { SpeedDial } from '@/components/SpeedDial';
import { DeckModal } from '@/components/DeckModal';
import { NoteModal } from '@/components/NoteModal';

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { decks, getNotesByDeck } = useStorage();

  const [deckModalVisible, setDeckModalVisible] = useState(false);
  const [noteModalVisible, setNoteModalVisible] = useState(false);

  const topPad =
    insets.top + (Platform.OS === 'web' ? 67 : 0);

  const speedDialOptions = [
    {
      label: 'Novo Baralho',
      icon: 'layers' as const,
      onPress: () => setDeckModalVisible(true),
    },
    {
      label: 'Nova Nota',
      icon: 'file-plus' as const,
      onPress: () => setNoteModalVisible(true),
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>
          Meus Baralhos
        </Text>
        <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
          {decks.length} {decks.length === 1 ? 'baralho' : 'baralhos'}
        </Text>
      </View>

      {/* Deck list */}
      <FlatList
        data={decks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: 120 + (insets.bottom || 0) },
        ]}
        scrollEnabled={decks.length > 0}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyIcon, { color: colors.border }]}>▤</Text>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Nenhum baralho ainda
            </Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
              Toque no + para criar seu primeiro baralho
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <DeckCard
            deck={item}
            cardCount={getNotesByDeck(item.id).length}
            onPress={() => router.push(`/deck/${item.id}`)}
          />
        )}
      />

      <SpeedDial options={speedDialOptions} />

      <DeckModal
        visible={deckModalVisible}
        onClose={() => setDeckModalVisible(false)}
      />
      <NoteModal
        visible={noteModalVisible}
        onClose={() => setNoteModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 16,
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
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  empty: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
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
