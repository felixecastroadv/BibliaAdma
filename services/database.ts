
const CACHE_PREFIX = 'adma_cache_v1_';

// Função auxiliar para gerenciar LocalStorage com segurança
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

const apiCall = async (action: 'list' | 'save' | 'delete', collection: string, payload: any = {}) => {
    // 1. Tenta operação Online
    try {
        const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, collection, ...payload })
        });

        if (!res.ok) throw new Error("Server Error");

        const data = await res.json();

        // SUCESSO ONLINE: Atualiza o Cache Local
        if (action === 'list') {
            storage.set(collection, data);
        }
        
        return data;

    } catch (e) {
        // FALHA ONLINE (OFFLINE MODE): Recorre ao Cache Local
        console.warn(`[Offline Mode] Usando cache para: ${action} em ${collection}`);

        if (action === 'list') {
            const cached = storage.get(collection);
            return cached || []; // Retorna o que tem salvo ou array vazio
        }

        return null;
    }
};

export const db = {
  entities: {
    // Nova Entidade para Texto Bíblico Persistente
    BibleChapter: {
        filter: async (query: any) => {
            // Tenta pegar cache específico primeiro para performance
            const cacheKey = `bible_${query.chapter_key}`;
            const local = storage.get(cacheKey);
            if (local) return [local];

            const data = await apiCall('list', 'bible_text') || [];
            return data.filter((item: any) => item.chapter_key === query.chapter_key);
        },
        create: async (data: any) => {
            const newItem = { ...data, id: data.id || Date.now().toString() };
            // Salva no banco
            await apiCall('save', 'bible_text', { item: newItem });
            // Salva no cache local individual para acesso rápido
            storage.set(`bible_${data.chapter_key}`, newItem);
            return newItem;
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
        filter: async (query: any) => {
            const data = await apiCall('list', 'chapter_metadata') || [];
            return data.filter((item: any) => item.chapter_key === query.chapter_key);
        },
        create: async (data: any) => {
            const newItem = { ...data, id: data.id || Date.now().toString() };
            await apiCall('save', 'chapter_metadata', { item: newItem });
            return newItem;
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
