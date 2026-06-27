import { useState, useEffect } from 'react';
import axios from 'axios';
import { getOfflineActions, removeOfflineAction, addOfflineAction } from '../utils/db';

export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncErrors, setSyncErrors] = useState([]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check in case we start online with pending syncs
    if (navigator.onLine) {
       triggerSync();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const triggerSync = async () => {
    if (isSyncing || !navigator.onLine) return;
    
    const actions = await getOfflineActions();
    if (actions.length === 0) return;

    setIsSyncing(true);
    setSyncErrors([]);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('http://localhost:5000/api/sync', { actions }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        // Remove successfully synced items
        for (const res of response.data.results) {
          if (res.success) {
            await removeOfflineAction(res.tempId);
          } else {
            console.error('Failed to sync action:', res.error);
            setSyncErrors(prev => [...prev, { tempId: res.tempId, error: res.error }]);
          }
        }
      }
    } catch (err) {
      console.error('Global Sync Error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  const queueAction = async (actionType, payload) => {
    if (navigator.onLine) {
      // If online, we can still queue it and sync immediately, 
      // or just send the direct API request depending on architecture.
      // For a true offline-first, queue it then sync.
      await addOfflineAction({ type: actionType, payload });
      triggerSync();
    } else {
      await addOfflineAction({ type: actionType, payload });
    }
  };

  return { isOnline, isSyncing, queueAction, triggerSync, syncErrors };
};
