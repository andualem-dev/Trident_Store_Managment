import { NextResponse } from "next/server";

import {
  buildDailyReport,
  buildOverdueReport,
  buildTopCustomersReport,
} from "@/lib/reporting";
import { sendTelegramMessage } from "@/lib/telegram";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    text?: string;
    chat?: {
      id?: number;
    };
  };
};

const HELP_MESSAGE = [
  "<b>Trident Store Bot Commands</b>",
  "",
  "/report or /today — Daily summary",
  "/overdue — Current overdue rentals",
  "/top — Top customers this month",
  "/help — Available commands",
].join("\n");

function commandFromText(text: string | undefined) {
  const firstToken = text?.trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
  return firstToken.split("@", 1)[0];
}

export async function POST(request: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("TELEGRAM_WEBHOOK_SECRET is not configured");
    return NextResponse.json(
      { error: "Webhook is not configured." },
      { status: 503 },
    );
  }

  if (
    request.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  }

  const configuredChatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();
  const incomingChatId = update.message?.chat?.id;

  if (
    !configuredChatId ||
    incomingChatId === undefined ||
    String(incomingChatId) !== configuredChatId
  ) {
    // Return 200 so Telegram does not retry unauthorized or irrelevant updates.
    return NextResponse.json({ ok: true, ignored: true });
  }

  const command = commandFromText(update.message?.text);

  try {
    let response: string;
    switch (command) {
      case "/report":
      case "/today":
        response = await buildDailyReport();
        break;
      case "/overdue":
        response = await buildOverdueReport();
        break;
      case "/top":
        response = await buildTopCustomersReport();
        break;
      case "/help":
        response = HELP_MESSAGE;
        break;
      default:
        response = "Unknown command. Send /help to see available commands.";
    }

    const messagesSent = await sendTelegramMessage(response);
    return NextResponse.json({ ok: true, messagesSent });
  } catch (error) {
    console.error("Telegram webhook command failed", error);
    return NextResponse.json(
      { error: "Could not process Telegram command." },
      { status: 500 },
    );
  }
}
