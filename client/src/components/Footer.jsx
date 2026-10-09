// components/Footer.jsx
import { Link } from "react-router-dom";
import useNewsletter from "../hooks/useNewsletter";
import {
  Facebook,
  Instagram,
  Twitter,
  Mail,
  MapPin,
  Phone,
  Send,
  Truck,
  Sprout,
  ShieldCheck,
} from "lucide-react";
import Brand from "./Brand";

const quickLinks = [
  { label: "Shop", to: "/shop" },
  { label: "Cart", to: "/cart" },
  { label: "My Orders", to: "/orders" },
  { label: "Weekly Deals", to: "/weekly-deals" },
  { label: "Recipes", to: "/recipes" },
];

const serviceLinks = [
  { label: "Contact Us", to: "/contact" },
  { label: "FAQ", to: "/faq" },
  { label: "Returns & Refunds", to: "/returns-refunds" },
  { label: "Delivery Info", to: "/delivery-info" },
  { label: "Privacy Policy", to: "/privacy" },
];

const valueProps = [
  { icon: Truck, title: "Fast Delivery", text: "Free over £40" },
  { icon: Sprout, title: "Farm Fresh", text: "Handpicked daily" },
  { icon: ShieldCheck, title: "Secure Checkout", text: "Protected payments" },
];

const socials = [
  { icon: Facebook, label: "Facebook" },
  { icon: Instagram, label: "Instagram" },
  { icon: Twitter, label: "Twitter" },
];

export default function Footer() {
  const {
    email,
    changeEmail,
    status: subscribed,
    submitting,
    subscribe: handleSubscribe,
  } = useNewsletter("footer");

  return (
    <footer className="relative mt-16 bg-gray-950 text-gray-300">
      {/* Accent top border */}
      <div className="h-1 w-full bg-gradient-to-r from-primary-600 to-amber-400" />

      {/* Value props */}
      <div className="border-b border-white/10">
        <div className="grid w-full gap-5 px-6 py-6 sm:grid-cols-3 lg:px-10 xl:px-16">
          {valueProps.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="flex items-center gap-3">
                <span className="flex items-center justify-center w-11 h-11 rounded-full bg-primary-500/10 text-primary-300 ring-1 ring-primary-400/20 shrink-0">
                  <Icon className="w-5 h-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{item.title}</p>
                  <p className="text-xs text-gray-400">{item.text}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid w-full gap-10 px-6 py-12 md:grid-cols-2 lg:grid-cols-12 lg:px-10 xl:px-16">
        {/* Brand + contact */}
        <div className="lg:col-span-5">
          <Brand className="w-fit" />

          <p className="mt-4 text-sm leading-relaxed max-w-sm text-gray-400">
            Your one-stop shop for fresh groceries, delivered to your doorstep
            with love and care.
          </p>

          <ul className="mt-6 space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-primary-400 shrink-0" />
              <span>12 Market Street, London, UK</span>
            </li>
            <li className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-primary-400 shrink-0" />
              <a href="tel:+442012345678" className="hover:text-primary-300 transition-colors">
                +44 20 1234 5678
              </a>
            </li>
            <li className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-primary-400 shrink-0" />
              <a href="mailto:hello@freshmart.com" className="hover:text-primary-300 transition-colors">
                hello@freshmart.com
              </a>
            </li>
          </ul>

          <div className="flex gap-3 mt-6">
            {socials.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href="#"
                  aria-label={item.label}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-white/5 text-gray-300 hover:bg-primary-500 hover:text-white hover:-translate-y-0.5 transition-all"
                >
                  <Icon className="w-4 h-4" />
                </a>
              );
            })}
          </div>
        </div>

        {/* Quick Links */}
        <nav className="lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-white">
            Quick Links
          </h3>
          <ul className="space-y-2.5 text-sm">
            {quickLinks.map(({ label, to }) => (
              <li key={label}>
                <Link
                  to={to}
                  className="inline-block text-gray-400 hover:text-primary-300 hover:translate-x-1 transition-all"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Customer Service */}
        <nav className="lg:col-span-2">
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-white">
            Customer Service
          </h3>
          <ul className="space-y-2.5 text-sm">
            {serviceLinks.map(({ label, to }) => (
              <li key={label}>
                <Link
                  to={to}
                  className="inline-block text-gray-400 hover:text-primary-300 hover:translate-x-1 transition-all"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Newsletter */}
        <div className="lg:col-span-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-4 text-white">
            Stay Connected
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Get exclusive deals and fresh updates in your inbox.
          </p>

          {subscribed?.type === "success" ? (
            <div className="flex items-center gap-2 rounded-lg bg-primary-500/10 px-4 py-3 text-sm text-primary-300 ring-1 ring-primary-400/20">
              <Mail className="w-4 h-4 shrink-0" />
              {subscribed.text}
            </div>
          ) : (
            <form onSubmit={handleSubscribe} className="flex">
              <label htmlFor="footer-newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="footer-newsletter-email"
                type="email"
                required
                value={email}
                onChange={(e) => changeEmail(e.target.value)}
                placeholder="Enter your email"
                aria-label="Email address"
                className="w-full min-w-0 px-4 py-2.5 rounded-l-lg text-sm text-gray-900 bg-white/95 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
              <button
                type="submit"
                disabled={submitting}
                aria-label="Subscribe"
                className="shrink-0 flex items-center gap-1.5 bg-primary-600 hover:bg-primary-500 disabled:opacity-60 px-4 rounded-r-lg text-white text-sm font-medium transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}

          {subscribed?.type === "error" && (
            <p role="alert" className="mt-2 text-sm text-red-300">
              {subscribed.text}
            </p>
          )}
        </div>
      </div>

      {/* Payments + bottom bar */}
      <div className="border-t border-white/10">
        <div className="flex w-full flex-col items-center gap-5 px-6 py-6 md:flex-row md:justify-between lg:px-10 xl:px-16">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-gray-400">
              <ShieldCheck className="w-4 h-4 text-primary-400" />
              Secure payments
            </span>
            <div className="flex items-center gap-2">
              {[
                { src: "/images/payments/payment-visa.jpg", alt: "Visa" },
                { src: "/images/payments/payment-mastercard.jpg", alt: "MasterCard" },
                { src: "/images/payments/payment-paypal.jpg", alt: "PayPal" },
              ].map((pay) => (
                <span
                  key={pay.alt}
                  className="flex items-center justify-center h-8 w-12 rounded-md bg-white/95 px-1.5 shadow-sm"
                >
                  <img
                    src={pay.src}
                    alt={pay.alt}
                    className="max-h-5 w-auto object-contain"
                    onError={(e) => (e.target.style.display = "none")}
                  />
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-400">
            <Link to="/privacy" className="hover:text-primary-300 transition-colors">
              Privacy
            </Link>
            <span className="text-white/20">|</span>
            <Link to="/shop" className="hover:text-primary-300 transition-colors">
              Terms
            </Link>
            <span className="text-white/20">|</span>
            <span>© {new Date().getFullYear()} FreshMart</span>
          </div>
        </div>
      </div>
    </footer>
  );
}