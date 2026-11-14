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
import type { Course } from '../types';

export type ConversationSubject = 'geral' | 'duvidas' | 'resumos' | 'exame' | 'exercicios';

export const TUTOR_SUBJECTS: Array<{
  id: ConversationSubject;
  label: string;
  hint: string;
}> = [
  { id: 'geral', label: 'Geral', hint: 'Organização e perguntas abertas' },
  { id: 'duvidas', label: 'Dúvidas', hint: 'Explicações passo a passo' },
  { id: 'resumos', label: 'Resumos', hint: 'Sínteses, mapas e apontamentos' },
  { id: 'exame', label: 'Exame', hint: 'Simulações, recall e tópicos críticos' },
  { id: 'exercicios', label: 'Exercícios', hint: 'Resolução guiada de fichas' },
];

export interface Conversation {
  id: string;
  title: string;
  courseId?: string;
  subject?: string;
  materialIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export function subjectLabel(subject?: string): string {
  if (!subject) return 'Geral';
  const match = TUTOR_SUBJECTS.find((s) => s.id === subject);
  return match ? match.label : subject;
}

export interface ConversationGroup {
  key: string;
  label: string;
  items: Conversation[];
}

/** Agrupa conversas por Cadeira (quando associada) ou Assunto para navegação organizada. */
export function groupConversations(
  conversations: Conversation[],
  courses: Pick<Course, 'id' | 'name' | 'shortName'>[],
): ConversationGroup[] {
  const courseMap = new Map(courses.map((c) => [c.id, c.shortName || c.name]));
  const groups = new Map<string, ConversationGroup>();

  for (const conv of conversations) {
    const cLabel = conv.courseId ? courseMap.get(conv.courseId) : undefined;
    const sLabel = subjectLabel(conv.subject);
    const key = cLabel ? `course:${conv.courseId}` : `subj:${sLabel.toLowerCase()}`;
    const label = cLabel ? cLabel : `Assunto · ${sLabel}`;
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(conv);
    } else {
      groups.set(key, { key, label, items: [conv] });
    }
  }

  return Array.from(groups.values());
}

const LOCAL_CONVERSATIONS_KEY = 'uni-erp-conversations-meta';
const LOCAL_MESSAGES_PREFIX = 'uni-erp-conv-msgs-';

const localConvListeners = new Set<(list: Conversation[]) => void>();
const localMsgListeners = new Map<string, Set<(messages: ChatMessage[]) => void>>();

function readLocalConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(LOCAL_CONVERSATIONS_KEY);
    return raw ? (JSON.parse(raw) as Conversation[]) : [];
  } catch {
    return [];
  }
}

function readLocalMessages(conversationId: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_MESSAGES_PREFIX}${conversationId}`);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

function emitLocalConversations(list: Conversation[]) {
  for (const cb of localConvListeners) {
    cb(list);
  }
}

function emitLocalMessages(conversationId: string, messages: ChatMessage[]) {
  const listeners = localMsgListeners.get(conversationId);
  if (!listeners) return;
  for (const cb of listeners) {
    cb(messages);
  }
}

/**
 * Carrega a lista de conversas guardadas (do Firestore se autenticado, ou do localStorage).
 */
export async function getConversations(): Promise<Conversation[]> {
  const user = auth.currentUser;
  if (!user) {
    return readLocalConversations();
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
    localConvListeners.add(callback);
    callback(readLocalConversations());
    return () => {
      localConvListeners.delete(callback);
    };
  }

  const colRef = collection(db, 'users', user.uid, 'conversations');
  const q = query(colRef, orderBy('updatedAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Conversation));
      list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      callback(list);
    },
    (err) => {
      console.warn('[Conversations] Falha ao sincronizar conversas:', err.message);
    },
  );
}

/**
 * Cria ou atualiza uma conversa.
 */
export async function upsertConversation(conv: Conversation): Promise<void> {
  const cleanConv = Object.fromEntries(
    Object.entries(conv).filter(([, value]) => value !== undefined),
  ) as unknown as Conversation;

  const user = auth.currentUser;
  if (!user) {
    const list = readLocalConversations();
    const existingIdx = list.findIndex((c) => c.id === cleanConv.id);
    const updated =
      existingIdx >= 0
        ? list.map((c) => (c.id === cleanConv.id ? cleanConv : c))
        : [cleanConv, ...list];
    updated.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    try {
      localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(updated));
    } catch {
      // storage quota
    }
    emitLocalConversations(updated);
    return;
  }

  const docRef = doc(db, 'users', user.uid, 'conversations', cleanConv.id);
  await setDoc(docRef, cleanConv, { merge: true });
}

/**
 * Apaga uma conversa e as suas mensagens.
 */
export async function deleteConversation(conversationId: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    const filtered = readLocalConversations().filter((c) => c.id !== conversationId);
    try {
      localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(filtered));
      localStorage.removeItem(`${LOCAL_MESSAGES_PREFIX}${conversationId}`);
    } catch {
      // storage quota
    }
    emitLocalMessages(conversationId, []);
    emitLocalConversations(filtered);
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
    let set = localMsgListeners.get(conversationId);
    if (!set) {
      set = new Set();
      localMsgListeners.set(conversationId, set);
    }
    set.add(callback);
    callback(readLocalMessages(conversationId));
    return () => {
      const current = localMsgListeners.get(conversationId);
      current?.delete(callback);
      if (current && current.size === 0) {
        localMsgListeners.delete(conversationId);
      }
    };
  }

  const msgsRef = collection(db, 'users', user.uid, 'conversations', conversationId, 'messages');
  const q = query(msgsRef, orderBy('at', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage));
      callback(list);
    },
    (err) => {
      console.warn('[Conversations] Falha ao sincronizar mensagens:', err.message);
    },
  );
}

/**
 * Grava uma mensagem na conversa e atualiza o timestamp da conversa.
 */
export async function appendMessage(
  conversationId: string,
  message: ChatMessage,
): Promise<void> {
  const cleanMessage = Object.fromEntries(
    Object.entries(message).filter(([, value]) => value !== undefined),
  ) as unknown as ChatMessage;

  const user = auth.currentUser;
  if (!user) {
    const updated = [...readLocalMessages(conversationId), cleanMessage];
    try {
      localStorage.setItem(`${LOCAL_MESSAGES_PREFIX}${conversationId}`, JSON.stringify(updated));
    } catch {
      // storage quota
    }
    emitLocalMessages(conversationId, updated);
    const convs = readLocalConversations();
    if (convs.some((c) => c.id === conversationId)) {
      const updatedConvs = convs
        .map((c) => (c.id === conversationId ? { ...c, updatedAt: cleanMessage.at } : c))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      try {
        localStorage.setItem(LOCAL_CONVERSATIONS_KEY, JSON.stringify(updatedConvs));
      } catch {
        // storage quota
      }
      emitLocalConversations(updatedConvs);
    }
    return;
  }

  const msgRef = doc(db, 'users', user.uid, 'conversations', conversationId, 'messages', cleanMessage.id);
  await setDoc(msgRef, cleanMessage);

  // Atualiza conversa
  const convRef = doc(db, 'users', user.uid, 'conversations', conversationId);
  await setDoc(convRef, { updatedAt: cleanMessage.at }, { merge: true });
}
