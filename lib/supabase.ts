
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xknlfzesunmzhcrclpsv.supabase.co';
const supabaseKey = 'sb_publishable_QRNxyZTituj8mCj6WqIkVQ_4ONOQeQY';

export const supabase = createClient(supabaseUrl, supabaseKey);
