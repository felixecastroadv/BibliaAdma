
// --- INDEXED DB FOR BIBLE TEXT (Offline - Grande Volume) ---
const DB_NAME = 'adma_bible_db';
const STORE_NAME = 'bible_verses';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
    if (typeof window === 'undefined') return Promise.reject("No window");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (event: any) => resolve(event.target.result);
        request.onerror = (event: any) => reject(event.target.error);
    });
};

export const bibleStorage = {
    get: async (key: string) => {
        try {
            const db = await openDB();
            return new Promise<any>((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (e) { return null; }
    },
    save: async (key: string, data: any) => {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.put(data, key);
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (e) { return false; }
    },
    count: async () => {
        try {
            const db = await openDB();
            return new Promise<number>((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.count();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (e) { return 0; }
    },
    clear: async () => {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                const request = store.clear();
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (e) { return false; }
    }
};

// --- HELPER LOCALSTORAGE (Backup de Segurança para Pequenos Dados) ---
const localBackup = {
    list: (collection: string) => {
        try {
            const data = localStorage.getItem(`adma_backup_${collection}`);
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    },
    saveItem: (collection: string, item: any) => {
        try {
            const list = localBackup.list(collection);
            const index = list.findIndex((i: any) => i.id === item.id);
            if (index > -1) list[index] = item;
            else list.push(item);
            localStorage.setItem(`adma_backup_${collection}`, JSON.stringify(list));
        } catch (e) { console.error("Erro no backup local", e); }
    },
    deleteItem: (collection: string, id: string) => {
        try {
            const list = localBackup.list(collection);
            const newList = list.filter((i: any) => i.id !== id);
            localStorage.setItem(`adma_backup_${collection}`, JSON.stringify(newList));
        } catch (e) { }
    },
    sync: (collection: string, cloudData: any[]) => {
        if(cloudData && cloudData.length > 0) {
            localStorage.setItem(`adma_backup_${collection}`, JSON.stringify(cloudData));
        }
    }
};

// --- CLOUD API (Supabase) ---
const apiCall = async (action: string, collection: string, payload: any = {}) => {
    try {
        const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, collection, ...payload })
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null; // Falha silenciosa para ativar fallback
    }
};

// --- HYBRID DATA MANAGER ---
const createHelpers = (col: string) => ({
    list: async (key?: string, limit?: number) => {
        // 1. Tenta Nuvem (Prioridade Total)
        const cloudData = await apiCall('list', col);
        
        // 2. Se Nuvem ok, atualiza backup local e retorna nuvem
        if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
            localBackup.sync(col, cloudData);
            return cloudData;
        }

        // 3. Se Nuvem falhou ou vazia, retorna Backup Local (Modo Offline/Resgate)
        return localBackup.list(col);
    },
    filter: async (criteria: any) => {
        let allItems = await apiCall('list', col);
        
        if (!allItems || allItems.length === 0) {
            allItems = localBackup.list(col);
        } else {
            localBackup.sync(col, allItems);
        }

        return (allItems || []).filter((item: any) => 
            Object.keys(criteria).every(k => item[k] === criteria[k])
        );
    },
    get: async (id?: string) => {
        if (!id) return null;
        // Tenta nuvem
        const cloudItem = await apiCall('get', col, { id });
        if (cloudItem) return cloudItem;
        
        // Tenta local
        const localList = localBackup.list(col);
        return localList.find((i: any) => i.id === id) || null;
    },
    create: async (data: any) => {
        const newItem = { ...data, id: data.id || Date.now().toString() };
        
        // Salva Local Primeiro (Feedback Instantâneo)
        localBackup.saveItem(col, newItem);
        
        // Salva Nuvem (Persistência Real)
        await apiCall('save', col, { item: newItem });
        
        return newItem;
    },
    update: async (id: string, updates: any) => {
        let existing = await apiCall('get', col, { id });
        if (!existing) {
             const localList = localBackup.list(col);
             existing = localList.find((i: any) => i.id === id);
        }

        if (existing) {
            const merged = { ...existing, ...updates };
            localBackup.saveItem(col, merged);
            await apiCall('save', col, { item: merged });
            return merged;
        }
        return null;
    },
    delete: async (id: string) => {
        localBackup.deleteItem(col, id);
        await apiCall('delete', col, { id });
    },
    save: async (data: any) => {
        const newItem = { ...data, id: data.id || Date.now().toString() };
        localBackup.saveItem(col, newItem);
        await apiCall('save', col, { item: newItem });
        return newItem;
    }
});

// Helper Especial para Bíblia (Evita LocalStorage, usa IndexedDB + Nuvem)
const createBibleHelpers = () => ({
    getOffline: async (key: string) => await bibleStorage.get(key),
    saveOffline: async (key: string, data: any) => await bibleStorage.save(key, data),
    getCloud: async (key: string) => {
        const item = await apiCall('get', 'bible_chapters', { id: key });
        return item ? item.verses : null;
    },
    // NOVO: Método de salvamento Universal
    saveUniversal: async (key: string, verses: string[]) => {
        // 1. Salva no Cache Local (Rápido)
        await bibleStorage.save(key, verses);
        
        // 2. Salva na Nuvem (Seguro)
        const item = { id: key, verses: verses };
        await apiCall('save', 'bible_chapters', { item });
    },
    list: async () => {
        // Tenta listar da nuvem primeiro (para restaurar)
        const cloudList = await apiCall('list', 'bible_chapters');
        if (cloudList) return cloudList;
        return []; // Não lista do IndexedDB diretamente pois é muito pesado, usa count() na UI
    }
});

export const db = {
    entities: {
        ReadingProgress: createHelpers('reading_progress'),
        AppConfig: createHelpers('app_config'),
        DynamicModules: createHelpers('dynamic_modules'),
        BibleChapter: createBibleHelpers(), // Usa helper otimizado
        ChapterMetadata: {
            ...createHelpers('chapter_metadata'),
            getCloud: async (key: string) => await apiCall('get', 'chapter_metadata', { id: key }),
            save: async (data: any) => {
                const item = { ...data, id: data.chapter_key };
                localBackup.saveItem('chapter_metadata', item);
                await apiCall('save', 'chapter_metadata', { item });
                return item;
            }
        },
        Commentary: createHelpers('commentaries'),
        Dictionary: createHelpers('dictionaries'),
        PanoramaBiblico: createHelpers('panorama_biblico'),
        Devotional: createHelpers('devotionals'),
        Announcements: createHelpers('announcements'),
        PrayerRequests: createHelpers('prayer_requests'),
        ContentReports: createHelpers('content_reports'),
    }
};
