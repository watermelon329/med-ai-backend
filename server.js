import express from "express";
import multer from "multer";
import cors from "cors";
import OpenAI from "openai";

const app = express();
app.use(cors());
app.use(express.json());

// multer：記憶體儲存
const upload = multer({ storage: multer.memoryStorage() });

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// 健康檢查
app.get("/", (req, res) => {
  res.json({ status: "ok", msg: "Med-AI backend running" });
});

// 圖片 + 症狀 AI 初篩
app.post("/api/diagnose", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Missing image file" });
    }

    const voiceText = req.body.voice || "（未提供）";
    const duration = req.body.duration || "（未提供）";

    // 圖片轉 base64
    const imageBase64 = req.file.buffer.toString("base64");

    const response = await openai.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
你是醫療初篩輔助系統（非正式診斷）。

請根據「圖片 + 症狀描述」判斷：
1. 類型（外傷 / 皮膚病變 / 其他）
2. 風險等級（低 / 中 / 高）
3. 建議行動（觀察 / 門診 / 急診）

症狀描述：${voiceText}
症狀持續時間：${duration}
`
            },
            {
              type: "input_image",
              image_base64: imageBase64
            }
          ]
        }
      ],
      max_output_tokens: 300
    });

    // 安全取文字輸出
    const outputText =
      response.output_text ||
      JSON.stringify(response.output, null, 2);

    res.json({ result: outputText });

  } catch (err) {
    console.error("diagnose error:", err);
    res.status(500).json({
      error: "AI analysis failed",
      detail: err.message
    });
  }
});

const PORT = process.env.PORT;

if (!PORT) {
  console.error("❌ PORT not provided by Railway");
  process.exit(1);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening on ${PORT}`);
});

