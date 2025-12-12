import { createClient } from '@supabase/supabase-js';

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
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    
    // ATUALIZAÇÃO: Suporte para chaves antigas (ANON) e novas (PUBLISHABLE_DEFAULT) do Supabase
    const supabaseKey = process.env.SUPABASE_ANON_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
                        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("Supabase credentials missing.");
        return response.status(500).json({ 
            error: "BANCO DE DADOS DESCONECTADO: Configure SUPABASE_URL e a CHAVE (ANON ou PUBLISHABLE) na Vercel." 
        });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { method } = request;
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

    // Health Check / Table Verify
    if (method === 'POST' && body.action === 'ping') {
        // Try to select just one row to verify table existence and connection
        const { error } = await supabase.from('adma_content').select('id').limit(1);
        
        if (error) {
             console.error("Supabase Ping Error:", error);
             if (error.message.includes('relation "adma_content" does not exist') || error.code === '42P01') {
                 return response.status(500).json({ error: 'TABELA INEXISTENTE: Crie a tabela "adma_content" no SQL Editor do Supabase.' });
             }
             return response.status(500).json({ error: `Erro de Conexão: ${error.message}` });
        }
        return response.status(200).json({ status: 'ok', message: 'Conectado ao Supabase com sucesso.' });
    }

    if (method === 'POST' && body.action === 'list') {
        const { collection } = body;
        const { data, error } = await supabase
            .from('adma_content')
            .select('data')
            .eq('collection', collection);

        if (error) {
            console.error("List Error:", error);
            throw error;
        }
        const cleanList = data ? data.map(row => row.data) : [];
        return response.status(200).json(cleanList);
    }

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

        if (error) {
            console.error("Save Error:", error);
            throw error;
        }
        return response.status(200).json({ success: true, item });
    }

    if (method === 'POST' && body.action === 'delete') {
        const { id } = body;
        const { error } = await supabase
            .from('adma_content')
            .delete()
            .eq('id', id.toString());

        if (error) {
            console.error("Delete Error:", error);
            throw error;
        }
        return response.status(200).json({ success: true });
    }

    return response.status(400).json({ error: 'Ação desconhecida' });

  } catch (error) {
    console.error("Supabase Handler Error:", error);
    return response.status(500).json({ error: error.message || "Erro interno no servidor de banco de dados" });
  }
}