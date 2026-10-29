import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const config = window.MATA_SUPABASE_CONFIG || {};
const configured = typeof config.url === 'string'
  && /^https:\/\//.test(config.url)
  && typeof config.anonKey === 'string'
  && config.anonKey.length > 30
  && !/REPLACE_|YOUR_SUPABASE/i.test(config.anonKey + config.url);

let supabase = null;
let currentUser = null;
let initializationError = null;

if (configured) {
  try {
    supabase = createClient(config.url.replace(/\/$/, ''), config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    const dispatchUser = (user) => {
      currentUser = user ? {
        uid: user.id,
        email: user.email || '',
        emailVerified: !!user.email_confirmed_at,
        emailConfirmedAt: user.email_confirmed_at || null
      } : null;
      document.dispatchEvent(new CustomEvent('mata-auth-state', { detail: currentUser }));
    };
    supabase.auth.onAuthStateChange((event, session) => {
      dispatchUser(session?.user || null);
      if (event === 'PASSWORD_RECOVERY') document.dispatchEvent(new Event('mata-password-recovery'));
    });
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    dispatchUser(data.session?.user || null);
  } catch (error) {
    initializationError = error;
    console.error('Supabase nu s-a putut inițializa.', error);
    supabase = null;
  }
}

function requireClient() {
  if (supabase) return supabase;
  const error = new Error(initializationError ? 'Supabase initialization failed' : 'Supabase config missing');
  error.code = initializationError ? 'auth/network-request-failed' : 'auth/configuration-required';
  throw error;
}

function requireVerifiedUser() {
  if (!currentUser) {
    const error = new Error('Trebuie să te conectezi mai întâi.');
    error.code = 'auth/unauthenticated';
    throw error;
  }
  if (!currentUser.emailVerified) {
    const error = new Error('Confirmă adresa de email înainte să continui.');
    error.code = 'auth/email-not-verified';
    throw error;
  }
  return currentUser;
}

function requireDatabase() {
  if (supabase) return supabase;
  const error = new Error('Completează supabase-config.js.');
  error.code = 'auth/configuration-required';
  throw error;
}

async function unwrapAuth(promise) {
  const result = await promise;
  if (result.error) throw result.error;
  return result.data;
}

function mapAd(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    meta: row.meta,
    price: row.price,
    priceValue: Number(row.price_value) || 0,
    currency: row.currency || 'EUR',
    county: row.county || '',
    city: row.city || '',
    phone: row.phone || '',
    description: row.description || '',
    brand: row.brand || '',
    icon: row.icon || '🏍️',
    photos: row.photos || [],
    ownerUid: row.owner_id,
    createdAt: row.created_at,
    mine: row.owner_id === currentUser?.uid,
    remote: true,
    views: 0,
    saves: 0
  };
}

function mapConversation(row) {
  return {
    id: row.id,
    listingId: row.listing_id,
    listingName: row.ads?.name || 'Anunț MATA',
    ownerUid: row.owner_id,
    buyerUid: row.buyer_id,
    lastMessage: row.last_message || '',
    lastMessageAt: row.last_message_at
  };
}

function mapMessage(row) {
  return { id: row.id, senderUid: row.sender_id, text: row.body, createdAt: row.created_at };
}

function reportError(error, onError) {
  if (error) {
    console.error('Eroare Supabase:', error);
    onError?.(error);
  }
}

async function loadAds(callback, onError, active = () => true) {
  const { data, error } = await requireDatabase()
    .from('ads').select('*').order('created_at', { ascending: false }).limit(100);
  if (error) return reportError(error, onError);
  if (active()) callback((data || []).map(mapAd));
}

async function loadConversations(uid, callback, onError, active = () => true) {
  const { data, error } = await requireDatabase()
    .from('conversations')
    .select('id,listing_id,buyer_id,owner_id,last_message,last_message_at,ads(name)')
    .or(`buyer_id.eq.${uid},owner_id.eq.${uid}`)
    .order('last_message_at', { ascending: false })
    .limit(50);
  if (error) return reportError(error, onError);
  if (active()) callback((data || []).map(mapConversation));
}

async function loadMessages(id, callback, onError, active = () => true) {
  const { data, error } = await requireDatabase()
    .from('messages').select('id,sender_id,body,created_at')
    .eq('conversation_id', id).order('created_at', { ascending: true }).limit(200);
  if (error) return reportError(error, onError);
  if (active()) callback((data || []).map(mapMessage));
}

window.mataAuth = {
  configured: configured && !!supabase,
  signIn(email, password) {
    return unwrapAuth(requireClient().auth.signInWithPassword({ email, password }));
  },
  signUp(email, password) {
    return unwrapAuth(requireClient().auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}${location.pathname}` }
    }));
  },
  resetPassword(email) {
    return unwrapAuth(requireClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}${location.pathname}`
    }));
  },
  resendConfirmation(email) {
    return unwrapAuth(requireClient().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${location.origin}${location.pathname}` }
    }));
  },
  async updatePassword(password) {
    const { data, error } = await requireClient().auth.updateUser({ password });
    if (error) throw error;
    return data.user;
  },
  async sendVerification() {
    const user = currentUser;
    if (!user?.email) throw new Error('Nu există un cont conectat.');
    return unwrapAuth(requireClient().auth.resend({
      type: 'signup',
      email: user.email,
      options: { emailRedirectTo: `${location.origin}${location.pathname}` }
    }));
  },
  async signOut() {
    const { error } = await requireClient().auth.signOut();
    if (error) throw error;
  }
};

window.mataData = {
  configured: !!supabase,
  watchAds(callback, onError) {
    let active = true;
    const client = requireDatabase();
    const channel = client.channel('mata-public-ads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ads' }, () => {
        loadAds(callback, onError, () => active);
      }).subscribe();
    loadAds(callback, onError, () => active);
    return () => { active = false; client.removeChannel(channel); };
  },
  async publishAd(ad) {
    const user = requireVerifiedUser();
    const client = requireDatabase();
    const uploaded = [];
    const files = ad.photoFiles || [];
    if (files.length > 5) throw new Error('Poți încărca maximum 5 fotografii.');
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
          throw new Error('Fiecare fotografie trebuie să fie o imagine de maximum 5 MB.');
        }
        const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
        const path = `${user.uid}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await client.storage.from('mata-ad-photos').upload(path, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false
        });
        if (uploadError) throw uploadError;
        uploaded.push(path);
      }
      const photos = uploaded.map((path) => client.storage.from('mata-ad-photos').getPublicUrl(path).data.publicUrl);
      const { data, error } = await client.from('ads').insert({
        owner_id: user.uid,
        type: String(ad.type || '').slice(0, 40),
        name: String(ad.name || '').slice(0, 120),
        meta: String(ad.meta || '').slice(0, 180),
        price: String(ad.price || '').slice(0, 40),
        price_value: Number(ad.priceValue) || 0,
        currency: ad.currency === 'RON' ? 'RON' : 'EUR',
        county: String(ad.county || '').slice(0, 80),
        city: String(ad.city || '').slice(0, 100),
        phone: String(ad.phone || '').slice(0, 40),
        brand: String(ad.brand || '').slice(0, 80),
        icon: String(ad.icon || '🏍️').slice(0, 8),
        description: String(ad.description || '').slice(0, 4000),
        photos
      }).select().single();
      if (error) throw error;
      return mapAd(data);
    } catch (error) {
      if (uploaded.length) await client.storage.from('mata-ad-photos').remove(uploaded);
      throw error;
    }
  },
  watchConversations(uid, callback, onError) {
    let active = true;
    const client = requireDatabase();
    const channel = client.channel(`mata-conversations-${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        loadConversations(uid, callback, onError, () => active);
      }).subscribe();
    loadConversations(uid, callback, onError, () => active);
    return () => { active = false; client.removeChannel(channel); };
  },
  watchMessages(id, callback, onError) {
    let active = true;
    const client = requireDatabase();
    const channel = client.channel(`mata-messages-${id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}`
      }, () => loadMessages(id, callback, onError, () => active)).subscribe();
    loadMessages(id, callback, onError, () => active);
    return () => { active = false; client.removeChannel(channel); };
  },
  async sendMessage(ad, text) {
    const user = requireVerifiedUser();
    const message = String(text || '').trim();
    if (!message || message.length > 2000) throw new Error('Mesajul trebuie să aibă între 1 și 2000 de caractere.');
    const isOwner = ad.ownerUid === user.uid;
    const buyerId = isOwner ? ad.buyerUid : user.uid;
    if (!ad.ownerUid || !buyerId || (!isOwner && ad.ownerUid === user.uid)) {
      throw new Error('Conversația nu este validă pentru acest cont.');
    }
    const client = requireDatabase();
    let { data: conversation, error } = await client.from('conversations')
      .select('id').eq('listing_id', ad.id).eq('buyer_id', buyerId).maybeSingle();
    if (error) throw error;
    if (!conversation) {
      const result = await client.from('conversations').insert({
        listing_id: ad.id,
        buyer_id: buyerId,
        owner_id: ad.ownerUid
      }).select('id').single();
      if (result.error?.code === '23505') {
        const retry = await client.from('conversations')
          .select('id').eq('listing_id', ad.id).eq('buyer_id', buyerId).single();
        if (retry.error) throw retry.error;
        conversation = retry.data;
      } else if (result.error) throw result.error;
      else conversation = result.data;
    }
    const { error: messageError } = await client.from('messages').insert({
      conversation_id: conversation.id,
      sender_id: user.uid,
      body: message
    });
    if (messageError) throw messageError;
    return conversation.id;
  }
};

document.dispatchEvent(new Event('mata-data-ready'));
