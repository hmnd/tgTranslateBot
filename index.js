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
      filename: "combined.log"
    })
  ]
});

(async () => {
  const browser = await puppeteer.launch({
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
    headless: true
  });
  const textToUrl = text =>
    "https://translate.google.com/#auto/en/" + encodeURIComponent(text);
  const doTranslate = async inText => {
    const page = await browser.newPage();
    await page
      .goto(textToUrl(inText), {
        waitUntil: "networkidle0",
        timeout: 0
      })
      .catch(() => {
        console.log("failed, retrying");
        return doTranslate(inText);
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
    return text
    await page.close();
  };

  bot.on("text", ctx => {
    doTranslate(ctx.message.text).then(translation => {
      if (translation.length > 0) {
        ctx
          .replyWithMarkdown(translation, Extra.inReplyTo(ctx.message.message_id))
          .catch(e => logger.error(e));
      }
    }).catch(e => logger.error(e));
  });

  bot.on("inline_query", ctx => {
    doTranslate(ctx.inlineQuery.query).then(translation => {
      if (translation.length > 0) {
        ctx.answerInlineQuery([{
          type: 'article',
          id: 0,
          title: 'Translation',
          description: translation,
          input_message_content: {
            message_text: translation,
            parse_mode: Extra.markdown
          }
        }])
      } else {
        ctx.answerInlineQuery([], {
          switch_pm_text: 'No translation available',
          switch_pm_parameter: 'no_trans_inline'
        })
      }
    }).catch(e => logger.error(e))
  })

  bot.startPolling();
})();