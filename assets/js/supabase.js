
import { createClient } from
  "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL =
  "https://bvhxzbmgaejdmuiowfhy.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_wjU-j9gFJnXhGDxwcRMFJw_eSGkKkZD";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);
