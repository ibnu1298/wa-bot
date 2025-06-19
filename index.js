const express = require("express");
const response = require("./utils/response");
require("dotenv").config();
const { Client, LocalAuth } = require("whatsapp-web.js");
const QRCode = require("qrcode");

const app = express();
app.use(express.json());

let client;
let currentQR = "";

function startClient() {
  client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
    puppeteer: {
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", async (qr) => {
    currentQR = await QRCode.toDataURL(qr);
    console.log(`🔑 Scan QR di browser: http://localhost:${PORT}/qr`);
  });

  client.on("ready", () => {
    console.log("✅ WhatsApp Client is ready!");
  });

  client.on("disconnected", (reason) => {
    console.log("❌ Client disconnected:", reason);
    restartClient();
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

// Cek client setiap 30 detik
setInterval(() => {
  if (!client || !client.info || !client.info.wid) {
    console.log("⚠️ Client tidak siap. Restarting...");
    restartClient();
  } else {
    console.log("✅ Client OK:", client.info.wid.user);
  }
}, 30000);

// Endpoint tampilkan QR
app.get("/qr", (req, res) => {
  if (!currentQR) return res.send("QR belum tersedia");
  res.send(`<img src="${currentQR}" />`);
});

// Endpoint kirim pesan
app.post("/send", async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json(response.error("to & message wajib diisi"));
  }

  if (!/^[1-9][0-9]{9,14}$/.test(to)) {
    return res.status(400).json(response.error("Format nomor tidak valid"));
  }

  if (!client || !client.info || !client.info.wid) {
    return res
      .status(503)
      .json(response.error("WhatsApp belum siap. Scan QR dulu"));
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
    console.log("Mengirim pesan...");

    // Timeout 15 detik
    await Promise.race([
      client.sendMessage(chatId, message),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 15000)
      ),
    ]);

    const end = Date.now();
    console.log(`✅ Terkirim dalam ${end - start}ms`);
    res.json({ success: true, to, message });
  } catch (err) {
    console.error("Gagal kirim:", err.message);
    res.status(500).json(response.error("Gagal mengirim pesan"));
  }
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`🚀 Server ready di http://localhost:${PORT}`);
  startClient();
});
