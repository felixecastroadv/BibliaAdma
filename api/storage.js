import { createClient } from '@supabase/supabase-js';

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

  if (request.method === 'OPTIONS') return response.status(200).end();

  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || MANUAL_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || MANUAL_SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) return response.status(500).json({ error: "Credenciais ausentes." });

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { method } = request;
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

    // PING REAL
    if (method === 'POST' && body.action === 'ping') {
        const { error } = await supabase.from('adma_content').select('id').limit(1);
        if (error) throw error;
        return response.status(200).json({ status: 'ok' });
    }

    // CONTAGEM REAL (Para estratégia de alimentação)
    if (method === 'POST' && body.action === 'count') {
        const { collection } = body;
        const { count, error } = await supabase
            .from('adma_content')
            .select('*', { count: 'exact', head: true })
            .eq('collection', collection);
        if (error) throw error;
        return response.status(200).json({ count: count || 0 });
    }

    // LISTAGEM PADRÃO
    if (method === 'POST' && body.action === 'list') {
        const { collection } = body;
        const { data, error } = await supabase.from('adma_content').select('data').eq('collection', collection);
        if (error) throw error;
        return response.status(200).json(data ? data.map(row => row.data) : []);
    }

    // GET POR ID
    if (method === 'POST' && body.action === 'get') {
        const { collection, id } = body;
        const { data, error } = await supabase.from('adma_content').select('data').eq('collection', collection).eq('id', id.toString()).maybeSingle();
        if (error) throw error;
        return response.status(200).json(data ? data.data : null);
    }

    // SALVAMENTO (UPSERT)
    if (method === 'POST' && body.action === 'save') {
        const { collection, item } = body;
        if (!item.id) item.id = Date.now().toString();
        const { error } = await supabase.from('adma_content').upsert({ id: item.id.toString(), collection: collection, data: item });
        if (error) throw error;
        return response.status(200).json({ success: true, item });
    }

    // EXCLUSÃO
    if (method === 'POST' && body.action === 'delete') {
        const { id } = body;
        const { error } = await supabase.from('adma_content').delete().eq('id', id.toString());
        if (error) throw error;
        return response.status(200).json({ success: true });
    }

    return response.status(400).json({ error: 'Ação inválida' });
  } catch (error) {
    return response.status(500).json({ error: error.message });
  }
}