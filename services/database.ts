
const apiCall = async (action: 'list' | 'save' | 'delete', collection: string, payload: any = {}) => {
    try {
        const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, collection, ...payload })
        });
        
        if (!res.ok) {
            // Se falhar o save na nuvem para conteúdo compartilhado, lançamos erro
            if (action === 'save') {
                console.warn(`Failed to save to cloud: ${collection}`);
            }
            if (action === 'list') return [];
            return null;
        }
        
        const data = await res.json();
        return data;
    } catch (e) {
        console.error("Cloud DB Error", e);
        if (action === 'list') return [];
        throw e;
    }
};

export const db = {
  entities: {
    // --- AGORA NA NUVEM: PROGRESSO DE LEITURA (RANKING GLOBAL) ---
    ReadingProgress: {
      filter: async (query: any) => {
        // Busca na nuvem para saber se o usuário já existe
        const data = await apiCall('list', 'reading_progress');
        return data.filter((item: any) => item.user_email === query.user_email);
      },
      create: async (data: any) => {
        const newItem = { ...data, id: data.id || Date.now().toString() };
        await apiCall('save', 'reading_progress', { item: newItem });
        return newItem;
      },
      update: async (id: string, updates: any) => {
        // 1. Busca todos (limitação da API genérica, em app real buscaria por ID)
        const all = await apiCall('list', 'reading_progress');
        // 2. Encontra o usuário
        const existing = all.find((i: any) => i.id === id);
        
        if (existing) {
             // 3. Mescla os dados antigos com os novos
             const updated = { ...existing, ...updates };
             // 4. Salva o objeto completo atualizado
             await apiCall('save', 'reading_progress', { item: updated });
             return updated;
        }
        return null;
      },
      list: async (sort: 'chapters' | 'ebd', limit: number) => {
        const data = await apiCall('list', 'reading_progress');
        
        // Ordena dinamicamente baseado no parâmetro sort
        if (sort === 'ebd') {
            data.sort((a: any, b: any) => (b.total_ebd_read || 0) - (a.total_ebd_read || 0));
        } else {
            data.sort((a: any, b: any) => (b.total_chapters || 0) - (a.total_chapters || 0));
        }
        
        // Retorna apenas os top 'limit' (ex: 100)
        return data.slice(0, limit);
      }
    },
    
    // --- OUTROS CONTEÚDOS ---
    
    ChapterMetadata: {
        filter: async (query: any) => {
            const data = await apiCall('list', 'chapter_metadata');
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
        const data = await apiCall('list', 'commentary');
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
          const data = await apiCall('list', 'dictionary');
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
            const data = await apiCall('list', 'panorama');
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
        const data = await apiCall('list', 'devotional');
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
            const data = await apiCall('list', 'prayer_requests');
            // Ordenar por data (mais recente primeiro)
            return data.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        },
        create: async (data: any) => {
            const newItem = { ...data, id: data.id || Date.now().toString() };
            await apiCall('save', 'prayer_requests', { item: newItem });
            return newItem;
        },
        update: async (id: string, updates: any) => {
            // Em um backend real seria PATCH. Aqui fazemos busca e update.
            const all = await apiCall('list', 'prayer_requests');
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
            const data = await apiCall('list', 'announcements');
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
    }
  }
};
