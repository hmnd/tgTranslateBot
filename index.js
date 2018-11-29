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
    new winston.transports.File({
      filename: "error.log",
      level: "error"
    }),
    new winston.transports.File({
      filename: "debug.log",
      level: "debug"
    })
  ]
});

const textToUrl = (text, lang = "en") =>
  `https://translate.google.com/#view=home&op=translate&sl=auto&tl=${lang}&text=${encodeURIComponent(text)}`;

(async () => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true
  });
  const translateText = async inText => {
    if (!inText.trim().length) {
      return null;
    }
    const page = await browser.newPage();
    await page
      .goto(textToUrl(inText), {
        waitUntil: "networkidle0",
        timeout: 0
      })
      .catch(e => logger.error(e).then(translateText(inText)));
    await page.waitForFunction(
      () =>
      document.querySelector("span.tlid-translation") !== null &&
      document.querySelector("span.tlid-translation").innerText.indexOf("......") === -1
    );
    const translation = await page.evaluate(() => {
      const isNotSourceLang = (sourceLang, destLang) =>
        !sourceLang.includes(destLang);
      const extractLang = lang => lang.slice(0, lang.indexOf(" -")) || null;
      const lang = document.querySelector("div.sl-sugg-button-container > div:first-child")
        .innerText;
      if (lang === "DETECT LANGUAGE") {
        return null;
      }
      const langName = extractLang(lang);
      if (langName && isNotSourceLang(lang, "ENGLISH")) {
        return `${
          document.querySelector("span.tlid-translation").innerText
        }\n\nDetected language: ${langName.charAt(0) + langName.slice(1).toLowerCase()}`;
      }
      return null;
    });
    await page.close();
    return translation;
  };

  bot.on("text", ctx => {
    translateText(ctx.message.text)
      .then(translation => {
        if (translation) {
          ctx
            .replyWithMarkdown(
              translation,
              Extra.inReplyTo(ctx.message.message_id)
            )
            .catch(e => logger.error(e));
        }
      })
      .catch(e => logger.error(e));
  });

  bot.on("inline_query", ctx => {
    translateText(ctx.inlineQuery.query)
      .catch(e => logger.error(e))
      .then(translation => {
        if (translation) {
          ctx.answerInlineQuery([{
              type: "article",
              id: 0,
              title: "Translation",
              description: "Sends translation and detected language.",
              input_message_content: {
                message_text: translation,
                parse_mode: Extra.markdown
              }
            },
            {
              type: "article",
              id: 1,
              title: "Translation - with translated text",
              description: `Sends translated text, translation, and detected language.`,
              input_message_content: {
                message_text: `*Translated*: ${
                  ctx.inlineQuery.query
                }\n*Translation*: ${translation}`,
                parse_mode: "Markdown"
              }
            }
          ]);
        } else {
          ctx.answerInlineQuery([], {
            switch_pm_text: "No translation found for inputted text.",
            switch_pm_parameter: "no_trans_inline"
          });
        }
      })
      .catch(e => logger.error(e));
  });

  bot.startPolling();
})();