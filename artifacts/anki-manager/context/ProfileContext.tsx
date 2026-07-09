import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Profile {
  id: string;
  name: string;
  color: string;
  initials: string;
}

export const PROFILES: Profile[] = [
  { id: 'andre', name: 'André', color: '#3B82F6', initials: 'AN' },
  { id: 'agnis', name: 'Agnis', color: '#EC4899', initials: 'AG' },
];

interface ProfileContextType {
  activeProfile: Profile;
  setActiveProfile: (profile: Profile) => void;
}

const ProfileContext = createContext<ProfileContextType | null>(null);
const PROFILE_KEY = '@active_profile_id';

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [activeProfile, setActiveProfileState] = useState<Profile>(PROFILES[0]);

  useEffect(() => {
    AsyncStorage.getItem(PROFILE_KEY).then((id) => {
      if (id) {
        const found = PROFILES.find((p) => p.id === id);
        if (found) setActiveProfileState(found);
      }
    });
  }, []);

  const setActiveProfile = (profile: Profile) => {
    setActiveProfileState(profile);
    AsyncStorage.setItem(PROFILE_KEY, profile.id);
  };

  return (
    <ProfileContext.Provider value={{ activeProfile, setActiveProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}
