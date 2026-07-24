const DEFAULT_BUCKET = "Trident_Store_Images";

function isServiceRoleJwt(key: string) {
  return key.startsWith("eyJ");
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL?.trim().replace(/\/$/, "") || "";
}

/** Legacy service_role JWT only — sb_secret keys must not be used for Storage auth. */
export function getSupabaseServiceRoleJwt() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  const secret = process.env.SUPABASE_SECRET_KEY?.trim() || "";

  if (isServiceRoleJwt(serviceRole)) {
    return serviceRole;
  }
  if (isServiceRoleJwt(secret)) {
    return secret;
  }

  throw new Error(
    "Supabase photo storage requires SUPABASE_SERVICE_ROLE_KEY (legacy service_role JWT). " +
      "Supabase → Settings → API → Legacy API keys → copy service_role. " +
      "Do not use sb_secret_... for Storage Authorization.",
  );
}

function storageAuthHeaders(jwt: string) {
  return {
    apikey: jwt,
    Authorization: `Bearer ${jwt}`,
  };
}

function storageObjectUrl(bucket: string, objectPath: string) {
  const encodedBucket = encodeURIComponent(bucket);
  const encodedPath = objectPath
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");

  return `${getSupabaseUrl()}/storage/v1/object/${encodedBucket}/${encodedPath}`;
}

function parseStorageError(body: string, status: number) {
  try {
    const json = JSON.parse(body) as {
      message?: string;
      error?: string;
      statusCode?: string;
    };
    return json.message || json.error || `Storage request failed (${status})`;
  } catch {
    return body.trim() || `Storage request failed (${status})`;
  }
}

export function isSupabaseStorageConfigured() {
  if (!getSupabaseUrl()) {
    return false;
  }

  try {
    getSupabaseServiceRoleJwt();
    return true;
  } catch {
    return false;
  }
}

export function getSupabaseStorageBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || DEFAULT_BUCKET;
}

export async function uploadToSupabaseStorage(
  objectPath: string,
  body: Buffer,
  contentType: string,
) {
  const jwt = getSupabaseServiceRoleJwt();
  const bucket = getSupabaseStorageBucket();
  const url = storageObjectUrl(bucket, objectPath);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...storageAuthHeaders(jwt),
      "content-type": contentType,
      "cache-control": "max-age=3600",
      "x-upsert": "false",
    },
    body: new Uint8Array(body),
  });

  if (!response.ok) {
    throw new Error(parseStorageError(await response.text(), response.status));
  }
}

export async function downloadFromSupabaseStorage(objectPath: string) {
  const jwt = getSupabaseServiceRoleJwt();
  const bucket = getSupabaseStorageBucket();
  const url = storageObjectUrl(bucket, objectPath);

  const response = await fetch(url, {
    method: "GET",
    headers: storageAuthHeaders(jwt),
  });

  if (!response.ok) {
    return null;
  }

  const data = Buffer.from(await response.arrayBuffer());
  return {
    data,
    contentType: response.headers.get("content-type") || "application/octet-stream",
  };
}
