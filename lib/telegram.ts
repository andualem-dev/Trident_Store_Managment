const TELEGRAM_LIMIT = 4096;
const SAFE_CHUNK_SIZE = 3900;

type TelegramResponse = {
  ok: boolean;
  description?: string;
};

function parseChatIdList(raw: string | undefined) {
  if (!raw?.trim()) {
    return [];
  }

  return raw
    .split(/[,\s]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getTelegramAdminChatIds() {
  const ids = [
    ...parseChatIdList(process.env.TELEGRAM_ADMIN_CHAT_ID),
    ...parseChatIdList(process.env.TELEGRAM_ADMIN_CHAT_IDS),
  ];

  return [...new Set(ids)];
}

export function isTelegramAdminChat(chatId: number | string | undefined) {
  if (chatId === undefined) {
    return false;
  }

  return getTelegramAdminChatIds().includes(String(chatId));
}

export function escapeTelegramHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function splitMessage(message: string) {
  if (message.length <= TELEGRAM_LIMIT) {
    return [message];
  }

  const chunks: string[] = [];
  let current = "";

  for (const line of message.split("\n")) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length <= SAFE_CHUNK_SIZE) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }
    current = line.slice(0, SAFE_CHUNK_SIZE);
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

async function sendTelegramChunks(
  token: string,
  chatId: string,
  chunks: string[],
) {
  for (const text of chunks) {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
        cache: "no-store",
      },
    );

    const result = (await response.json()) as TelegramResponse;
    if (!response.ok || !result.ok) {
      throw new Error(
        `Telegram send failed for chat ${chatId}: ${result.description ?? response.statusText}`,
      );
    }
  }
}

export async function sendTelegramMessage(
  message: string,
  options?: { chatId?: string },
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIds = options?.chatId
    ? [options.chatId]
    : getTelegramAdminChatIds();

  if (!token || chatIds.length === 0) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN and at least one admin chat ID must be configured.",
    );
  }

  const chunks = splitMessage(message);
  let messagesSent = 0;
  let lastError: Error | undefined;

  for (const chatId of chatIds) {
    try {
      await sendTelegramChunks(token, chatId, chunks);
      messagesSent += chunks.length;
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Telegram send failed.");
      console.error(`Telegram send failed for chat ${chatId}`, error);
    }
  }

  if (messagesSent === 0 && lastError) {
    throw lastError;
  }

  return messagesSent;
}
