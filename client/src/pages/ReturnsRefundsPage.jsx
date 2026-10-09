import { Link } from "react-router-dom";
import {
  RotateCcw,
  Clock,
  FileText,
  Undo2,
  PackageX,
  MessageCircle,
  CheckCircle2,
  Mail,
} from "lucide-react";
import BackToHome from "../components/BackToHome";

const steps = [
  {
    title: "Request a return",
    text: "Contact us within 30 days of delivery via the Contact page or by emailing hello@freshmart.com with your order number and the items you'd like to return.",
  },
  {
    title: "Pack the items",
    text: "Keep the items in their original packaging. Unopened, non-perishable items can be returned in their sealed packs where possible.",
  },
  {
    title: "Receive your refund",
    text: "Once we collect and check the returned items, your refund is processed back to your original payment method within 5–10 working days.",
  },
];

const refunds = [
  {
    q: "Faulty, damaged, or incorrect items",
    a: "Let us know within 48 hours of delivery with a photo of the item plus your order number. We'll arrange a free replacement or a full refund.",
  },
  {
    q: "Not happy with a product?",
    a: "Your satisfaction matters. If a product didn't meet expectations, contact us within 7 days and we'll happily refund or replace it.",
  },
  {
    q: "How long does a refund take?",
    a: "Approved refunds usually appear on your statement within 5–10 working days, depending on your bank or card provider.",
  },
  {
    q: "What about perishable items?",
    a: "Perishable goods (fresh produce, dairy, meat, bakery) can't be returned once delivered. Report quality issues within 48 hours for a replacement or refund.",
  },
];

const excluded = [
  "Opened or partially used perishable items",
  "Products that have been customised or personalised",
  "Items returned after the 30-day window",
  "Gift cards and promotional vouchers",
];

export default function ReturnsRefundsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
      <BackToHome className="mb-8" />
      <div className="text-center">
        <span className="inline-flex items-center gap-2 text-primary-600 bg-primary-50 rounded-full px-4 py-1.5 text-sm font-medium">
          <RotateCcw className="w-4 h-4" />
          Hassle-free returns
        </span>
        <h1 className="mt-4 text-3xl md:text-4xl font-bold text-gray-900">
          Returns &amp; Refunds
        </h1>
        <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
          If something isn't right, we'll make it right. Here's everything you
          need to know about returning items and getting your money back.
        </p>
      </div>

      {/* How to return */}
      <div className="mt-10">
        <h2 className="flex items-center gap-2 text-lg md:text-xl font-bold text-gray-900">
          <Undo2 className="w-5 h-5 text-primary-600" />
          How to return an item
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="relative bg-white rounded-xl border border-gray-100 shadow-sm p-6"
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-primary-600 text-white text-sm font-bold">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Common questions */}
      <div className="mt-12">
        <h2 className="flex items-center gap-2 text-lg md:text-xl font-bold text-gray-900">
          <Clock className="w-5 h-5 text-primary-600" />
          Refund scenarios
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {refunds.map((item) => (
            <div
              key={item.q}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
            >
              <h3 className="flex items-start gap-2 font-semibold text-gray-900">
                <CheckCircle2 className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                {item.q}
              </h3>
              <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">
                {item.a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Not eligible */}
      <div className="mt-12 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 grid md:grid-cols-2 gap-8">
          <div>
            <h2 className="flex items-center gap-2 text-lg md:text-xl font-bold text-gray-900">
              <PackageX className="w-5 h-5 text-amber-600" />
              Items that can't be returned
            </h2>
            <ul className="mt-4 space-y-3 text-sm text-gray-600">
              {excluded.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 flex flex-col justify-center">
            <h3 className="flex items-center gap-2 font-semibold text-gray-900">
              <MessageCircle className="w-5 h-5 text-primary-600" />
              Need to start a return?
            </h3>
            <p className="mt-2 text-sm text-gray-500 leading-relaxed">
              Have your order number ready and get in touch — we typically
              respond within 24 hours.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
              >
                <Mail className="w-4 h-4" />
                Contact Us
              </Link>
              <Link
                to="/faq"
                className="inline-flex items-center gap-2 bg-white border border-gray-200 hover:border-primary-400 text-gray-700 px-5 py-2.5 rounded-lg font-medium text-sm transition-colors"
              >
                <FileText className="w-4 h-4" />
                View FAQ
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}