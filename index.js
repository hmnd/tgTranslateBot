require("dotenv").config();
const Telegraf = require("telegraf");
const Extra = require("telegraf/extra");
const puppeteer = require("puppeteer");

const bot = new Telegraf(process.env.BOT_TOKEN);

(async () => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true
  });
  const textToUrl = text =>
    "https://translate.google.com/#auto/en/" + encodeURIComponent(text);

  bot.on("text", async ctx => {
    const page = await browser.newPage();
    await page.goto(textToUrl(ctx.message.text), { waitUntil: "networkidle0" });
    await page.waitForFunction(
      () =>
        document.querySelector("#result_box") !== null &&
        document.querySelector("#result_box").innerText.indexOf("......") === -1
    );
    const text = await page.evaluate(() => {
      const lang = document.querySelector("#gt-sl-sugg > div > div:last-child");
      const langFormatted = lang.innerText.slice(
        0,
        lang.innerText.indexOf(" -")
      );
      return langFormatted === "English"
        ? ""
        : document.querySelector("#result_box").innerText +
            "\n\nDetected language: " +
            langFormatted;
    });
    if (text.length > 0) {
      ctx
        .replyWithMarkdown(text, Extra.inReplyTo(ctx.message.message_id))
        .then(page.close())
        .catch(() => {});
    }
  });

  bot.startPolling();
})();
