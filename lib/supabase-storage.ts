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

function supabaseStorageHeaders(supabaseKey: string) {
  return {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
  };
}

/**
 * Storage requires both apikey and Authorization. For new sb_secret keys, Supabase
 * accepts Authorization when it matches apikey (see API keys migration docs).
 */
function createSupabaseStorageFetch(supabaseKey: string): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("apikey", supabaseKey);

    if (!headers.has("Authorization")) {
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
      supabaseStorageHeaders(key),
      createSupabaseStorageFetch(key),
    );
  }

  return storageClient;
}

/** @deprecated Use getSupabaseStorageClient() */
export function getSupabaseAdminClient() {
  return getSupabaseStorageClient();
}
