import { StorageClient } from "@supabase/storage-js";

const DEFAULT_BUCKET = "Trident_Store_Images";

function isLegacyJwt(key: string) {
  return key.startsWith("eyJ");
}

function getSupabaseStorageCredentials() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim() || "";

  const jwt =
    (isLegacyJwt(serviceRoleKey) ? serviceRoleKey : "") ||
    (isLegacyJwt(secretKey) ? secretKey : "");

  if (!jwt) {
    throw new Error(
      "Supabase Storage needs a legacy service_role JWT. " +
        "Supabase → Settings → API → Legacy API keys → copy service_role into SUPABASE_SERVICE_ROLE_KEY. " +
        "sb_secret_... keys cannot be used in the Authorization header.",
    );
  }

  // Storage accepts the legacy JWT for both headers. sb_secret is not a JWT and
  // must never be sent as Authorization (Invalid Compact JWS).
  return { apiKey: jwt, authToken: jwt };
}

function supabaseStorageHeaders(apiKey: string, authToken: string) {
  return {
    apikey: apiKey,
    Authorization: `Bearer ${authToken}`,
  };
}

function createSupabaseStorageFetch(
  apiKey: string,
  authToken: string,
): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set("apikey", apiKey);

    if (!headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }

    return fetch(input, { ...init, headers });
  };
}

export function isSupabaseStorageConfigured() {
  if (!process.env.SUPABASE_URL?.trim()) {
    return false;
  }

  try {
    getSupabaseStorageCredentials();
    return true;
  } catch {
    return false;
  }
}

export function getSupabaseStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET;
}

export function getSupabaseStorageClient() {
  if (!process.env.SUPABASE_URL?.trim()) {
    throw new Error("Supabase Storage is not configured.");
  }

  const baseUrl = process.env.SUPABASE_URL!.trim().replace(/\/$/, "");
  const { apiKey, authToken } = getSupabaseStorageCredentials();

  return new StorageClient(
    `${baseUrl}/storage/v1`,
    supabaseStorageHeaders(apiKey, authToken),
    createSupabaseStorageFetch(apiKey, authToken),
  );
}

/** @deprecated Use getSupabaseStorageClient() */
export function getSupabaseAdminClient() {
  return getSupabaseStorageClient();
}
