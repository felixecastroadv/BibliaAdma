import { createClient } from '@supabase/supabase-js';

export default async function handler(request, response) {
  // Configuração de Headers para permitir o funcionamento do App
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
    // 1. DETECÇÃO INTELIGENTE DE CHAVES (Baseado nos seus prints da Vercel)
    // Procuramos pela URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 
                        process.env.SUPABASE_URL ||
                        'https://nnhatyvrtlbkyfadumqo.supabase.co';
    
    // Procuramos pela Chave Anônima (Mapeando os nomes traduzidos que vimos no PDF)
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                        process.env.SUPABASE_ANON_KEY || 
                        process.env.SUPABASE_PUBLISHABLE_KEY || // Nome que aparece no seu PDF (pág 5)
                        process.env.PRÓXIMA_CHAVE_ANÔN_SUPABASE_PÚBLICA || // Tradução do navegador que vimos no print
                        process.env.PRÓXIMA_CHAVE_PÚBLICA_SUPABASE_PUB || // Outra variação do print
                        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5uaGF0eXZydGxia3lmYWR1bXFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1Mzk1NDYsImV4cCI6MjA4MTExNTU0Nn0.F_020GSnZ_jQiSSPFfAxY9Q8dU6FmjUDixOeZl4YHDg';

    // 2. VALIDAÇÃO DE CONEXÃO
    if (!supabaseUrl || !supabaseKey || !supabaseUrl.startsWith('http')) {
        console.error("ERRO: Variáveis do Supabase não encontradas no ambiente ou inválidas.");
        return response.status(500).json({ 
            error: "BANCO DE DADOS DESCONECTADO: O App não encontrou a URL ou a Chave do Supabase na Vercel.",
            help: "Verifique se a variável NEXT_PUBLIC_SUPABASE_URL está configurada corretamente."
        });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    const { action, collection, id, item, criteria } = body;

    // AÇÃO: FILTER (Essencial para Login Universal entre aparelhos)
    if (action === 'filter') {
        let query = supabase.from('adma_content').select('data').eq('collection', collection);
        
        if (criteria) {
            Object.entries(criteria).forEach(([key, value]) => {
                // Filtra dentro da coluna JSONB 'data'
                query = query.eq(`data->>${key}`, value);
            });
        }

        const { data, error } = await query;
        if (error) throw error;
        // Retorna apenas a coluna 'data' que contém o objeto do usuário/item
        return response.status(200).json(data ? data.map(row => row.data) : []);
    }

    // AÇÃO: LIST
    if (action === 'list') {
        const { data, error } = await supabase
            .from('adma_content')
            .select('data')
            .eq('collection', collection);

        if (error) throw error;
        return response.status(200).json(data ? data.map(row => row.data) : []);
    }

    // AÇÃO: GET
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

    // AÇÃO: SAVE (Upsert)
    if (action === 'save') {
        if (!item) throw new Error("Item inválido.");
        const finalId = (item.id || item.study_key || item.chapter_key || Date.now().toString()).toString();
        item.id = finalId;

        const { error } = await supabase
            .from('adma_content')
            .upsert({ 
                id: finalId,
                collection: collection, 
                data: item
            }, { onConflict: 'id' });

        if (error) throw error;
        return response.status(200).json({ success: true, item });
    }

    // AÇÃO: DELETE
    if (action === 'delete') {
        const { error } = await supabase
            .from('adma_content')
            .delete()
            .eq('id', id.toString());

        if (error) throw error;
        return response.status(200).json({ success: true });
    }

    return response.status(400).json({ error: 'Ação não suportada' });

  } catch (error) {
    console.error("Storage Critical Error:", error.message);
    return response.status(500).json({ error: error.message });
  }
}
