
import { createClient } from '@supabase/supabase-js';

// Garantimos que as chaves do Supabase sejam lidas corretamente do ambiente Vercel
export default async function handler(request, response) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return response.status(500).json({ error: "Configuração do Supabase ausente na Vercel." });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { action, collection, id, item } = request.body;

  try {
    if (action === 'list') {
        const { data, error } = await supabase
            .from('adma_content')
            .select('data')
            .eq('collection', collection);
        
        if (error) throw error;
        return response.status(200).json(data ? data.map(d => d.data) : []);
    }

    if (action === 'get') {
        const { data, error } = await supabase
            .from('adma_content')
            .select('data')
            .eq('collection', collection)
            .eq('id', id)
            .maybeSingle();
        
        if (error) throw error;
        return response.status(200).json(data?.data || null);
    }

    if (action === 'save') {
        if (!item || !item.id) throw new Error("Item ou ID inválido para salvamento.");
        const { error } = await supabase
            .from('adma_content')
            .upsert({ id: item.id, collection, data: item });
        
        if (error) throw error;
        return response.status(200).json({ success: true });
    }

    if (action === 'delete') {
        const { error } = await supabase
            .from('adma_content')
            .delete()
            .eq('id', id);
        
        if (error) throw error;
        return response.status(200).json({ success: true });
    }

    return response.status(400).json({ error: 'Ação de storage desconhecida.' });
  } catch (err) {
    console.error("Erro na Base de Dados Supabase:", err.message);
    return response.status(500).json({ error: `Erro de Conexão: ${err.message}` });
  }
}
