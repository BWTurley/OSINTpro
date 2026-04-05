import { useEffect, useRef, useCallback, useState } from 'react';
import { useSubscription } from '@apollo/client';
import { SUBSCRIBE_JOB_UPDATES } from '@/graphql/queries/collection';
import { useCollectionStore } from '@/stores/collectionStore';
import { useUIStore } from '@/stores/uiStore';
import type { CollectionJob } from '@/types';

interface JobUpdatePayload {
  id: string;
  status: string;
  progress: number;
  resultCount: number;
  error: string | null;
  completedAt: string | null;
}

export function useJobSubscription(jobId?: string) {
  const { updateJob } = useCollectionStore();
  const { addNotification } = useUIStore();

  const { data, loading, error } = useSubscription(SUBSCRIBE_JOB_UPDATES, {
    variables: { jobId },
    onData: ({ data: subData }) => {
      const update = subData.data?.jobUpdated as JobUpdatePayload | undefined;
      if (update) {
        updateJob(update as Partial<CollectionJob> & { id: string });

        if (update.status === 'completed') {
          addNotification({
            type: 'success',
            title: 'Collection Complete',
            message: `Job ${update.id} finished with ${update.resultCount} results`,
          });
        } else if (update.status === 'failed') {
          addNotification({
            type: 'error',
            title: 'Collection Failed',
            message: update.error ?? `Job ${update.id} failed`,
          });
        }
      }
    },
  });

  return { data: data?.jobUpdated as JobUpdatePayload | undefined, loading, error };
}

// Generic WebSocket hook for custom endpoints
export function useWebSocket(url: string, options?: { autoConnect?: boolean }) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = localStorage.getItem('auth_token');
    const wsUrl = token ? `${url}?token=${token}` : url;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      setLastMessage(event.data as string);
    };

    ws.onclose = () => {
      setIsConnected(false);
      // Auto-reconnect after 3s
      reconnectRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };

    wsRef.current = ws;
  }, [url]);

  const disconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
    }
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data);
    }
  }, []);

  useEffect(() => {
    if (options?.autoConnect !== false) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [connect, disconnect, options?.autoConnect]);

  return { isConnected, lastMessage, connect, disconnect, send };
}
