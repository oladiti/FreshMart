// server/controllers/contactController.js
import ContactMessage from "../models/ContactMessage.js";
import Setting from "../models/Setting.js";
import { transporter } from "../config/email.js";

const getSettingValue = async (key) => {
  const setting = await Setting.findOne({ key });
  return setting?.value;
};

// Best-effort email notification. Never fails the request when email is
// unavailable or not configured.
const sendNotificationEmail = async ({ name, email, subject, message }) => {
  const from = process.env.EMAIL_USER;
  if (!from) return;

  // Never send real emails from the test suite
  if (process.env.NODE_ENV === "test") return;

  const to = (await getSettingValue("supportEmail")) || from;
  if (!to) return;

  const safe = (value) => String(value || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#047857;">New contact message</h2>
      <table style="border-collapse:collapse;width:100%;">
        <tr><td style="padding:6px 0;color:#555;width:80px;">Name</td><td style="padding:6px 0;">${safe(name)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Email</td><td style="padding:6px 0;">${safe(email)}</td></tr>
        <tr><td style="padding:6px 0;color:#555;">Subject</td><td style="padding:6px 0;">${safe(subject)}</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;"/>
      <p style="white-space:pre-wrap;color:#333;">${safe(message)}</p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"FreshMart Contact" <${from}>`,
      to,
      replyTo: email,
      subject: `[Contact] ${subject || `New message from ${name}`}`,
      text: `Name: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`,
      html,
    });
  } catch (err) {
    console.error("❌ Contact notification email failed (message will still be stored):", err.message);
  }
};

// ✅ Create new contact message
export const createContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};

    const errors = [];
    if (!name || !String(name).trim()) errors.push("Name is required");
    if (!email || !String(email).trim()) errors.push("Email is required");
    if (!message || !String(message).trim()) errors.push("Message is required");

    if (errors.length > 0) {
      return res.status(400).json({ message: errors.join(". ") });
    }

    const contactMessage = await ContactMessage.create({
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      subject: String(subject || "").trim(),
      message: String(message).trim(),
    });

    // Fire-and-forget notification (logged internally, never blocks the response)
    await sendNotificationEmail({
      name: contactMessage.name,
      email: contactMessage.email,
      subject: contactMessage.subject,
      message: contactMessage.message,
    });

    res.status(201).json({
      success: true,
      message: `Thanks ${contactMessage.name.split(" ")[0] || ""}! Your message has been sent and we'll get back to you soon.`.trim(),
    });
  } catch (error) {
    console.error("❌ Error saving contact message:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ List contact messages (admin only)
export const getContactMessages = async (req, res) => {
  try {
    const messages = await ContactMessage.find({}).sort({ createdAt: -1 }).lean();
    res.json({ success: true, messages });
  } catch (error) {
    console.error("❌ Error fetching contact messages:", error);
    res.status(500).json({ message: "Server error" });
  }
};