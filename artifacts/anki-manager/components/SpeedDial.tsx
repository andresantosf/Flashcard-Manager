import React, { useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export interface SpeedDialOption {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
}

interface SpeedDialProps {
  options: SpeedDialOption[];
}

export function SpeedDial({ options }: SpeedDialProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const animation = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const toValue = open ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      useNativeDriver: true,
      tension: 70,
      friction: 9,
    }).start();
    setOpen(!open);
  };

  const close = () => {
    if (!open) return;
    Animated.spring(animation, {
      toValue: 0,
      useNativeDriver: true,
      tension: 70,
      friction: 9,
    }).start();
    setOpen(false);
  };

  const rotation = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  const backdropOpacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.55],
  });

  const bottomOffset =
    (insets.bottom || 0) + 24 + (Platform.OS === 'web' ? 34 : 0);

  return (
    <>
      {/* Backdrop: outer View controls pointer events so nothing leaks to children */}
      <View
        pointerEvents={open ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { zIndex: 10 }]}
      >
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: backdropOpacity, backgroundColor: '#000' }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        </Animated.View>
      </View>

      {/* FAB container */}
      <View style={[styles.container, { bottom: bottomOffset }]}>
        {/* Options — stacked above FAB */}
        {options.map((option, index) => {
          const reverseIndex = options.length - 1 - index;
          const delay = reverseIndex * 0.08;

          const translateY = animation.interpolate({
            inputRange: [0, 1],
            outputRange: [10, 0],
          });
          const scale = animation.interpolate({
            inputRange: [0, delay, Math.min(delay + 0.5, 1), 1],
            outputRange: [0.6, 0.6, 1, 1],
          });
          const opacity = animation.interpolate({
            inputRange: [0, delay, Math.min(delay + 0.3, 1), 1],
            outputRange: [0, 0, 1, 1],
          });

          return (
            // Outer View controls pointer events so hidden options don't eat touches
            <View key={option.label} pointerEvents={open ? 'auto' : 'none'}>
              <Animated.View
                style={[
                  styles.optionRow,
                  { opacity, transform: [{ translateY }, { scale }] },
                ]}
              >
                <View
                  style={[
                    styles.labelPill,
                    { backgroundColor: 'rgba(28,28,30,0.88)' },
                  ]}
                >
                  <Text style={styles.labelText}>{option.label}</Text>
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.miniFab,
                    { backgroundColor: '#2C2C2E', opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => {
                    close();
                    setTimeout(option.onPress, 180);
                  }}
                >
                  <Feather name={option.icon} size={20} color="#FFFFFF" />
                </Pressable>
              </Animated.View>
            </View>
          );
        })}

        {/* Main FAB */}
        <Pressable
          onPress={toggle}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Feather name="plus" size={28} color={colors.primaryForeground} />
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 24,
    alignItems: 'flex-end',
    gap: 12,
    zIndex: 20,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  labelPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  labelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  miniFab: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  fab: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 8,
  },
});
