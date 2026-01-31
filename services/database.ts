
// --- INDEXED DB FOR BIBLE AND CONTENT (ADMA Supreme DB v3 - Offline First) ---
const DB_NAME = 'adma_supreme_db';
const BIBLE_STORE = 'bible_verses';
const CONTENT_STORE = 'adma_content_store'; 
const DB_VERSION = 3;

// --- UTILS ---
export const generateUserId = (email: string) => {
    if (!email) return 'user_unknown';
    // Remove caracteres especiais e cria um ID seguro e único baseado no email
    return 'user_' + email.trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
};

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
        request.onerror = (event: any) => reject(request.error);
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
    // Se estiver offline e não for uma ação de salvar, nem tenta a rede para economizar bateria/erro
    if (typeof navigator !== 'undefined' && !navigator.onLine && action !== 'save') return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000); // 15s timeout
    
    try {
        const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, collection, ...payload }),
            signal: controller.signal,
            keepalive: true // <--- CRÍTICO: Garante que o salvamento termine mesmo se a aba fechar
        });
        clearTimeout(timeout);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        clearTimeout(timeout);
        console.warn("API Call failed (Network/Timeout):", e);
        return null; 
    }
};

const createHelpers = (col: string) => ({
    list: async () => {
        // Tenta rede primeiro para atualizar cache
        const cloudData = await apiCall('list', col);
        if (cloudData && Array.isArray(cloudData)) {
            for(const item of cloudData) {
                // Se tiver ID, salva com ID. Se não, tenta gerar algo único.
                const itemId = item.id || `item_${Date.now()}`;
                await idbManager.save(CONTENT_STORE, `${col}_${itemId}`, { ...item, __adma_col: col });
            }
            return cloudData;
        }
        // Se rede falhar ou estiver offline, usa local
        return await idbManager.list(CONTENT_STORE, col);
    },
    filter: async (criteria: any) => {
        // ESTRATÉGIA NETWORK FIRST (Prioridade Nuvem para Dados Críticos como Progresso)
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            try {
                // Busca diretamente no servidor com o filtro
                const cloudData = await apiCall('filter', col, { criteria });
                if (cloudData && Array.isArray(cloudData) && cloudData.length > 0) {
                    // Atualiza cache local com o dado mais fresco da nuvem
                    for(const item of cloudData) {
                        const id = item.id || item.study_key || item.chapter_key;
                        if (id) {
                             await idbManager.save(CONTENT_STORE, `${col}_${id}`, { ...item, __adma_col: col });
                        }
                    }
                    return cloudData; // Retorna dado da nuvem
                }
            } catch (e) {
                console.warn("Falha ao filtrar na nuvem, usando local", e);
            }
        }

        // Fallback: Busca Local (Offline ou erro de rede)
        const localItems = await idbManager.list(CONTENT_STORE, col);
        return localItems.filter((item: any) => 
            Object.keys(criteria).every(k => String(item[k]) === String(criteria[k]))
        );
    },
    getCloud: async (id: string) => {
        return await apiCall('get', col, { id });
    },
    get: async (id?: string) => {
        if (!id) return null;
        
        // 1. TENTA LOCAL PRIMEIRO (Stale-While-Revalidate)
        // Isso garante que a UI carregue INSTANTANEAMENTE se o usuário já logou antes.
        const local = await idbManager.get(CONTENT_STORE, `${col}_${id}`);
        
        // Se estiver online, busca atualização silenciosa no background (Cloud)
        if (typeof navigator !== 'undefined' && navigator.onLine) {
            apiCall('get', col, { id }).then(async (cloudItem) => {
                if (cloudItem) {
                    // Se encontrou na nuvem, atualiza o local para a próxima vez
                    await idbManager.save(CONTENT_STORE, `${col}_${id}`, { ...cloudItem, __adma_col: col });
                }
            }).catch(err => console.warn("Background sync failed", err));
        }

        if (local) return local;

        // Se não tinha local, espera a nuvem (primeiro acesso)
        const cloudItem = await apiCall('get', col, { id });
        if (cloudItem) {
            await idbManager.save(CONTENT_STORE, `${col}_${id}`, { ...cloudItem, __adma_col: col });
            return cloudItem;
        }
        return null;
    },
    create: async (data: any) => {
        // Se o dado já vier com ID (ex: generateUserId), usa ele.
        const id = (data.id || data.study_key || data.chapter_key || Date.now().toString()).toString();
        const newItem = { ...data, id };
        await idbManager.save(CONTENT_STORE, `${col}_${id}`, { ...newItem, __adma_col: col });
        await apiCall('save', col, { item: newItem });
        return newItem;
    },
    update: async (id: string, updates: any) => {
        // 1. Pega versão local
        let existing = await idbManager.get(CONTENT_STORE, `${col}_${id}`);
        // 2. Mescla
        const merged = { ...existing, ...updates, id: id.toString() };
        // 3. Salva Local (Instantâneo)
        await idbManager.save(CONTENT_STORE, `${col}_${id}`, { ...merged, __adma_col: col });
        // 4. Salva Nuvem (Assíncrono com KeepAlive)
        return await apiCall('save', col, { item: merged });
    },
    delete: async (id: string) => {
        await idbManager.delete(CONTENT_STORE, `${col}_${id}`);
        apiCall('delete', col, { id });
    },
    save: async (data: any) => {
        const id = (data.id || data.chapter_key || Date.now().toString()).toString();
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
