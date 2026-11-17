import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, FacebookAuthProvider, OAuthProvider } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  setLogLevel
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import configJson from '../../firebase-applet-config.json';

// Safely obtain environment variables or fallback to firebase-applet-config.json
const env = (typeof import.meta !== 'undefined' && (import.meta as any).env) || {};

// Construct the Firebase configuration
export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || configJson.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || configJson.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || configJson.projectId,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || configJson.storageBucket,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || configJson.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID || configJson.appId,
};

// Initialize Firebase App singleton
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });
export const facebookProvider = new FacebookAuthProvider();
export const appleProvider = new OAuthProvider('apple.com');

// Initialize Firestore with custom database ID, offline persistence, and resilient settings
const customDbId = configJson.firestoreDatabaseId && configJson.firestoreDatabaseId !== '(default)'
  ? configJson.firestoreDatabaseId
  : undefined;

const isBrowser = typeof window !== 'undefined';

// Suppress internal WebChannel network latency/timeout warnings in iframe and preview environments
if (isBrowser) {
  try {
    setLogLevel('silent');
  } catch (_) {}
}

// Resilient Firestore configuration with automatic long polling fallback and persistent cache
const firestoreSettings = isBrowser
  ? {
      ignoreUndefinedProperties: true,
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    }
  : {
      ignoreUndefinedProperties: true
    };

let firestoreInstance: Firestore;
try {
  firestoreInstance = customDbId 
    ? initializeFirestore(app, firestoreSettings, customDbId)
    : initializeFirestore(app, firestoreSettings);
} catch {
  try {
    firestoreInstance = customDbId 
      ? initializeFirestore(app, isBrowser ? { ignoreUndefinedProperties: true, experimentalAutoDetectLongPolling: true, localCache: memoryLocalCache() } : { ignoreUndefinedProperties: true }, customDbId)
      : initializeFirestore(app, isBrowser ? { ignoreUndefinedProperties: true, experimentalAutoDetectLongPolling: true, localCache: memoryLocalCache() } : { ignoreUndefinedProperties: true });
  } catch {
    firestoreInstance = customDbId ? getFirestore(app, customDbId) : getFirestore(app);
  }
}

export const db = firestoreInstance;
export const storage = getStorage(app);

