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
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';

const config = window.MATA_FIREBASE_CONFIG || {};
const requiredConfig = ['apiKey', 'authDomain', 'projectId', 'appId'];
const configured = requiredConfig.every((key) => {
  const value = config[key];
  return typeof value === 'string' && value.trim() && !/REPLACE_|YOUR_PROJECT_ID/i.test(value);
});

let auth = null;
let db = null;
let initializationError = null;

if (configured) {
  try {
    const app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
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

function requireVerifiedUser() {
  const user = requireAuth().currentUser;
  if (!user) {
    const error = new Error('Sign in required');
    error.code = 'auth/unauthenticated';
    throw error;
  }
  if (!user.emailVerified) {
    const error = new Error('Verified email required');
    error.code = 'auth/email-not-verified';
    throw error;
  }
  return user;
}

function requireDatabase() {
  if (db) return db;
  const error = new Error('Firebase configuration required');
  error.code = 'auth/configuration-required';
  throw error;
}

function conversationId(listingId, participantUids) {
  const participants = [...new Set(participantUids)].sort();
  return `${encodeURIComponent(listingId)}_${participants.join('_')}`;
}

window.mataData = {
  configured: !!db,
  watchAds(callback, onError) {
    const adsQuery = query(collection(requireDatabase(), 'ads'), orderBy('createdAt', 'desc'), limit(100));
    return onSnapshot(adsQuery, (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data(), remote: true })));
    }, onError);
  },
  async publishAd(ad) {
    const user = requireVerifiedUser();
    const safeAd = {
      type: String(ad.type || '').slice(0, 40),
      name: String(ad.name || '').slice(0, 120),
      meta: String(ad.meta || '').slice(0, 180),
      price: String(ad.price || '').slice(0, 40),
      priceValue: Number(ad.priceValue) || 0,
      currency: ad.currency === 'RON' ? 'RON' : 'EUR',
      county: String(ad.county || '').slice(0, 80),
      city: String(ad.city || '').slice(0, 100),
      brand: String(ad.brand || '').slice(0, 80),
      icon: String(ad.icon || '🏍️').slice(0, 8),
      description: String(ad.description || '').slice(0, 4000),
      ownerUid: user.uid,
      createdAt: serverTimestamp()
    };
    return addDoc(collection(requireDatabase(), 'ads'), safeAd);
  },
  watchConversations(uid, callback, onError) {
    const conversationsQuery = query(
      collection(requireDatabase(), 'conversations'),
      where('participantUids', 'array-contains', uid),
      orderBy('lastMessageAt', 'desc'),
      limit(50)
    );
    return onSnapshot(conversationsQuery, (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, onError);
  },
  watchMessages(id, callback, onError) {
    const messagesQuery = query(
      collection(doc(requireDatabase(), 'conversations', id), 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );
    return onSnapshot(messagesQuery, (snapshot) => {
      callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    }, onError);
  },
  async sendMessage(ad, text) {
    const user = requireVerifiedUser();
    const message = String(text || '').trim();
    if (!message || message.length > 2000) throw new Error('Mesajul trebuie să aibă între 1 și 2000 de caractere.');
    if (!ad.ownerUid || ad.ownerUid === user.uid) throw new Error('Nu poți trimite un mesaj către propriul anunț.');
    const participants = [user.uid, ad.ownerUid].sort();
    const id = conversationId(ad.id, participants);
    const database = requireDatabase();
    const conversationRef = doc(database, 'conversations', id);
    const messageRef = doc(collection(conversationRef, 'messages'));
    const batch = writeBatch(database);
    batch.set(conversationRef, {
      listingId: ad.id,
      listingName: String(ad.name || '').slice(0, 120),
      ownerUid: ad.ownerUid,
      participantUids: participants,
      lastMessage: message.slice(0, 240),
      lastMessageAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    batch.set(messageRef, {
      senderUid: user.uid,
      text: message,
      createdAt: serverTimestamp()
    });
    await batch.commit();
    return id;
  },
  conversationId
};

document.dispatchEvent(new Event('mata-data-ready'));
