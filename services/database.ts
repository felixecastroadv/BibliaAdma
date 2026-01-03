
// --- INDEXED DB FOR BIBLE AND CONTENT (ADMA Supreme DB v2) ---
const DB_NAME = 'adma_supreme_db';
const BIBLE_STORE = 'bible_verses';
const CONTENT_STORE = 'adma_content_store'; 
const DB_VERSION = 2;

const openDB = (): Promise<IDBDatabase> => {
    if (typeof window === 'undefined') return Promise.reject("No window context");
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(BIBLE_STORE)) {
                db.createObjectStore(BIBLE_STORE);
            }
            if (!db.objectStoreNames.contains(CONTENT_STORE)) {
                db.createObjectStore(CONTENT_STORE);
            }
        };
        request.onsuccess = (event: any) => resolve(event.target.result);
        request.onerror = (event: any) => reject(event.target.error);
    });
};

const idbManager = {
    get: async (store: string, key: string) => {
        try {
            const db = await openDB();
            return new Promise<any>((resolve, reject) => {
                const transaction = db.transaction([store], 'readonly');
                const request = transaction.objectStore(store).get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (e) { return null; }
    },
    save: async (store: string, key: string, data: any) => {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([store], 'readwrite');
                const request = transaction.objectStore(store).put(data, key);
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (e) { return false; }
    },
    list: async (store: string, collection: string) => {
        try {
            const db = await openDB();
            return new Promise<any[]>((resolve, reject) => {
                const transaction = db.transaction([store], 'readonly');
                const objectStore = transaction.objectStore(store);
                const request = objectStore.getAll();
                request.onsuccess = () => {
                    const all = request.result || [];
                    resolve(all.filter((item: any) => item && item.__adma_col === collection));
                };
                request.onerror = () => reject(request.error);
            });
        } catch (e) { return []; }
    },
    delete: async (store: string, key: string) => {
        try {
            const db = await openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction([store], 'readwrite');
                const request = transaction.objectStore(store).delete(key);
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (e) { return false; }
    }
};

export const bibleStorage = {
    get: async (key: string) => await idbManager.get(BIBLE_STORE, key),
    save: async (key: string, data: any) => await idbManager.save(BIBLE_STORE, key, data),
    count: async () => {
        try {
            const db = await openDB();
            return new Promise<number>((resolve) => {
                const req = db.transaction([BIBLE_STORE], 'readonly').objectStore(BIBLE_STORE).count();
                req.onsuccess = () => resolve(req.result);
            });
        } catch (e) { return 0; }
    },
    clear: async () => {
        try {
            const db = await openDB();
            db.transaction([BIBLE_STORE], 'readwrite').objectStore(BIBLE_STORE).clear();
        } catch (e) {}
    }
};

const apiCall = async (action: string, collection: string, payload: any = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    try {
        const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, collection, ...payload }),
            signal: controller.signal
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        clearTimeout(timeout);
        return null; 
    }
};

const createHelpers = (col: string) => ({
    list: async () => {
        const cloudData = await apiCall('list', col);
        if (cloudData && Array.isArray(cloudData)) {
            for(const item of cloudData) {
                await idbManager.save(CONTENT_STORE, `${col}_${item.id}`, { ...item, __adma_col: col });
            }
            return cloudData;
        }
        return await idbManager.list(CONTENT_STORE, col);
    },
    filter: async (criteria: any) => {
        let allItems = await apiCall('list', col);
        if (!allItems || allItems.length === 0) {
            allItems = await idbManager.list(CONTENT_STORE, col);
        } else {
            for(const item of allItems) {
                await idbManager.save(CONTENT_STORE, `${col}_${item.id}`, { ...item, __adma_col: col });
            }
        }
        return (allItems || []).filter((item: any) => 
            Object.keys(criteria).every(k => item[k] === criteria[k])
        );
    },
    // Fix: Added getCloud method to createHelpers to satisfy generic entity cloud fetch requirements
    getCloud: async (id: string) => {
        return await apiCall('get', col, { id });
    },
    get: async (id?: string) => {
        if (!id) return null;
        const cloudItem = await apiCall('get', col, { id });
        if (cloudItem) {
            await idbManager.save(CONTENT_STORE, `${col}_${id}`, { ...cloudItem, __adma_col: col });
            return cloudItem;
        }
        return await idbManager.get(CONTENT_STORE, `${col}_${id}`);
    },
    create: async (data: any) => {
        const id = data.id || Date.now().toString();
        const newItem = { ...data, id };
        await idbManager.save(CONTENT_STORE, `${col}_${id}`, { ...newItem, __adma_col: col });
        await apiCall('save', col, { item: newItem });
        return newItem;
    },
    update: async (id: string, updates: any) => {
        let existing = await apiCall('get', col, { id });
        if (!existing) existing = await idbManager.get(CONTENT_STORE, `${col}_${id}`);
        if (existing) {
            const merged = { ...existing, ...updates };
            await idbManager.save(CONTENT_STORE, `${col}_${id}`, { ...merged, __adma_col: col });
            await apiCall('save', col, { item: merged });
            return merged;
        }
        return null;
    },
    delete: async (id: string) => {
        await idbManager.delete(CONTENT_STORE, `${col}_${id}`);
        await apiCall('delete', col, { id });
    },
    save: async (data: any) => {
        const id = data.id || data.chapter_key || Date.now().toString();
        const item = { ...data, id };
        await idbManager.save(CONTENT_STORE, `${col}_${id}`, { ...item, __adma_col: col });
        await apiCall('save', col, { item });
        return item;
    }
});

const createBibleHelpers = () => ({
    getOffline: async (key: string) => await idbManager.get(BIBLE_STORE, key),
    saveOffline: async (key: string, data: any) => await idbManager.save(BIBLE_STORE, key, data),
    getCloud: async (key: string) => {
        const item = await apiCall('get', 'bible_chapters', { id: key });
        return item ? item.verses : null;
    },
    saveUniversal: async (key: string, verses: string[]) => {
        await idbManager.save(BIBLE_STORE, key, verses);
        await apiCall('save', 'bible_chapters', { item: { id: key, verses } });
    },
    list: async () => {
        const cloudList = await apiCall('list', 'bible_chapters');
        return cloudList || [];
    }
});

export const syncManager = {
    fullSync: async () => {
        if (typeof window === 'undefined' || !navigator.onLine) return;
        const collections = ['panorama_biblico', 'announcements', 'chapter_metadata', 'devotionals', 'dynamic_modules', 'app_config'];
        for (const col of collections) {
            try {
                const cloudData = await apiCall('list', col);
                if (cloudData && Array.isArray(cloudData)) {
                    for(const item of cloudData) {
                        await idbManager.save(CONTENT_STORE, `${col}_${item.id}`, { ...item, __adma_col: col });
                    }
                }
            } catch (e) {}
        }
    }
};

export const db = {
    entities: {
        ReadingProgress: createHelpers('reading_progress'),
        AppConfig: createHelpers('app_config'),
        DynamicModules: createHelpers('dynamic_modules'),
        BibleChapter: createBibleHelpers(),
        ChapterMetadata: {
            ...createHelpers('chapter_metadata'),
            save: async (data: any) => {
                const id = data.chapter_key;
                const item = { ...data, id };
                await idbManager.save(CONTENT_STORE, `chapter_metadata_${id}`, { ...item, __adma_col: 'chapter_metadata' });
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
