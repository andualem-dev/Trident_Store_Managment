import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/session-server";
import { readUpload } from "@/lib/uploads";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const session = await getSession();
  if (!session.isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path: segments } = await context.params;
  const relativePath = segments.join("/");
  const upload = await readUpload(relativePath);

  if (!upload) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(upload.data), {
    headers: {
      "Content-Type": upload.contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
