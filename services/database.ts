const apiCall = async (action: 'list' | 'save' | 'delete', collection: string, payload: any = {}) => {
    try {
        const res = await fetch('/api/storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, collection, ...payload })
        });
        
        if (!res.ok) {
            // Se falhar o save na nuvem para conteúdo compartilhado, lançamos erro
            if (action === 'save' && ['commentary', 'dictionary', 'panorama', 'devotional', 'chapter_metadata'].includes(collection)) {
                console.warn(`Failed to save to cloud: ${collection}`);
                // Em produção, talvez queiramos continuar localmente ou avisar o usuário
                // throw new Error('FALHA DE SINCRONIZAÇÃO'); 
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
    // Local Storage (User Specific - Mantém progresso individual)
    ReadingProgress: {
      filter: async (query: any) => {
        const data = JSON.parse(localStorage.getItem('adma_progress') || '[]');
        return data.filter((item: any) => 
          Object.keys(query).every(key => item[key] === query[key])
        );
      },
      create: async (data: any) => {
        const all = JSON.parse(localStorage.getItem('adma_progress') || '[]');
        const newItem = { ...data, id: Date.now().toString() };
        all.push(newItem);
        localStorage.setItem('adma_progress', JSON.stringify(all));
        return newItem;
      },
      update: async (id: string, updates: any) => {
        const all = JSON.parse(localStorage.getItem('adma_progress') || '[]');
        const idx = all.findIndex((i: any) => i.id === id);
        if (idx !== -1) {
          all[idx] = { ...all[idx], ...updates };
          localStorage.setItem('adma_progress', JSON.stringify(all));
          return all[idx];
        }
        return null;
      },
      list: async (sort: string, limit: number) => {
        let all = JSON.parse(localStorage.getItem('adma_progress') || '[]');
        all.sort((a: any, b: any) => b.total_chapters - a.total_chapters);
        return all.slice(0, limit);
      }
    },
    
    // Cloud Storage (Universal Content - Everyone sees the same)
    
    // Agora METADADOS são universais (quem abrir primeiro, cria para todos)
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
    }
  }
};