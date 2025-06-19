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
const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout")), ms)
    ),
  ]);

function startClient() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", (qr) => {
    console.log("Scan QR:", qr);
  });

  client.on("ready", () => {
    console.log("✅ WhatsApp Client is ready!");
  });

  client.on("disconnected", (reason) => {
    console.log("❌ Disconnected:", reason);
    restartClient(); // restart otomatis
  });

  client.initialize();
}

function restartClient() {
  if (client) {
    client
      .destroy()
      .then(() => {
        console.log("🔁 Client destroyed. Restarting...");
        startClient();
      })
      .catch((err) => {
        console.error("❌ Error saat destroy client:", err);
        startClient();
      });
  } else {
    startClient();
  }
}

setInterval(() => {
  if (!client || !client.info || !client.info.wid) {
    console.log("⚠️ Client tidak siap. Restarting...");
    restartClient();
  } else {
    console.log("✅ Client OK:", client.info.wid.user);
  }
}, 30000);

app.get("/qr", (req, res) => {
  if (!currentQR) return res.send("QR belum tersedia");
  res.send(`<img src="${currentQR}" />`);
});

// === Endpoint kirim pesan ===
app.post("/send", async (req, res) => {
  startClient();
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
    const isRegistered = await client.isRegisteredUser(chatId);

    if (!isRegistered) {
      return res
        .status(400)
        .json(response.error("Nomor tidak terdaftar di WhatsApp"));
    }
    const start = Date.now();
    console.log("Mengirim....");

    await withTimeout(client.sendMessage(chatId, message), 15000); // timeout 15 detik
    const end = Date.now();
    console.log("Terkirim....");
    console.log(`Pesan dikirim dalam ${end - start}ms`);
    res.json({ success: true, to, message });
    client.on("ready", () => {
      console.log("WhatsApp Client ready!");
    });
  } catch (err) {
    console.error("Gagal kirim:", err);
    res.status(500).json(response.error("Gagal mengirim pesan"));
  }
});

client.initialize();

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => console.log(`Server ready on http://localhost:${PORT}`));
startClient();
