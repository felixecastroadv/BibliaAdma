
// --- INDEXED DB FOR BIBLE TEXT (Offline) ---
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
            return new Promise((resolve, reject) => {
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

// --- CLOUD API (Supabase via Next.js API Route) ---
const apiCall = async (action: string, collection: string, payload: any = {}) => {
    try {
        const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, collection, ...payload })
        });
        if (!res.ok) {
            console.warn(`API Error ${action} ${collection}:`, await res.text());
            return null;
        }
        return await res.json();
    } catch (e) {
        console.error("Network Error", e);
        return null;
    }
};

const createHelpers = (col: string) => ({
    list: async (key?: string, limit?: number) => {
        const data = await apiCall('list', col) || [];
        return data;
    },
    filter: async (criteria: any) => {
        const all = await apiCall('list', col) || [];
        return all.filter((item: any) => 
            Object.keys(criteria).every(k => item[k] === criteria[k])
        );
    },
    get: async (id?: string) => {
        if (!id) {
            const all = await apiCall('list', col) || [];
            return all.length > 0 ? all[0] : null;
        }
        return await apiCall('get', col, { id });
    },
    create: async (data: any) => {
        const newItem = { ...data, id: data.id || Date.now().toString() };
        await apiCall('save', col, { item: newItem });
        return newItem;
    },
    update: async (id: string, updates: any) => {
        const existing = await apiCall('get', col, { id });
        if (existing) {
            const merged = { ...existing, ...updates };
            await apiCall('save', col, { item: merged });
            return merged;
        }
        return null;
    },
    delete: async (id: string) => {
        await apiCall('delete', col, { id });
    },
    save: async (data: any) => {
        const newItem = { ...data, id: data.id || Date.now().toString() };
        await apiCall('save', col, { item: newItem });
        return newItem;
    }
});

export const db = {
    entities: {
        ReadingProgress: createHelpers('reading_progress'),
        AppConfig: createHelpers('app_config'),
        DynamicModules: createHelpers('dynamic_modules'),
        BibleChapter: {
            ...createHelpers('bible_chapters'),
            getOffline: async (key: string) => await bibleStorage.get(key),
            saveOffline: async (key: string, data: any) => await bibleStorage.save(key, data),
            getCloud: async (key: string) => {
                const item = await apiCall('get', 'bible_chapters', { id: key });
                return item ? item.verses : null;
            }
        },
        ChapterMetadata: {
            ...createHelpers('chapter_metadata'),
            getCloud: async (key: string) => await apiCall('get', 'chapter_metadata', { id: key }),
            save: async (data: any) => {
                const item = { ...data, id: data.chapter_key };
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
