
import { createClient } from '@supabase/supabase-js';

// --- CONFIGURAÇÃO MANUAL (FALLBACK) ---
// Se as variáveis de ambiente falharem, o sistema usará estes dados automaticamente.
const MANUAL_SUPABASE_URL = "https://nnhatyvrtlbkyfadumqo.supabase.co";
const MANUAL_SUPABASE_KEY = "sb_publishable_0uZeWa8FXTH-u-ki_NRHsQ_nYALzy9j";

export default async function handler(request, response) {
  response.setHeader('Access-Control-Allow-Credentials', true);
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

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
        console.error("Supabase credentials missing.");
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
        
        if (error) {
             console.error("Supabase Ping Error:", error);
             if (error.message.includes('relation "adma_content" does not exist') || error.code === '42P01') {
                 return response.status(500).json({ error: 'TABELA INEXISTENTE: A conexão funcionou, mas a tabela "adma_content" não existe. Crie-a no SQL Editor do Supabase.' });
             }
             return response.status(500).json({ error: `Erro de Conexão: ${error.message}` });
        }
        return response.status(200).json({ status: 'ok', message: 'Conectado ao Supabase com sucesso.' });
    }

    // LIST (Busca tudo de uma coleção)
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

    // GET (Busca um item específico por ID - NOVO)
    if (method === 'POST' && body.action === 'get') {
        const { collection, id } = body;
        const { data, error } = await supabase
            .from('adma_content')
            .select('data')
            .eq('collection', collection)
            .eq('id', id.toString())
            .maybeSingle(); // Usa maybeSingle para não estourar erro se não achar

        if (error) throw error;
        return response.status(200).json(data ? data.data : null);
    }

    // SAVE (Cria ou Atualiza)
    if (method === 'POST' && body.action === 'save') {
        const { collection, item } = body;
        if (!item.id) item.id = Date.now().toString();

        const { error } = await supabase
            .from('adma_content')
            .upsert({ 
                id: item.id.toString(),
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
    console.error("Supabase Handler Error:", error);
    return response.status(500).json({ error: error.message || "Erro interno no servidor de banco de dados" });
  }
}
