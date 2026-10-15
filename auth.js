import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';

const config = window.MATA_FIREBASE_CONFIG || {};
const requiredConfig = ['apiKey', 'authDomain', 'projectId', 'appId'];
const configured = requiredConfig.every((key) => {
  const value = config[key];
  return typeof value === 'string' && value.trim() && !/REPLACE_|YOUR_PROJECT_ID/i.test(value);
});

let auth = null;
let initializationError = null;

if (configured) {
  try {
    const app = initializeApp(config);
    auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    onAuthStateChanged(auth, (user) => {
      document.dispatchEvent(new CustomEvent('mata-auth-state', { detail: user }));
    });
  } catch (error) {
    initializationError = error;
    console.error('Firebase Authentication nu s-a putut inițializa.', error);
  }
}

function requireAuth() {
  if (auth) return auth;
  const error = new Error(initializationError ? 'Firebase initialization failed' : 'Firebase config missing');
  error.code = initializationError ? 'auth/network-request-failed' : 'auth/configuration-required';
  throw error;
}

window.mataAuth = {
  configured: configured && !!auth,
  signIn(email, password) {
    return signInWithEmailAndPassword(requireAuth(), email, password);
  },
  async signUp(email, password) {
    const credential = await createUserWithEmailAndPassword(requireAuth(), email, password);
    await sendEmailVerification(credential.user);
    return credential.user;
  },
  resetPassword(email) {
    return sendPasswordResetEmail(requireAuth(), email);
  },
  sendVerification() {
    const user = requireAuth().currentUser;
    if (!user) throw new Error('No signed-in user');
    return sendEmailVerification(user);
  },
  signOut() {
    return signOut(requireAuth());
  }
};
