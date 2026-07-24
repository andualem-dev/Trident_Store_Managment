import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { buildDailyReport } from "@/lib/reporting";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const message = await buildDailyReport();
    const messagesSent = await sendTelegramMessage(message);
    return NextResponse.json({
      ok: true,
      messagesSent,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Daily Telegram report failed", error);
    return NextResponse.json(
      { error: "Daily report failed." },
      { status: 500 },
    );
  }
}
