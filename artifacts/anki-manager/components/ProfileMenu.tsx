import React, { useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import { PROFILES, useProfile, type Profile } from '@/context/ProfileContext';

interface ProfileMenuProps {
  visible: boolean;
  onClose: () => void;
}

export function ProfileMenu({ visible, onClose }: ProfileMenuProps) {
  const colors = useColors();
  const { activeProfile, setActiveProfile } = useProfile();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 10 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleSelect = (profile: Profile) => {
    setActiveProfile(profile);
    onClose();
  };

  const backdropOpacity = backdropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <View style={styles.root}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill}>
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
          <Text style={[styles.title, { color: colors.foreground }]}>Perfil ativo</Text>

          {PROFILES.map((profile) => {
            const isActive = activeProfile.id === profile.id;
            return (
              <Pressable
                key={profile.id}
                onPress={() => handleSelect(profile)}
                style={({ pressed }) => [
                  styles.profileRow,
                  {
                    backgroundColor: isActive
                      ? profile.color + '15'
                      : pressed
                      ? colors.secondary
                      : 'transparent',
                    borderColor: isActive ? profile.color + '40' : 'transparent',
                  },
                ]}
              >
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: profile.color }]}>
                  <Text style={styles.avatarText}>{profile.initials}</Text>
                </View>

                {/* Name */}
                <Text
                  style={[
                    styles.profileName,
                    { color: isActive ? profile.color : colors.foreground },
                  ]}
                >
                  {profile.name}
                </Text>

                {/* Active indicator */}
                {isActive && (
                  <Feather name="check" size={18} color={profile.color} />
                )}
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </Modal>
  );
}

/** Compact avatar circle — reusable anywhere */
export function ProfileAvatar({
  initials,
  color,
  size = 34,
}: {
  initials: string;
  color: string;
  size?: number;
}) {
  return (
    <View
      style={[
        styles.avatar,
        { backgroundColor: color, width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.32 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 48,
    paddingTop: 16,
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
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  profileName: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
  },
});
