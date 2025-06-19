const express = require("express");
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
    return res.status(400).json(response.error("to & message wajib diisi"));
  }
  if (to.startsWith("0")) {
    return res
      .status(400)
      .json(
        response.error(
          "Nomor tidak boleh diawali dengan 0. Gunakan format internasional, misal: 62812xxxxxxx"
        )
      );
  }
  try {
    const chatId = to.includes("@c.us") ? to : `${to}@c.us`;
    await client.sendMessage(chatId, message);
    res.json(response.success("Berhasil Mengirim Pesan", { to, message }));
  } catch (err) {
    console.error("Gagal kirim:", err);
    res.status(500).json(response.error("Gagal mengirim pesan"));
  }
});

client.initialize();

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));
