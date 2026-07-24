import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { buildNewlyOverdueAlert } from "@/lib/reporting";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const alert = await buildNewlyOverdueAlert();
    if (!alert.message) {
      return NextResponse.json({
        ok: true,
        sent: false,
        count: 0,
        checkedAt: new Date().toISOString(),
      });
    }

    const messagesSent = await sendTelegramMessage(alert.message);
    return NextResponse.json({
      ok: true,
      sent: true,
      count: alert.count,
      messagesSent,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Overdue Telegram check failed", error);
    return NextResponse.json(
      { error: "Overdue check failed." },
      { status: 500 },
    );
  }
}
