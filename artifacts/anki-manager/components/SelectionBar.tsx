import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';

interface SelectionBarProps {
  count: number;
  onCancel: () => void;
  onMenu: () => void;
  topInset: number;
}

/**
 * Contextual top bar that replaces the normal screen header while
 * selection mode is active — "← N cartões selecionados ⋮", matching the
 * Google Photos / Gmail / Files pattern.
 */
export function SelectionBar({ count, onCancel, onMenu, topInset }: SelectionBarProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.card,
          borderBottomColor: colors.border,
          paddingTop: topInset + 10,
        },
      ]}
    >
      <Pressable
        onPress={onCancel}
        style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Feather name="x" size={22} color={colors.foreground} />
      </Pressable>

      <Text style={[styles.count, { color: colors.foreground }]} numberOfLines={1}>
        {count} {count === 1 ? 'cartão selecionado' : 'cartões selecionados'}
      </Text>

      <Pressable
        onPress={onMenu}
        style={({ pressed }) => [styles.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Feather name="more-vertical" size={22} color={colors.foreground} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 19,
  },
  count: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 4,
  },
});
