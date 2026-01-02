
import { createClient } from '@supabase/supabase-js';

// Inicialização utilizando as variáveis de ambiente presentes no print do usuário
export default async function handler(request, response) {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { action, collection, id, item } = request.body;

  try {
    // Busca lista de documentos na coleção (ex: panorama_biblico, devotionals)
    if (action === 'list') {
        const { data, error } = await supabase.from('adma_content').select('data').eq('collection', collection);
        if (error) throw error;
        return response.status(200).json(data.map(d => d.data));
    }
    // Busca item único por ID
    if (action === 'get') {
        const { data, error } = await supabase.from('adma_content').select('data').eq('collection', collection).eq('id', id).maybeSingle();
        if (error) throw error;
        return response.status(200).json(data?.data || null);
    }
    // Salva ou atualiza (Upsert)
    if (action === 'save') {
        const { error } = await supabase.from('adma_content').upsert({ id: item.id, collection, data: item });
        if (error) throw error;
        return response.status(200).json({ success: true });
    }
    // Deleta item
    if (action === 'delete') {
        const { error } = await supabase.from('adma_content').delete().eq('id', id);
        if (error) throw error;
        return response.status(200).json({ success: true });
    }
    return response.status(400).json({ error: 'Ação inválida' });
  } catch (err) {
    console.error("Supabase Error:", err.message);
    return response.status(500).json({ error: err.message });
  }
}

/**
 * INSTRUÇÃO SQL PARA O USUÁRIO (Criar no Supabase Editor):
 * 
 * create table adma_content (
 *   id text primary key,
 *   collection text not null,
 *   data jsonb not null,
 *   created_at timestamp with time zone default timezone('utc'::text, now()) not null
 * );
 * 
 * alter table adma_content enable row level security;
 * create policy "Public access" on adma_content for all using (true);
 */
