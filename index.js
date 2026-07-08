import express from "express";
import { Client, middleware } from "@line/bot-sdk";
import { google } from "googleapis";
import dayjs from "dayjs";

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

const app = express();
app.use(middleware(config));

const client = new Client(config);

// Google OAuth2 設定
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

// Google カレンダー API
const calendar = google.calendar({ version: "v3", auth: oauth2Client });

// LINE Webhook
app.post("/webhook", async (req, res) => {
  const events = req.body.events;

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const text = event.message.text;

      // 日付解析（例：7/10 15:00 歯医者）
      const match = text.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})\s*(.*)/);

      if (!match) {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "予定の形式は「7/10 15:00 歯医者」のように送ってください。",
        });
        continue;
      }

      const [, month, day, hour, minute, title] = match;

      const start = dayjs()
        .month(month - 1)
        .date(day)
        .hour(hour)
        .minute(minute)
        .second(0);

      const end = start.add(1, "hour");

      // Google カレンダーに予定を登録
      await calendar.events.insert({
        calendarId: "primary",
        requestBody: {
          summary: title || "予定",
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        },
      });

      // LINE に返信
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `予定を登録しました：${title}（${month}/${day} ${hour}:${minute}）`,
      });
    }
  }

  res.status(200).end();
});

// サーバー起動
app.listen(10000, () => {
  console.log("LINE Calendar Bot is running on port 10000");
});
