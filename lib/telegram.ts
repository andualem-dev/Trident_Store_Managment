const TELEGRAM_LIMIT = 4096;
const SAFE_CHUNK_SIZE = 3900;

type TelegramResponse = {
  ok: boolean;
  description?: string;
};

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

export async function sendTelegramMessage(message: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;

  if (!token || !chatId) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID must be configured.",
    );
  }

  const chunks = splitMessage(message);
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
        `Telegram send failed: ${result.description ?? response.statusText}`,
      );
    }
  }

  return chunks.length;
}
