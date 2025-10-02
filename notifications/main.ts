import { createBot } from "./bot/bot.ts";
import { config } from "./config/env.ts";
import { createConnection } from "./db/connection.ts";
import { createServer } from "./server/server.ts";

async function main() {
  const db = createConnection();
  const bot = createBot(db, config.TELEGRAM_BOT_TOKEN);
  const server = createServer(db, bot);

  await Promise.all([
    bot.start(),
    server.listen({
      port: 3000,
      listenTextResolver: (address) => `Server is listening on http://${address}`,
    }),
  ]);
}

main();
