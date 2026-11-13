import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import type { ChatMessage } from '../integrations/gemini';

export interface Conversation {
  id: string;
  title: string;
  courseId?: string;
  materialIds?: string[];
  createdAt: string;
  updatedAt: string;
}

const LOCAL_CONVERSATIONS_KEY = 'uni-erp-conversations-meta';
const LOCAL_MESSAGES_PREFIX = 'uni-erp-conv-msgs-';

/**
 * Carrega a lista de conversas guardadas (do Firestore se autenticado, ou do localStorage).
 */
export async function getConversations(): Promise<Conversation[]> {
  const user = auth.currentUser;
  if (!user) {
    try {
      const raw = localStorage.getItem(LOCAL_CONVERSATIONS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  const colRef = collection(db, 'users', user.uid, 'conversations');
  const q = query(colRef, orderBy('updatedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Conversation));
}

/**
 * Escuta em tempo real as conversas do utilizador no Firestore.
 */
export function subscribeConversations(callback: (list: Conversation[]) => void): () => void {
  const user = auth.currentUser;
  if (!user) {
    getConversations().then(callback);
    return () => {};
  }

  const colRef = collection(db, 'users', user.uid, 'conversations');
  const q = query(colRef, orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Conversation));
    list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    callback(list);
  });
}

/**
 * Cria ou atualiza uma conversa.
 */
export async function upsertConversation(conv: Conversation): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    const list = await getConversations();
    const existingIdx = list.findIndex((c) => c.id === conv.id);
    const updated = existingIdx >= 0 ? list.map((c) => (c.id === conv.id ? conv : c)) : [conv, ...list];
    localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(updated));
    return;
  }

  const docRef = doc(db, 'users', user.uid, 'conversations', conv.id);
  await setDoc(docRef, conv, { merge: true });
}

/**
 * Apaga uma conversa e as suas mensagens.
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    const list = await getConversations();
    const filtered = list.filter((c) => c.id !== conversationId);
    localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(filtered));
    localStorage.removeItem(`${LOCAL_MESSAGES_PREFIX}${conversationId}`);
    return;
  }

  const docRef = doc(db, 'users', user.uid, 'conversations', conversationId);
  await deleteDoc(docRef);
}

/**
 * Escuta as mensagens de uma conversa específica em tempo real.
 */
export function subscribeMessages(
  conversationId: string,
  callback: (messages: ChatMessage[]) => void,
): () => void {
  const user = auth.currentUser;
  if (!user) {
    try {
      const raw = localStorage.getItem(`${LOCAL_MESSAGES_PREFIX}${conversationId}`);
      callback(raw ? JSON.parse(raw) : []);
    } catch {
      callback([]);
    }
    return () => {};
  }

  const msgsRef = collection(db, 'users', user.uid, 'conversations', conversationId, 'messages');
  const q = query(msgsRef, orderBy('at', 'asc'));
  return onSnapshot(q, (snap) => {
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage));
    callback(list);
  });
}

/**
 * Grava uma mensagem na conversa e atualiza o timestamp da conversa.
 */
export async function appendMessage(
  conversationId: string,
  message: ChatMessage,
): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    try {
      const raw = localStorage.getItem(`${LOCAL_MESSAGES_PREFIX}${conversationId}`);
      const list: ChatMessage[] = raw ? JSON.parse(raw) : [];
      const updated = [...list, message];
      localStorage.setItem(`${LOCAL_MESSAGES_PREFIX}${conversationId}`, JSON.stringify(updated));
    } catch {
      // storage quota
    }
    return;
  }

  const msgRef = doc(db, 'users', user.uid, 'conversations', conversationId, 'messages', message.id);
  await setDoc(msgRef, message);

  // Atualiza conversa
  const convRef = doc(db, 'users', user.uid, 'conversations', conversationId);
  await setDoc(convRef, { updatedAt: message.at }, { merge: true });
}
