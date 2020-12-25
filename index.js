require('dotenv').config();
const Telegraf = require('telegraf');
const Extra = require('telegraf/extra');
const winston = require('winston');
const { titleCase } = require('title-case');
const translate = require('@vitalets/google-translate-api');
const languages = require('@vitalets/google-translate-api/languages');

const tokens = (process.env.BOT_TOKEN || []).split(',');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'debug.log',
      level: 'debug',
    }),
  ],
});

tokens.forEach((token) => {
  const bot = new Telegraf(token);

  bot.on('text', async (ctx) => {
    try {
      const translateTo = 'en';
      const translation = await translate(ctx.message.text, { to: 'en' });

      if (translation && translation.from.language.iso !== translateTo) {
        const fromLang = translation.from.language.iso;
        return ctx.replyWithMarkdown(
          `${translation.text}\n\nDetected language: ${
            languages[fromLang] || fromLang
          }`,
          Extra.inReplyTo(ctx.message.message_id)
        );
      }
    } catch (e) {
      logger.error(e);
    }
  });

  bot.on('inline_query', async (ctx) => {
    try {
      const { query } = ctx.inlineQuery;
      if (query && query.trim().length === 0) {
        return ctx.answerInlineQuery([], {
          switch_pm_text: 'Enter some text to translate',
          switch_pm_parameter: 'empty_inline',
        });
      }
      const translateTo = 'en';
      const translation = await translate(ctx.inlineQuery.query, {
        to: translateTo,
      });
      console.log(languages[translateTo]);
      if (translation) {
        const fromLang = translation.from.language.iso;
        return ctx.answerInlineQuery([
          {
            type: 'article',
            id: 0,
            title: `Translation (${languages[fromLang] || fromLang} => ${
              languages[translateTo]
            })`,
            description: translation.text,
            input_message_content: {
              message_text: translation.text,
              parse_mode: Extra.markdown,
            },
          },
          {
            type: 'article',
            id: 1,
            title: 'Translation - with translated text',
            description:
              'Sends translated text, translation, and detected language.',
            input_message_content: {
              message_text: `*Original*: ${ctx.inlineQuery.query}\n*Translation*: ${translation.text}`,
              parse_mode: 'Markdown',
            },
          },
        ]);
      }
      return ctx.answerInlineQuery([], {
        switch_pm_text: 'No translation found for inputted text.',
        switch_pm_parameter: 'no_trans_inline',
      });
    } catch (e) {
      logger.error(e);
    }
  });

  bot.startPolling();
});
