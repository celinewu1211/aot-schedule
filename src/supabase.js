import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(url, key);

export async function loadData() {
  try {
    const { data, error } = await supabase.from('app_data').select('data').eq('id', 'main').single();
    if (error) throw error;
    return data?.data && Object.keys(data.data).length > 0 ? data.data : null;
  } catch { return null; }
}

export async function saveData(appData) {
  try {
    const { error } = await supabase.from('app_data').upsert({ id: 'main', data: appData, updated_at: new Date().toISOString() });
    return !error;
  } catch { return false; }
}
