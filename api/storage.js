
import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    // Tenta encontrar as chaves do Supabase em qualquer um dos formatos comuns na Vercel
    const supabaseUrl = process.env.SUPABASE_URL || 
                        process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return response.status(500).json({ 
            error: "BANCO DE DADOS DESCONECTADO: Configure as variáveis SUPABASE_URL e SUPABASE_ANON_KEY na Vercel." 
        });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { action, collection, id, item, criteria } = body;

    // NOVO: Ação de Filtro no Servidor (Essencial para Login Universal)
    if (action === 'filter') {
        let query = supabase.from('adma_content').select('data').eq('collection', collection);
        
        // Se houver critérios, aplica o filtro na coluna JSONB 'data'
        if (criteria) {
            Object.entries(criteria).forEach(([key, value]) => {
                query = query.eq(`data->>${key}`, value);
            });
        }

        const { data, error } = await query;
        if (error) throw error;
        return response.status(200).json(data ? data.map(row => row.data) : []);
    }

    // LIST
    if (action === 'list') {
        const { data, error } = await supabase
            .from('adma_content')
            .select('data')
            .eq('collection', collection);

        if (error) throw error;
        return response.status(200).json(data ? data.map(row => row.data) : []);
    }

    // GET
    if (action === 'get') {
        const { data, error } = await supabase
            .from('adma_content')
            .select('data')
            .eq('collection', collection)
            .eq('id', id.toString())
            .maybeSingle();

        if (error) throw error;
        return response.status(200).json(data ? data.data : null);
    }

    // SAVE
    if (action === 'save') {
        const finalId = (item.id || item.study_key || item.chapter_key || Date.now().toString()).toString();
        item.id = finalId;

        const { error } = await supabase
            .from('adma_content')
            .upsert({ 
                id: finalId,
                collection: collection, 
                data: item
            });

        if (error) throw error;
        return response.status(200).json({ success: true, item });
    }

    // DELETE
    if (action === 'delete') {
        const { error } = await supabase
            .from('adma_content')
            .delete()
            .eq('id', id.toString());

        if (error) throw error;
        return response.status(200).json({ success: true });
    }

    return response.status(400).json({ error: 'Ação desconhecida' });

  } catch (error) {
    console.error("Storage Proxy Error:", error.message);
    return response.status(500).json({ error: error.message });
  }
}
