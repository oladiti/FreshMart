import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, MapPin, Phone, MessageSquare, Send, Loader2, CheckCircle2, Clock, Headset, HelpCircle, Package, User, ChevronRight } from "lucide-react";
import BackToHome from "../components/BackToHome";
import api from "../utils/api";

const contactInfo = [
  {
    icon: MapPin,
    title: "Visit Us",
    lines: ["12 Market Street", "London, UK"],
  },
  {
    icon: Phone,
    title: "Call Us",
    lines: ["+44 20 1234 5678", "Mon–Sat, 8am – 8pm"],
  },
  {
    icon: Mail,
    title: "Email Us",
    lines: ["hello@freshmart.com", "Replies within 24 hours"],
  },
];

const helpLinks = [
  {
    icon: HelpCircle,
    title: "Browse the FAQ",
    description: "Answers to the most common questions.",
    to: "/faq",
  },
  {
    icon: Package,
    title: "Track your orders",
    description: "Follow deliveries and review past orders.",
    to: "/orders",
  },
  {
    icon: User,
    title: "Update your profile",
    description: "Keep your account details up to date.",
    to: "/profile",
  },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState({ type: null, text: "" }); // type: success | error
  const [sending, setSending] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setStatus({ type: null, text: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus({ type: "error", text: "Please fill in your name, email and message." });
      return;
    }
    setSending(true);
    setStatus({ type: null, text: "" });
    try {
      const { data } = await api.post("/contact", form);
      setStatus({
        type: "success",
        text: data.message || "Thanks! Your message has been sent and we'll get back to you soon.",
      });
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      setStatus({
        type: "error",
        text: err.response?.data?.message || "Something went wrong sending your message. Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10">
      <BackToHome className="mb-8" />
      <div className="text-center">
        <span className="inline-flex items-center gap-2 text-primary-600 bg-primary-50 rounded-full px-4 py-1.5 text-sm font-medium">
          <MessageSquare className="w-4 h-4" />
          We'd love to hear from you
        </span>
        <h1 className="mt-4 text-3xl md:text-4xl font-bold text-gray-900">
          Contact Us
        </h1>
        <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
          Questions about an order, a product, or anything else? Send us a
          message and our team will get back to you as soon as possible.
        </p>
      </div>

      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {contactInfo.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              className="bg-white rounded-xl shadow-sm border p-5 flex items-start gap-4"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary-600">
                <Icon className="w-5 h-5" />
              </span>
              <div>
                <p className="font-semibold text-gray-900">{item.title}</p>
                {item.lines.map((line) => (
                  <p key={line} className="text-sm text-gray-500 mt-0.5">{line}</p>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 grid md:grid-cols-5 gap-8">
        <div className="md:col-span-3 bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900">Send a message</h2>
          <p className="mt-1 text-sm text-gray-500">
            Fields marked <span className="text-red-500">*</span> are required.
          </p>

          {status.type && (
            <div
              role="status"
              className={`mt-4 flex items-start gap-2 rounded-lg px-4 py-3 text-sm ${
                status.type === "success"
                  ? "bg-primary-50 text-primary-700"
                  : "bg-red-50 text-red-700"
              }`}
            >
              {status.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              ) : (
                <Clock className="w-4 h-4 mt-0.5 shrink-0" />
              )}
              <span>{status.text}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                  Full name <span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email address <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                />
              </div>
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-gray-700">
                Subject
              </label>
              <input
                id="subject"
                name="subject"
                type="text"
                value={form.subject}
                onChange={handleChange}
                placeholder="Order enquiry, product question..."
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                value={form.message}
                onChange={handleChange}
                placeholder="How can we help?"
                className="mt-1.5 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
            </div>

            <button
              type="submit"
              disabled={sending}
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-3 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>

        <div className="md:col-span-2">
          <div className="relative flex h-full flex-col overflow-hidden rounded-xl bg-gray-950 p-6 text-white">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary-500/20 blur-3xl"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-20 -left-12 h-40 w-40 rounded-full bg-primary-700/10 blur-3xl"
              aria-hidden="true"
            />

            <div className="relative">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-primary-300 ring-1 ring-white/10">
                <Headset className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-heading text-lg font-semibold">Prefer instant help?</h3>
              <p className="mt-1 text-sm text-gray-400">
                Skip the queue and find what you need in seconds.
              </p>
            </div>

            <ul className="relative mt-5 space-y-2">
              {helpLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="group -mx-1 flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-white/5"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-primary-300 transition-colors group-hover:bg-primary-500/20">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-white">{item.title}</span>
                        <span className="block text-xs text-gray-400">{item.description}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-500 transition-all group-hover:translate-x-0.5 group-hover:text-primary-300" />
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="relative mt-6 flex flex-1 items-end">
              <div className="w-full rounded-lg bg-white/5 p-4 text-sm ring-1 ring-white/10">
                <p className="flex items-center gap-2 font-medium text-primary-300">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-400" />
                  </span>
                  Live chat
                </p>
                <p className="mt-1 text-gray-400">Mon–Sat · 8am – 8pm</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}