import Constants from 'expo-constants';
import { initializeApp, getApps } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import googleServices from '../google-services.json';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, string | undefined>;
const projectInfo = googleServices.project_info ?? {};
const googleClient = googleServices.client?.[0];
const googleApiKey = googleClient?.api_key?.[0]?.current_key;
const googleAppId = googleClient?.client_info?.mobilesdk_app_id;
const googleProjectId = projectInfo.project_id;
const googleStorageBucket = projectInfo.storage_bucket;
const googleMessagingSenderId = projectInfo.project_number;
const googleAuthDomain = googleProjectId ? `${googleProjectId}.firebaseapp.com` : undefined;

const firebaseConfig = {
  apiKey:
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? extra.firebaseApiKey ?? googleApiKey,
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? extra.firebaseAuthDomain ?? googleAuthDomain,
  projectId:
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? extra.firebaseProjectId ?? googleProjectId,
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? extra.firebaseStorageBucket ?? googleStorageBucket,
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? extra.firebaseMessagingSenderId ?? googleMessagingSenderId,
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? extra.firebaseAppId ?? googleAppId,
};

const missingKeys = Object.entries(firebaseConfig)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingKeys.length > 0) {
  throw new Error(
    `Firebase config inválido: faltando ${missingKeys.join(", ")}. ` +
      "Defina as variáveis de ambiente EXPO_PUBLIC_FIREBASE_* ou use expo.extra/ google-services.json.",
  );
}

// Avoid re-initializing on hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// experimentalForceLongPolling is required for React Native (no WebSocket support in Firestore)
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export { db };
