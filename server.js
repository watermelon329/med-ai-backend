import express from "express";
import multer from "multer";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY
});

// 測試 / 根路由
app.get("/", (req, res) => res.json({ status: "ok", msg: "Med-AI backend running" }));

// 語音轉文字 endpoint（POST /api/voice）
// 上傳一個 field 名為 "audio" 的檔案 (blob)
app.post("/api/voice", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "Missing audio file" });

    // 使用 OpenAI 的 audio transcription endpoint
    // 這是示範呼叫，實際的 SDK 方法名可能隨版本不同，請依你安裝的 openai 套件文件為準
    const transcription = await openai.audio.transcriptions.create({
      file: req.file.buffer,
      model: "gpt-4o-transcribe" // 若你的帳號沒有此模型，請改為你能用的 ASR 模型
    });

    return res.json({ text: transcription.text ?? transcription });
  } catch (err) {
    console.error("voice error:", err);
    return res.status(500).json({ error: "Failed to transcribe audio", detail: String(err) });
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
      model: "gpt-4o-mini-vision", // 若無此模型，請改為可用的 multimodal model
      messages: [
        { role: "user", content: "你是醫療初篩助手。請幫我判斷下列影像與敘述，給出：1) 分類 (外傷 / 皮膚病變 / 其他) 2) 初步風險 (低/中/高) 3) 建議（例如：觀察 / 門診 / 急診）" },
        { role: "user", content: `語音摘要：${voiceText}\n症狀時間：${duration}` },
        { role: "user", content: dataUrl }
      ],
      max_tokens: 400
    });

    const answer = chatResponse.choices?.[0]?.message?.content ?? JSON.stringify(chatResponse);

    return res.json({ result: answer });
  } catch (err) {
    console.error("diagnose error:", err);
    return res.status(500).json({ error: "Failed to analyze image", detail: String(err) });
  }
});

// PORT from env (Railway will provide this), default 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
