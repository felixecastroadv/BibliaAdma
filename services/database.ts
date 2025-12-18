import { createClient } from '@supabase/supabase-js';

// Configurações do Supabase
const MANUAL_SUPABASE_URL = "https://nnhatyvrtlbkyfadumqo.supabase.co";
const MANUAL_SUPABASE_KEY = "sb_publishable_0uZeWa8FXTH-u-ki_NRHsQ_nYALzy9j";

const supabase = createClient(
    process.env.SUPABASE_URL || MANUAL_SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY || MANUAL_SUPABASE_KEY
);

const DB_NAME = 'adma_bible_db';
const STORE_NAME = 'bible_verses';
const DB_VERSION = 1;

const openDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
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
            return new Promise((resolve) => {
                const transaction = db.transaction([STORE_NAME], 'readwrite');
                const store = transaction.objectStore(STORE_NAME);
                store.put(data, key);
                transaction.oncomplete = () => resolve(true);
            });
        } catch (e) { return false; }
    },
    count: async () => {
        try {
            const db = await openDB();
            return new Promise<number>((resolve) => {
                const transaction = db.transaction([STORE_NAME], 'readonly');
                const request = transaction.objectStore(STORE_NAME).count();
                request.onsuccess = () => resolve(request.result);
            });
        } catch (e) { return 0; }
    },
    clear: async () => {
        try {
            const db = await openDB();
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            transaction.objectStore(STORE_NAME).clear();
        } catch (e) {}
    }
};

const localBackup = {
    list: (col: string) => JSON.parse(localStorage.getItem(`adma_backup_${col}`) || '[]'),
    saveItem: (col: string, item: any) => {
        const list = localBackup.list(col);
        const idx = list.findIndex((i: any) => i.id === item.id);
        if (idx > -1) list[idx] = item; else list.push(item);
        localStorage.setItem(`adma_backup_${col}`, JSON.stringify(list));
    },
    deleteItem: (col: string, id: string) => {
        const list = localBackup.list(col).filter((i: any) => i.id !== id);
        localStorage.setItem(`adma_backup_${col}`, JSON.stringify(list));
    }
};

const createHelpers = (col: string) => ({
    list: async () => {
        const { data, error } = await supabase.from('adma_content').select('data').eq('collection', col);
        if (error) return localBackup.list(col);
        const cleanData = data.map(r => r.data);
        localStorage.setItem(`adma_backup_${col}`, JSON.stringify(cleanData));
        return cleanData;
    },
    filter: async (criteria: any) => {
        const all = await createHelpers(col).list();
        return all.filter((i: any) => Object.keys(criteria).every(k => i[k] === criteria[k]));
    },
    get: async (id: string) => {
        const { data, error } = await supabase.from('adma_content').select('data').eq('collection', col).eq('id', id).maybeSingle();
        if (error || !data) return localBackup.list(col).find((i: any) => i.id === id);
        return data.data;
    },
    create: async (data: any) => {
        const item = { ...data, id: data.id || Date.now().toString() };
        localBackup.saveItem(col, item);
        await supabase.from('adma_content').upsert({ id: item.id.toString(), collection: col, data: item });
        return item;
    },
    update: async (id: string, updates: any) => {
        const existing = await createHelpers(col).get(id);
        if (existing) {
            const merged = { ...existing, ...updates };
            localBackup.saveItem(col, merged);
            await supabase.from('adma_content').upsert({ id: id.toString(), collection: col, data: merged });
            return merged;
        }
        return null;
    },
    delete: async (id: string) => {
        localBackup.deleteItem(col, id);
        await supabase.from('adma_content').delete().eq('id', id.toString());
    },
    save: async (data: any) => {
        const item = { ...data, id: data.id || Date.now().toString() };
        localBackup.saveItem(col, item);
        await supabase.from('adma_content').upsert({ id: item.id.toString(), collection: col, data: item });
        return item;
    }
});

export const db = {
    entities: {
        ReadingProgress: createHelpers('reading_progress'),
        AppConfig: createHelpers('app_config'),
        DynamicModules: createHelpers('dynamic_modules'),
        BibleChapter: {
            getOffline: (key: string) => bibleStorage.get(key),
            saveOffline: (key: string, data: any) => bibleStorage.save(key, data),
            getCloud: async (key: string) => {
                const { data } = await supabase.from('adma_content').select('data').eq('collection', 'bible_chapters').eq('id', key).maybeSingle();
                return data ? data.data.verses : null;
            },
            saveUniversal: async (key: string, verses: string[]) => {
                await bibleStorage.save(key, verses);
                await supabase.from('adma_content').upsert({ id: key, collection: 'bible_chapters', data: { id: key, verses } });
            }
        },
        ChapterMetadata: {
            ...createHelpers('chapter_metadata'),
            getCloud: async (key: string) => {
                const { data } = await supabase.from('adma_content').select('data').eq('collection', 'chapter_metadata').eq('id', key).maybeSingle();
                return data ? data.data : null;
            },
            save: async (data: any) => {
                const item = { ...data, id: data.chapter_key };
                localBackup.saveItem('chapter_metadata', item);
                await supabase.from('adma_content').upsert({ id: item.id.toString(), collection: 'chapter_metadata', data: item });
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
