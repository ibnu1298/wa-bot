const express = require("express");
const response = require("./utils/response");
require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const QRCode = require("qrcode");

const app = express();
app.use(express.json());

const client = new Client({
  authStrategy: new LocalAuth(), // nyimpen session di folder .wwebjs_auth
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

client.on("qr", async (qr) => {
  // Buat QR jadi URL image (base64)
  const qrImage = await QRCode.toDataURL(qr);
  console.log("Scan QR ini dari browser:");
  console.log(qrImage);
});

client.on("ready", () => {
  console.log("WhatsApp Client ready!");
});
let currentQR = "";

client.on("qr", async (qr) => {
  currentQR = await QRCode.toDataURL(qr);
  console.log(`QR tersedia di: http://localhost:${PORT}/qr`);
});

app.get("/qr", (req, res) => {
  if (!currentQR) return res.send("QR belum tersedia");
  res.send(`<img src="${currentQR}" />`);
});
// === Endpoint kirim pesan ===
app.post("/send", async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "to & message wajib diisi" });
  }

  // Validasi: nomor tidak boleh diawali 0
  if (!/^[1-9][0-9]{9,14}$/.test(to)) {
    return res
      .status(400)
      .json(
        response.error(
          "Format nomor tidak valid. Gunakan format internasional tanpa 0 di depan, misal: 62812xxxxxxx"
        )
      );
  }

  // Cek apakah WhatsApp client siap
  if (!client.info || !client.info.wid) {
    return res
      .status(503)
      .json(
        response.error(
          "WhatsApp belum siap. Tunggu sampai QR discan dan client terhubung."
        )
      );
  }

  try {
    const chatId = `${to}@c.us`;
    await client.sendMessage(chatId, message);
    res.json({ success: true, to, message });
  } catch (err) {
    console.error("Gagal kirim:", err);
    res.status(500).json(response.error("Gagal mengirim pesan"));
  }
});

client.initialize();

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));
