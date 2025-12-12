import express from "express";
import multer from "multer";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 測試 / 根路由
app.get("/", (req, res) => res.json({ status: "ok", msg: "Med-AI backend running" }));

// 語音轉文字 endpoint（POST /api/voice）
// 上傳一個 field 名為 "audio" 的檔案 (blob)
app.post("/api/diagnose", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Missing image file" });

    const voiceText = req.body.voice || "";
    const duration = req.body.duration || "";

    const b64 = req.file.buffer.toString("base64");

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "你是醫療初篩助手，請判斷外傷或皮膚病變，並給風險與建議。" },
            { type: "input_text", text: `症狀描述：${voiceText}` },
            { type: "input_text", text: `症狀時間：${duration}` },
            {
              type: "input_image",
              image_base64: b64
            }
          ]
        }
      ]
    });

    res.json({
      result: response.output_text
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI analysis failed" });
  }
});

// 圖片 + 簡單問診 endpoint（POST /api/diagnose）
// 上傳一個 field 名為 "image" 的檔案，還可以帶 form fields: voice, duration
app.post("/api/diagnose", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Missing image file" });

    const voiceText = req.body.voice || "";
    const duration = req.body.duration || "";

    // 把 image 轉成 base64 data URI，送給模型
    const b64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${b64}`;

    // 用 Chat/vision 模型做初判（示範）
    const chatResponse = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [
    {
      role: "user",
      content: `
你是醫療初篩助手。

症狀描述：${voiceText}
症狀時間：${duration}

請回覆：
1. 分類（外傷 / 皮膚病變 / 其他）
2. 風險（低 / 中 / 高）
3. 建議（觀察 / 門診 / 急診）
`
    }
  ],
  max_tokens: 300
});


    const answer = chatResponse.choices?.[0]?.message?.content ?? JSON.stringify(chatResponse);

    return res.json({ result: answer });
  } catch (err) {
    console.error("diagnose error:", err);
    return res.status(500).json({ error: "Failed to analyze image", detail: String(err) });
  }
});

// PORT from env (Railway will provide this), default 3000
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
