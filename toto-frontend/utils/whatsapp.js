// utils/whatsapp.js
import axios from "axios";
const FONNTE_API_KEY = process.env.FONNTE_API_KEY;

export async function sendWhatsApp(phone, message) {
  if (!FONNTE_API_KEY) {
    console.warn("FONNTE_API_KEY not set, skipping sendWhatsApp");
    return;
  }
  try {
    await axios.post("https://api.fonnte.com/send", {
      target: phone,
      message: message
    }, {
      headers: { Authorization: FONNTE_API_KEY }
    });
    console.log(`WA sent to ${phone}`);
  } catch (err) {
    console.error("WA send error", err?.response?.data || err.message);
    throw err;
  }
}
