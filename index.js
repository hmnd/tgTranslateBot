require("dotenv").config();
const Telegraf = require("telegraf");
const Extra = require("telegraf/extra");
const puppeteer = require("puppeteer");
const winston = require("winston");

const bot = new Telegraf(process.env.BOT_TOKEN);

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" })
  ]
});

(async () => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true
  });
  const textToUrl = text =>
    "https://translate.google.com/#auto/en/" + encodeURIComponent(text);
  const doTranslate = async ctx => {
    const page = await browser.newPage();
    await page
      .goto(textToUrl(ctx.message.text), {
        waitUntil: "networkidle0",
        timeout: 0
      })
      .catch(() => {
        console.log("failed, retrying");
        return doTranslate(ctx);
      });
    await page.waitForFunction(
      () =>
        document.querySelector("#result_box") !== null &&
        document.querySelector("#result_box").innerText.indexOf("......") === -1
    );
    const text = await page.evaluate(() => {
      const lang = document.querySelector("#gt-sl-sugg > div > div:last-child")
        .innerText;
      if (lang.includes("-") && !lang.includes("English")) {
        const langFormatted = lang.slice(0, lang.indexOf(" -"));
        return (
          document.querySelector("#result_box").innerText +
          "\n\nDetected language: " +
          langFormatted
        );
      }
      return "";
    });
    if (text.length > 0) {
      await ctx
        .replyWithMarkdown(text, Extra.inReplyTo(ctx.message.message_id))
        .catch(() => {});
    }
    await page.close();
  };

  bot.on("text", ctx => {
    doTranslate(ctx).catch((e) => { logger.error(e) };
  });

  bot.startPolling();
})();
