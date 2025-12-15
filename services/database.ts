
const CACHE_PREFIX = 'adma_cache_v1_';

// --- INDEXED DB HELPER (Para grandes volumes de dados - Bíblia Offline & Metadados) ---
const DB_NAME = 'ADMA_BIBLE_DB';
const DB_VERSION = 3; 

const openBibleDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            // Store de Capítulos (Texto Bíblico)
            if (!db.objectStoreNames.contains('chapters')) {
                db.createObjectStore('chapters', { keyPath: 'key' });
            }
            // Store de Metadados (Títulos e Epígrafes)
            if (!db.objectStoreNames.contains('metadata')) {
                db.createObjectStore('metadata', { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const genericStorage = (storeName: string) => ({
    save: async (key: string, data: any) => {
        const db = await openBibleDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.put({ key, data }); 
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },
    get: async (key: string): Promise<any> => {
        const db = await openBibleDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result ? request.result.data : null);
            request.onerror = () => reject(request.error);
        });
    },
    count: async (): Promise<number> => {
        const db = await openBibleDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const request = store.count();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    clear: async (): Promise<void> => {
        const db = await openBibleDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
});

export const bibleStorage = genericStorage('chapters');
export const metaStorage = genericStorage('metadata');

// --- LOCAL STORAGE HELPER ---
const storage = {
    get: (key: string) => {
        try {
            const item = localStorage.getItem(CACHE_PREFIX + key);
            return item ? JSON.parse(item) : null;
        } catch (e) { return null; }
    },
    set: (key: string, data: any) => {
        try {
            localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(data));
        } catch (e) { console.error("Cache Full", e); }
    },
    remove: (key: string) => localStorage.removeItem(CACHE_PREFIX + key)
};

// Helper genérico para API
const apiCall = async (action: 'list' | 'save' | 'delete' | 'get', collection: string, payload: any = {}) => {
    try {
        const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, collection, ...payload })
        });

        if (!res.ok) throw new Error("Server Error");

        const data = await res.json();

        if (action === 'list') {
            storage.set(collection, data);
        }
        
        return data;
    } catch (e) {
        if (action === 'list') {
            const cached = storage.get(collection);
            return cached || [];
        }
        return null;
    }
};

export const db = {
  entities: {
    AppConfig: {
        get: async () => {
            const data = await apiCall('get', 'app_config', { id: 'global_config' });
            return data;
        },
        save: async (config: any) => {
            const item = { ...config, id: 'global_config' };
            return await apiCall('save', 'app_config', { item });
        }
    },
    DynamicModules: {
        list: async () => {
            return await apiCall('list', 'dynamic_modules') || [];
        },
        create: async (data: any) => {
            const newItem = { ...data, id: data.id || Date.now().toString() };
            await apiCall('save', 'dynamic_modules', { item: newItem });
            return newItem;
        },
        delete: async (id: string) => {
            await apiCall('delete', 'dynamic_modules', { id });
        }
    },
    BibleChapter: {
        // Busca local (Rápido)
        getOffline: async (chapterKey: string) => {
            return await bibleStorage.get(chapterKey);
        },
        // Salva local (Rápido)
        saveOffline: async (chapterKey: string, verses: string[]) => {
            return await bibleStorage.save(chapterKey, verses);
        },
        // Busca na Nuvem (Universal)
        getCloud: async (chapterKey: string) => {
            const data = await apiCall('get', 'bible_chapter', { id: chapterKey });
            if (data && data.verses) return data.verses;
            return null;
        },
        // Salva na Nuvem (Universal)
        saveCloud: async (chapterKey: string, verses: string[]) => {
            // Estrutura do objeto para salvar no Supabase
            const item = { id: chapterKey, verses: verses };
            return await apiCall('save', 'bible_chapter', { item });
        }
    },

    ReadingProgress: {
      filter: async (query: any) => {
        const data = await apiCall('list', 'reading_progress');
        if (!data) return [];
        return data.filter((item: any) => item.user_email === query.user_email);
      },
      create: async (data: any) => {
        const newItem = { ...data, id: data.id || Date.now().toString() };
        await apiCall('save', 'reading_progress', { item: newItem });
        return newItem;
      },
      update: async (id: string, updates: any) => {
        const all = await apiCall('list', 'reading_progress') || [];
        const existing = all.find((i: any) => i.id === id);
        
        if (existing) {
             const updated = { ...existing, ...updates };
             await apiCall('save', 'reading_progress', { item: updated });
             const newCache = all.map((i: any) => i.id === id ? updated : i);
             storage.set('reading_progress', newCache);
             return updated;
        }
        return null;
      },
      list: async (sort: 'chapters' | 'ebd', limit: number) => {
        const data = await apiCall('list', 'reading_progress') || [];
        if (sort === 'ebd') {
            data.sort((a: any, b: any) => (b.total_ebd_read || 0) - (a.total_ebd_read || 0));
        } else {
            data.sort((a: any, b: any) => (b.total_chapters || 0) - (a.total_chapters || 0));
        }
        return data.slice(0, limit);
      }
    },
    
    ChapterMetadata: {
        get: async (chapterKey: string) => {
            return await metaStorage.get(chapterKey);
        },
        save: async (data: any) => {
            // Garante que o ID seja a chave do capítulo para busca direta
            const item = { ...data, id: data.chapter_key };
            // Salva na Nuvem (Universal)
            await apiCall('save', 'chapter_metadata', { item });
            // Salva Local (Offline)
            return await metaStorage.save(data.chapter_key, item);
        },
        // Nova função para buscar especificamente da nuvem pelo ID
        getCloud: async (chapterKey: string) => {
             const data = await apiCall('get', 'chapter_metadata', { id: chapterKey });
             return data;
        },
        filter: async (query: any) => {
            const data = await apiCall('list', 'chapter_metadata') || [];
            return data.filter((item: any) => item.chapter_key === query.chapter_key);
        }
    },

    Commentary: {
      filter: async (query: any) => {
        const data = await apiCall('list', 'commentary') || [];
        return data.filter((item: any) => item.verse_key === query.verse_key);
      },
      create: async (data: any) => {
        const newItem = { ...data, id: data.id || Date.now().toString() };
        await apiCall('save', 'commentary', { item: newItem });
        return newItem;
      },
      delete: async (id: string) => {
        await apiCall('delete', 'commentary', { id });
      }
    },

    Dictionary: {
        filter: async (query: any) => {
          const data = await apiCall('list', 'dictionary') || [];
          return data.filter((item: any) => item.verse_key === query.verse_key);
        },
        create: async (data: any) => {
          const newItem = { ...data, id: data.id || Date.now().toString() };
          await apiCall('save', 'dictionary', { item: newItem });
          return newItem;
        },
        delete: async (id: string) => {
           await apiCall('delete', 'dictionary', { id });
        }
    },

    PanoramaBiblico: {
        filter: async (query: any) => {
            const data = await apiCall('list', 'panorama') || [];
            return data.filter((item: any) => item.study_key === query.study_key);
        },
        create: async (data: any) => {
            const newItem = { ...data, id: data.id || Date.now().toString() };
            await apiCall('save', 'panorama', { item: newItem });
            return newItem;
        },
        update: async (id: string, updates: any) => {
             const newItem = { ...updates, id };
             await apiCall('save', 'panorama', { item: newItem });
             return newItem;
        },
        delete: async (id: string) => {
             await apiCall('delete', 'panorama', { id });
        }
    },

    Devotional: {
      filter: async (query: any) => {
        const data = await apiCall('list', 'devotional') || [];
        return data.filter((item: any) => item.date === query.date);
      },
      create: async (data: any) => {
        const newItem = { ...data, id: data.id || Date.now().toString() };
        await apiCall('save', 'devotional', { item: newItem });
        return newItem;
      },
      delete: async (id: string) => {
         await apiCall('delete', 'devotional', { id });
      }
    },

    PrayerRequests: {
        list: async () => {
            const data = await apiCall('list', 'prayer_requests') || [];
            return data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        },
        create: async (data: any) => {
            const newItem = { ...data, id: data.id || Date.now().toString() };
            await apiCall('save', 'prayer_requests', { item: newItem });
            return newItem;
        },
        update: async (id: string, updates: any) => {
            const all = await apiCall('list', 'prayer_requests') || [];
            const existing = all.find((i: any) => i.id === id);
            if(existing) {
                const updated = { ...existing, ...updates };
                await apiCall('save', 'prayer_requests', { item: updated });
                return updated;
            }
            return null;
        },
        delete: async (id: string) => {
             await apiCall('delete', 'prayer_requests', { id });
        }
    },

    Announcements: {
        list: async () => {
            const data = await apiCall('list', 'announcements') || [];
            return data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        },
        create: async (data: any) => {
            const newItem = { ...data, id: data.id || Date.now().toString() };
            await apiCall('save', 'announcements', { item: newItem });
            return newItem;
        },
        delete: async (id: string) => {
             await apiCall('delete', 'announcements', { id });
        }
    },

    ContentReports: {
        list: async () => {
            const data = await apiCall('list', 'content_reports') || [];
            return data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        },
        create: async (data: any) => {
            const newItem = { ...data, id: data.id || Date.now().toString() };
            await apiCall('save', 'content_reports', { item: newItem });
            return newItem;
        },
        update: async (id: string, updates: any) => {
            const all = await apiCall('list', 'content_reports') || [];
            const existing = all.find((i: any) => i.id === id);
            if(existing) {
                const updated = { ...existing, ...updates };
                await apiCall('save', 'content_reports', { item: updated });
                return updated;
            }
            return null;
        },
        delete: async (id: string) => {
             await apiCall('delete', 'content_reports', { id });
        }
    }
  }
};
