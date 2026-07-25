import assert from "node:assert/strict";
import test from "node:test";

import {
  getTelegramAdminChatIds,
  isTelegramAdminChat,
} from "./telegram";

test("merges primary and extra admin chat ids", () => {
  process.env.TELEGRAM_ADMIN_CHAT_ID = "111,222";
  process.env.TELEGRAM_ADMIN_CHAT_IDS = "333 222";

  assert.deepEqual(getTelegramAdminChatIds(), ["111", "222", "333"]);
  assert.equal(isTelegramAdminChat(222), true);
  assert.equal(isTelegramAdminChat(999), false);

  delete process.env.TELEGRAM_ADMIN_CHAT_ID;
  delete process.env.TELEGRAM_ADMIN_CHAT_IDS;
});
