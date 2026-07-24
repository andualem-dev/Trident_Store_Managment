import { StorageClient } from "@supabase/storage-js";

const DEFAULT_BUCKET = "Trident_Store_Images";

let storageClient: StorageClient | null = null;

function getSupabaseSecretKey() {
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

function isNewSupabaseApiKey(key: string) {
  return key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
}

/**
 * New-format Supabase keys (sb_secret_...) must not be sent as Bearer tokens.
 * The full supabase-js client still does that for Storage, so we use storage-js
 * directly with a fetch wrapper that only sets the apikey header.
 */
function createSupabaseStorageFetch(supabaseKey: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("apikey", supabaseKey);

    if (isNewSupabaseApiKey(supabaseKey)) {
      headers.delete("Authorization");
    } else if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${supabaseKey}`);
    }

    return fetch(input, { ...init, headers });
  };
}

export function isSupabaseStorageConfigured() {
  return Boolean(process.env.SUPABASE_URL?.trim() && getSupabaseSecretKey());
}

export function getSupabaseStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET;
}

export function getSupabaseStorageClient() {
  if (!isSupabaseStorageConfigured()) {
    throw new Error("Supabase Storage is not configured.");
  }

  if (!storageClient) {
    const baseUrl = process.env.SUPABASE_URL!.trim().replace(/\/$/, "");
    const key = getSupabaseSecretKey();

    storageClient = new StorageClient(
      `${baseUrl}/storage/v1`,
      { apikey: key },
      createSupabaseStorageFetch(key),
    );
  }

  return storageClient;
}

/** @deprecated Use getSupabaseStorageClient() */
export function getSupabaseAdminClient() {
  return getSupabaseStorageClient();
}
