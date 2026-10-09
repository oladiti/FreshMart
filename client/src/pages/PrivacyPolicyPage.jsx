import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Database,
  Cookie,
  Share2,
  Lock,
  UserRound,
  Mail,
  FileText,
} from "lucide-react";
import BackToHome from "../components/BackToHome";

const sections = [
  {
    icon: Database,
    title: "Information we collect",
    items: [
      {
        head: "Account details",
        body: "Your name, email address and password (stored securely) when you create an account.",
      },
      {
        head: "Order details",
        body: "Items you order, delivery address, and payment confirmation so we can fulfil and support your orders.",
      },
      {
        head: "Payment information",
        body: "Card and payment details are processed by our payment provider (Stripe) under strict PCI-DSS standards. We never store your full card numbers.",
      },
      {
        head: "Cart preferences",
        body: "Your saved cart and browsing preferences, stored locally in your browser so your shopping is ready when you return.",
      },
    ],
  },
  {
    icon: Share2,
    title: "How we use your information",
    items: [
      {
        head: "Fulfil your orders",
        body: "To process, deliver and support your orders, including sending you delivery status updates by email.",
      },
      {
        head: "Improve our service",
        body: "To understand what products you enjoy so we can recommend relevant items and improve our range.",
      },
      {
        head: "Communicate with you",
        body: "To respond to enquiries through our Contact page and, only if you opt in, send you our newsletter.",
      },
    ],
  },
  {
    icon: Cookie,
    title: "Cookies and local storage",
    items: [
      {
        head: "What we use",
        body: "We use browser local storage to remember your cart and essential session state so the site works correctly.",
      },
      {
        head: "How to control it",
        body: "You can clear cart and site data from your browser settings at any time. Essential data is needed to place orders.",
      },
    ],
  },
  {
    icon: Share2,
    title: "Sharing your information",
    items: [
      {
        head: "Who we share with",
        body: "We only share data with the providers needed to run orders — payment processing and delivery partners — and never sell your personal data to third parties.",
      },
      {
        head: "Your control",
        body: "We handle your data in line with UK GDPR requirements and only keep it for as long as needed to serve you.",
      },
    ],
  },
  {
    icon: Lock,
    title: "Keeping your data safe",
    items: [
      {
        head: "Security measures",
        body: "Passwords are hashed, connections are encrypted over HTTPS, and payments are processed by our PCI-DSS compliant payment provider.",
      },
      {
        head: "Your responsibility",
        body: "Keep your login details private. If you believe your account has been accessed without permission, contact us right away.",
      },
    ],
  },
  {
    icon: UserRound,
    title: "Your rights",
    items: [
      {
        head: "Access and correction",
        body: "You can view and update your name and email anytime from your Profile page.",
      },
      {
        head: "Deletion",
        body: "You can request that we delete your account and personal data by contacting us — we'll action legitimate requests promptly.",
      },
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
      <BackToHome className="mb-8" />
      <div className="text-center">
        <span className="inline-flex items-center gap-2 text-primary-600 bg-primary-50 rounded-full px-4 py-1.5 text-sm font-medium">
          <ShieldCheck className="w-4 h-4" />
          Your privacy matters
        </span>
        <h1 className="mt-4 text-3xl md:text-4xl font-bold text-gray-900">
          Privacy Policy
        </h1>
        <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
          Last updated: September 2026. We're committed to protecting your
          personal information and being transparent about how we use it.
        </p>
      </div>

      <div className="mt-10 space-y-8">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <section key={section.title} className="max-w-3xl mx-auto">
              <h2 className="flex items-center gap-2 text-lg md:text-xl font-bold text-gray-900">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 text-primary-600">
                  <Icon className="w-4 h-4" />
                </span>
                {section.title}
              </h2>
              <div className="mt-4 bg-white rounded-xl border border-gray-100 shadow-sm divide-y divide-gray-50">
                {section.items.map((item) => (
                  <div key={item.head} className="p-5">
                    <h3 className="font-semibold text-gray-900">{item.head}</h3>
                    <p className="mt-1 text-sm text-gray-500 leading-relaxed">
                      {item.body}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* Contact */}
        <section className="max-w-3xl mx-auto bg-gray-950 text-white rounded-2xl p-6 md:p-8">
          <h2 className="flex items-center gap-2 text-lg md:text-xl font-bold">
            <Mail className="w-5 h-5 text-primary-400" />
            Privacy questions?
          </h2>
          <p className="mt-2 text-sm text-gray-300 leading-relaxed">
            For any question about this policy or your personal data, email
            hello@freshmart.com or use the Contact page. We'll get back to you
            within 24 hours.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              <Mail className="w-4 h-4" />
              Contact Us
            </Link>
            <Link
              to="/faq"
              className="inline-flex items-center gap-2 bg-white/10 border border-white/15 hover:bg-white/15 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
            >
              <FileText className="w-4 h-4" />
              Visit FAQ
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}