
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO MANUAL (FALLBACK) ---
const MANUAL_SUPABASE_URL = "https://nnhatyvrtlbkyfadumqo.supabase.co";
const MANUAL_SUPABASE_KEY = "sb_publishable_0uZeWa8FXTH-u-ki_NRHsQ_nYALzy9j";

export default async function handler(request, response) {
  // CONFIGURAÇÃO DE SEGURANÇA E CACHE
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // O PULO DO GATO: Cache de Borda (Vercel Edge Cache)
  // s-maxage=3600: Cache no servidor da Vercel por 1 hora
  // stale-while-revalidate=86400: Serve o cache antigo enquanto atualiza em background por até 1 dia
  response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600'); // Reduzido para maior agilidade em atualizações

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL || 
                        process.env.NEXT_PUBLIC_SUPABASE_URL || 
                        MANUAL_SUPABASE_URL;
    
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
                        MANUAL_SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        return response.status(500).json({ 
            error: "BANCO DE DADOS DESCONECTADO: As credenciais do Supabase não foram encontradas." 
        });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { method } = request;
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

    // Health Check
    if (method === 'POST' && body.action === 'ping') {
        const { error } = await supabase.from('adma_content').select('id').limit(1);
        if (error) return response.status(500).json({ error: error.message });
        return response.status(200).json({ status: 'ok' });
    }

    // LIST (Retorna TUDO - Cuidado com coleções grandes!)
    if (method === 'POST' && body.action === 'list') {
        const { collection } = body;
        const { data, error } = await supabase
            .from('adma_content')
            .select('data')
            .eq('collection', collection);

        if (error) throw error;
        const cleanList = data ? data.map(row => row.data) : [];
        return response.status(200).json(cleanList);
    }

    // LIST MINIMAL (Ação para economizar banda e contornar limite da Vercel)
    if (method === 'POST' && body.action === 'list_minimal') {
        const { collection } = body;
        // Seleciona apenas id e campos básicos do JSONB data para evitar carregar student_content/teacher_content
        const { data, error } = await supabase
            .from('adma_content')
            .select('id, data->title, data->study_key, data->book, data->chapter')
            .eq('collection', collection);

        if (error) throw error;
        return response.status(200).json(data || []);
    }

    // GET
    if (method === 'POST' && body.action === 'get') {
        const { collection, id } = body;
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
    if (method === 'POST' && body.action === 'save') {
        const { collection, item } = body;
        // Garante que o ID seja consistente para permitir GET direto
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
    if (method === 'POST' && body.action === 'delete') {
        const { id } = body;
        const { error } = await supabase
            .from('adma_content')
            .delete()
            .eq('id', id.toString());

        if (error) throw error;
        return response.status(200).json({ success: true });
    }

    return response.status(400).json({ error: 'Ação desconhecida' });

  } catch (error) {
    return response.status(500).json({ error: error.message || "Erro interno no servidor" });
  }
}
