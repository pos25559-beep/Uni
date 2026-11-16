import { useEffect, useState } from 'react';
import type { ID } from '../types';
import {
  deleteUniAgent,
  getUniAgent,
  listUniAgents,
  putUniAgent,
  type UniAgentRecord,
} from './localDb';

type Listener = () => void;

const listeners = new Set<Listener>();

interface UniAgentCloudHandlers {
  sync: (agent: UniAgentRecord) => Promise<void>;
  remove: (courseId: ID) => Promise<void>;
}

let cloudHandlers: UniAgentCloudHandlers | null = null;

export function registerUniAgentCloudHandlers(handlers: UniAgentCloudHandlers): void {
  cloudHandlers = handlers;
}

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeUniAgents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyUniAgentsChanged(): void {
  emitChange();
}

export async function saveUniAgentLocal(agent: UniAgentRecord): Promise<UniAgentRecord> {
  const saved = await putUniAgent(agent);
  emitChange();
  return saved;
}

export async function saveUniAgent(agent: UniAgentRecord): Promise<UniAgentRecord> {
  const saved = await saveUniAgentLocal(agent);
  if (cloudHandlers) {
    void cloudHandlers.sync(saved).catch(() => {});
  }
  return saved;
}

export async function deleteUniAgentLocal(courseId: ID): Promise<void> {
  await deleteUniAgent(courseId);
  emitChange();
}

export async function removeUniAgent(courseId: ID): Promise<void> {
  await deleteUniAgentLocal(courseId);
  if (cloudHandlers) {
    void cloudHandlers.remove(courseId).catch(() => {});
  }
}

export async function applyRemoteUniAgents(remoteAgents: UniAgentRecord[]): Promise<void> {
  for (const remote of remoteAgents) {
    const local = await getUniAgent(remote.courseId);
    if (!local || remote.updatedAt >= local.updatedAt) {
      await putUniAgent(remote);
    }
  }
  emitChange();
}

/** Hook reativo que acompanha o Uni especialista de uma cadeira no IndexedDB. */
export function useUniAgent(courseId?: ID): {
  agent: UniAgentRecord | null;
  loading: boolean;
} {
  const [agent, setAgent] = useState<UniAgentRecord | null>(null);
  const [loading, setLoading] = useState(Boolean(courseId));

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    const refresh = () => {
      void getUniAgent(courseId).then((record) => {
        if (!active) return;
        setAgent(record);
        setLoading(false);
      });
    };
    refresh();
    const unsub = subscribeUniAgents(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, [courseId]);

  if (!courseId) {
    return { agent: null, loading: false };
  }

  return { agent, loading };
}

/** Hook reativo que lista todos os Unis especialistas adotados localmente. */
export function useUniAgents(): UniAgentRecord[] {
  const [agents, setAgents] = useState<UniAgentRecord[]>([]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      void listUniAgents().then((items) => {
        if (active) setAgents(items);
      });
    };
    refresh();
    const unsub = subscribeUniAgents(refresh);
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return agents;
}
