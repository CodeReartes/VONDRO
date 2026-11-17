import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  signInWithPopup,
  signInWithCredential,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { auth, googleProvider, facebookProvider, appleProvider } from './firebase';
import { saveUserToFirestore, getUserFromFirestore } from './firestoreService';
import { UserAccount } from '../types';

let socialLoginInitialized = false;

export const ADMIN_EMAILS = [
  'reartes17diego@gmail.com'
];

export const checkIsAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase().trim());
};

const isVerifiedAdminUser = (firebaseUser: User | null | undefined): boolean => {
  if (!firebaseUser) return false;
  return Boolean(checkIsAdminEmail(firebaseUser.email) && firebaseUser.emailVerified);
};

// Register user with email and password (always customer role; email verification sent)
export const registerWithEmail = async (
  email: string,
  password: string,
  fullName: string,
  phone: string = '',
  dni: string = ''
): Promise<UserAccount> => {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    const err: any = new Error('Ingresá un correo electrónico válido.');
    err.code = 'auth/invalid-email';
    throw err;
  }
  if (!password || password.length < 6) {
    const err: any = new Error('La contraseña debe tener al menos 6 caracteres.');
    err.code = 'auth/weak-password';
    throw err;
  }
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);

  if (fullName) {
    await updateProfile(cred.user, { displayName: fullName }).catch(() => {});
  }

  // Send verification email so account email can be verified securely
  await sendEmailVerification(cred.user).catch(() => {});

  const cleanDni = (dni || '').trim();
  const newUser: UserAccount = {
    id: cred.user.uid,
    email: cred.user.email || cleanEmail,
    name: fullName || 'Usuario VONDRO',
    phone: phone || '',
    dni: cleanDni || undefined,
    isVerified: Boolean(cred.user.emailVerified || (cleanDni && cleanDni.length >= 7)),
    role: 'customer',
    addresses: [],
    favorites: [],
    createdAt: new Date().toISOString()
  };

  await saveUserToFirestore(newUser);
  return newUser;
};

// Sign in with email and password via Firebase Auth only
export const loginWithEmail = async (email: string, password: string): Promise<UserAccount> => {
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    const err: any = new Error('Ingresá un correo electrónico válido.');
    err.code = 'auth/invalid-email';
    throw err;
  }
  if (!password) {
    const err: any = new Error('Ingresá tu contraseña.');
    err.code = 'auth/missing-password';
    throw err;
  }
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
  const firebaseUser = cred.user;
  const uid = firebaseUser.uid;
  const isVerifiedAdmin = isVerifiedAdminUser(firebaseUser);

  let userAccount = await getUserFromFirestore(uid);

  if (!userAccount) {
    userAccount = {
      id: uid,
      email: firebaseUser.email || cleanEmail,
      name: firebaseUser.displayName || 'Usuario VONDRO',
      phone: firebaseUser.phoneNumber || '',
      photoUrl: firebaseUser.photoURL || undefined,
      isVerified: firebaseUser.emailVerified,
      role: isVerifiedAdmin ? 'admin' : 'customer',
      addresses: [],
      favorites: [],
      createdAt: new Date().toISOString()
    };
    await saveUserToFirestore(userAccount);
  } else if (isVerifiedAdmin && userAccount.role !== 'admin') {
    userAccount.role = 'admin';
    await saveUserToFirestore(userAccount);
  } else if (!checkIsAdminEmail(firebaseUser.email) && userAccount.role === 'admin') {
    userAccount.role = 'customer';
  }

  return userAccount;
};

// Sign in with Google (native Credential Manager on Capacitor Android/iOS, popup on Web)
export const loginWithGoogle = async (): Promise<UserAccount> => {
  let firebaseUser: User;

  if (Capacitor.isNativePlatform()) {
    const webClientId = (
      (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_GOOGLE_WEB_CLIENT_ID) ||
      ''
    ).trim();

    if (!webClientId) {
      const cfgErr: any = new Error(
        'Falta configurar VITE_GOOGLE_WEB_CLIENT_ID para habilitar el acceso nativo con Google.'
      );
      cfgErr.code = 'auth/native-google-not-configured';
      throw cfgErr;
    }

    if (!socialLoginInitialized) {
      await SocialLogin.initialize({
        google: {
          webClientId,
          mode: 'online',
        },
      });
      socialLoginInitialized = true;
    }

    const socialResponse = await SocialLogin.login({
      provider: 'google',
      options: {
        scopes: ['email', 'profile'],
      },
    });

    const googleResult = socialResponse?.result as { idToken?: string | null } | undefined;
    const idToken = googleResult?.idToken;
    if (!idToken) {
      const tokenErr: any = new Error('Google no devolvió un token de identidad válido.');
      tokenErr.code = 'auth/missing-google-id-token';
      throw tokenErr;
    }

    const credential = GoogleAuthProvider.credential(idToken);
    const credResult = await signInWithCredential(auth, credential);
    firebaseUser = credResult.user;
  } else {
    const result = await signInWithPopup(auth, googleProvider);
    firebaseUser = result.user;
  }

  const user = firebaseUser;
  const isVerifiedAdmin = isVerifiedAdminUser(user);

  let userAccount = await getUserFromFirestore(user.uid);
  if (!userAccount) {
    userAccount = {
      id: user.uid,
      email: user.email || '',
      name: user.displayName || 'Usuario Google',
      phone: user.phoneNumber || '',
      photoUrl: user.photoURL || undefined,
      isVerified: user.emailVerified,
      role: isVerifiedAdmin ? 'admin' : 'customer',
      addresses: [],
      favorites: [],
      createdAt: new Date().toISOString()
    };
    await saveUserToFirestore(userAccount);
  } else {
    let dirty = false;
    if (user.photoURL && !userAccount.photoUrl) {
      userAccount.photoUrl = user.photoURL;
      dirty = true;
    }
    if (isVerifiedAdmin && userAccount.role !== 'admin') {
      userAccount.role = 'admin';
      dirty = true;
    }
    if (dirty) {
      await saveUserToFirestore(userAccount);
    }
  }

  return userAccount;
};

// Sign in with Facebook
export const loginWithFacebook = async (): Promise<UserAccount> => {
  const result = await signInWithPopup(auth, facebookProvider);
  const user = result.user;
  const isVerifiedAdmin = isVerifiedAdminUser(user);

  let userAccount = await getUserFromFirestore(user.uid);
  if (!userAccount) {
    userAccount = {
      id: user.uid,
      email: user.email || '',
      name: user.displayName || 'Usuario Facebook',
      phone: user.phoneNumber || '',
      photoUrl: user.photoURL || undefined,
      isVerified: user.emailVerified,
      role: isVerifiedAdmin ? 'admin' : 'customer',
      addresses: [],
      favorites: [],
      createdAt: new Date().toISOString()
    };
    await saveUserToFirestore(userAccount);
  } else if (user.photoURL && !userAccount.photoUrl) {
    userAccount.photoUrl = user.photoURL;
    await saveUserToFirestore(userAccount);
  }

  return userAccount;
};

// Sign in with Apple
export const loginWithApple = async (): Promise<UserAccount> => {
  const result = await signInWithPopup(auth, appleProvider);
  const user = result.user;
  const isVerifiedAdmin = isVerifiedAdminUser(user);

  let userAccount = await getUserFromFirestore(user.uid);
  if (!userAccount) {
    userAccount = {
      id: user.uid,
      email: user.email || '',
      name: user.displayName || 'Usuario Apple',
      phone: user.phoneNumber || '',
      photoUrl: user.photoURL || undefined,
      isVerified: user.emailVerified,
      role: isVerifiedAdmin ? 'admin' : 'customer',
      addresses: [],
      favorites: [],
      createdAt: new Date().toISOString()
    };
    await saveUserToFirestore(userAccount);
  } else if (user.photoURL && !userAccount.photoUrl) {
    userAccount.photoUrl = user.photoURL;
    await saveUserToFirestore(userAccount);
  }

  return userAccount;
};

// Sign out
export const logOutUser = async () => {
  await firebaseSignOut(auth);
};

// Send password reset
export const resetPassword = async (email: string) => {
  await sendPasswordResetEmail(auth, email.toLowerCase().trim());
};

// Listen to auth state
export const subscribeToAuth = (callback: (user: UserAccount | null) => void) => {
  return onAuthStateChanged(auth, async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }

    try {
      const isVerifiedAdmin = isVerifiedAdminUser(firebaseUser);
      let profile = await getUserFromFirestore(firebaseUser.uid);
      if (!profile) {
        profile = {
          id: firebaseUser.uid,
          email: firebaseUser.email || '',
          name: firebaseUser.displayName || 'Usuario VONDRO',
          phone: firebaseUser.phoneNumber || '',
          photoUrl: firebaseUser.photoURL || undefined,
          isVerified: firebaseUser.emailVerified,
          role: isVerifiedAdmin ? 'admin' : 'customer',
          addresses: [],
          favorites: [],
          createdAt: new Date().toISOString()
        };
        await saveUserToFirestore(profile);
      } else {
        if (firebaseUser.photoURL && !profile.photoUrl) {
          profile.photoUrl = firebaseUser.photoURL;
          await saveUserToFirestore(profile);
        }
        if (isVerifiedAdmin && profile.role !== 'admin') {
          profile.role = 'admin';
        }
      }
      callback(profile);
    } catch (err) {
      console.warn('Error fetching user profile:', err);
      callback(null);
    }
  });
};
