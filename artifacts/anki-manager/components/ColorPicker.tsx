import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { DECK_COLORS } from '@/constants/colors';

interface ColorPickerProps {
  selected: string;
  onSelect: (color: string) => void;
}

export function ColorPicker({ selected, onSelect }: ColorPickerProps) {
  return (
    <View style={styles.grid}>
      {DECK_COLORS.map((color) => (
        <Pressable
          key={color}
          onPress={() => onSelect(color)}
          style={({ pressed }) => [
            styles.swatch,
            { backgroundColor: color, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          {selected === color && (
            <Feather name="check" size={16} color="#FFFFFF" />
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
