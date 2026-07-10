import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '@/hooks/useColors';

interface ContextMenuProps {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onToggleCompleted: () => void;
  onDelete: () => void;
  isCompleted: boolean;
}

export function ContextMenu({
  visible,
  onClose,
  onEdit,
  onToggleCompleted,
  onDelete,
  isCompleted,
}: ContextMenuProps) {
  const colors = useColors();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

  useEffect(() => {
    if (visible) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 400,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleAction = (action: () => void) => {
    onClose();
    setTimeout(action, 150);
  };

  const backdropOpacity = backdropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.45],
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Pressable onPress={onClose} style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: '#000' }]} />
      </Pressable>

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.handle} />

        <MenuItem
          icon="edit-2"
          label="Editar"
          color={colors.foreground}
          onPress={() => handleAction(onEdit)}
        />

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <MenuItem
          icon={isCompleted ? 'x-circle' : 'check-circle'}
          label={isCompleted ? 'Marcar como pendente' : 'Marcar como concluída'}
          color={isCompleted ? colors.mutedForeground : colors.success}
          onPress={() => handleAction(onToggleCompleted)}
        />

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <MenuItem
          icon="trash-2"
          label="Excluir"
          color={colors.destructive}
          onPress={() => setConfirmDeleteVisible(true)}
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

      {confirmDeleteVisible ? (
        <View style={styles.confirmOverlay}>
          <Pressable style={styles.confirmOverlay} onPress={() => setConfirmDeleteVisible(false)}>
            <View style={[styles.confirmBox, { backgroundColor: colors.card }]}> 
              <Text style={[styles.confirmTitle, { color: colors.foreground }]}>Excluir cartão</Text>
              <Text style={[styles.confirmMessage, { color: colors.mutedForeground }]}>Tem certeza que deseja excluir este cartão?</Text>
              <View style={styles.confirmActions}>
                <Pressable
                  onPress={() => setConfirmDeleteVisible(false)}
                  style={({ pressed }) => [styles.confirmButton, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.confirmButtonText, { color: colors.foreground }]}>Cancelar</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setConfirmDeleteVisible(false);
                    onClose();
                    onDelete();
                  }}
                  style={({ pressed }) => [styles.confirmButton, styles.confirmDeleteButton, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text style={[styles.confirmDeleteText]}>Excluir</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </View>
      ) : null}
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
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
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
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D1D6',
    alignSelf: 'center',
    marginBottom: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  menuLabel: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmBox: {
    width: '85%',
    borderRadius: 20,
    padding: 20,
    gap: 18,
  },
  confirmTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
  },
  confirmMessage: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  confirmButtonText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  confirmDeleteButton: {
    backgroundColor: '#D93025',
  },
  confirmDeleteText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
