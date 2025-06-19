const express = require("express");
require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const app = express();
app.use(express.json());

const client = new Client({
  authStrategy: new LocalAuth(), // nyimpen session di folder .wwebjs_auth
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", (qr) => {
  console.log("Scan QR ini dengan WhatsApp:");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("WhatsApp Client ready!");
});

// === Endpoint kirim pesan ===
app.post("/send", async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "to & message wajib diisi" });
  }

  try {
    const chatId = to.includes("@c.us") ? to : `${to}@c.us`;
    await client.sendMessage(chatId, message);
    res.json({ status: "success", to, message });
  } catch (err) {
    console.error("Gagal kirim:", err);
    res.status(500).json({ error: "Gagal mengirim pesan" });
  }
});

client.initialize();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));
