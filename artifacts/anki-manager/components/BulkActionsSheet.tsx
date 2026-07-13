import React, { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

interface BulkActionsSheetProps {
  visible: boolean;
  onClose: () => void;
  onChangeDeck: () => void;
  onMarkCompleted: () => void;
  onMarkNotCompleted: () => void;
  onDelete: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onInvertSelection: () => void;
}

/**
 * Bulk actions menu shown from the selection bar's "⋮" button:
 * Alterar baralho / Marcar como concluído / Marcar como não concluído /
 * Excluir cartões, plus the "seleção inteligente" shortcuts (selecionar
 * todos, limpar seleção, inverter seleção).
 */
export function BulkActionsSheet({
  visible,
  onClose,
  onChangeDeck,
  onMarkCompleted,
  onMarkNotCompleted,
  onDelete,
  onSelectAll,
  onClearSelection,
  onInvertSelection,
}: BulkActionsSheetProps) {
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

  const handleAction = (action: () => void) => {
    onClose();
    setTimeout(action, 150);
  };

  const backdropOpacity = backdropAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.45] });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Pressable onPress={onClose} style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: '#000' }]} />
      </Pressable>

      <Animated.View
        style={[styles.sheet, { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={styles.handle} />
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>AÇÕES EM MASSA</Text>

        <MenuItem
          icon="layers"
          label="Alterar baralho"
          color={colors.foreground}
          onPress={() => handleAction(onChangeDeck)}
        />
        <MenuItem
          icon="check-circle"
          label="Marcar como concluído"
          color={colors.success}
          onPress={() => handleAction(onMarkCompleted)}
        />
        <MenuItem
          icon="x-circle"
          label="Marcar como não concluído"
          color={colors.mutedForeground}
          onPress={() => handleAction(onMarkNotCompleted)}
        />
        <MenuItem
          icon="trash-2"
          label="Excluir cartões"
          color={colors.destructive}
          onPress={() => handleAction(onDelete)}
        />

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>SELEÇÃO INTELIGENTE</Text>

        <MenuItem
          icon="check-square"
          label="Selecionar todos os cartões da tela"
          color={colors.foreground}
          onPress={() => handleAction(onSelectAll)}
        />
        <MenuItem
          icon="square"
          label="Limpar seleção"
          color={colors.foreground}
          onPress={() => handleAction(onClearSelection)}
        />
        <MenuItem
          icon="refresh-cw"
          label="Inverter seleção"
          color={colors.foreground}
          onPress={() => handleAction(onInvertSelection)}
        />

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

function MenuItem({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Feather name={icon} size={20} color={color} />
      <Text style={[styles.menuLabel, { color }]}>{label}</Text>
    </Pressable>
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
    maxHeight: '85%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    alignSelf: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  menuLabel: { fontSize: 15, fontFamily: 'Inter_500Medium', flex: 1 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
});
