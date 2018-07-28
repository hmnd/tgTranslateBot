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

  bot.on("text", ctx => {
    browser.newPage().then(page =>
      page
        .goto(textToUrl(ctx.message.text), { waitUntil: "networkidle0" })
        .then(() =>
          page
            .waitForFunction(
              () =>
                document.querySelector("#result_box") !== null &&
                document
                  .querySelector("#result_box")
                  .innerText.indexOf("......") === -1
            )
            .then(() =>
              page
                .evaluate(() => {
                  const lang = document.querySelector(
                    "#gt-sl-sugg > div > div:last-child"
                  );
                  const langFormatted = lang.innerText.slice(0, lang.innerText.indexOf(" -"));
                  return langFormatted === "English"
                    ? ""
                    : document.querySelector("#result_box").innerText +
                      "\n\nDetected language: " +
                      langFormatted;
                })
                .then(text =>
                  ctx
                    .replyWithMarkdown(text, Extra.inReplyTo(ctx.message.message_id))
                    .then(page.close())
                    .catch(() => {})
                )
            )
        )
    );
  });

  bot.startPolling();
})();
