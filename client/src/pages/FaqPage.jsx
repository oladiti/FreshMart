import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  HelpCircle,
  ChevronDown,
  Search,
  MessageCircle,
  ShoppingCart,
  Truck,
  CreditCard,
  PackageCheck,
  UserRound,
  RotateCcw,
  Mail,
  MapPin,
} from "lucide-react";
import BackToHome from "../components/BackToHome";

const faqs = [
  {
    category: "Orders & Delivery",
    icon: Truck,
    items: [
      {
        q: "How long does delivery take?",
        a: "Standard delivery usually arrives within 1–3 working days. Orders placed before 6pm Monday–Saturday are typically dispatched the same day. Express (next-day) delivery is available at checkout for orders placed before 3pm.",
      },
      {
        q: "Is delivery free?",
        a: "We offer free standard delivery on all orders over £40. Orders below £40 are charged a flat delivery fee which is shown clearly at checkout before you pay.",
      },
      {
        q: "Can I track my order?",
        a: "Yes. Once your order is dispatched you will receive a confirmation email, and you can follow its status anytime on your My Orders page. Statuses move from pending → paid → shipped → delivered.",
      },
      {
        q: "Which areas do you deliver to?",
        a: "We currently deliver across mainland UK. During checkout you will be asked for your postcode, and we will only proceed if we can serve your area.",
      },
      {
        q: "Can I change or cancel my order after placing it?",
        a: "You can cancel an order as long as it hasn't been packed or shipped. Please contact us as soon as possible after ordering and we'll do our best to help — see Contact Us for the fastest channel.",
      },
    ],
  },
  {
    category: "Products & Quality",
    icon: PackageCheck,
    items: [
      {
        q: "How fresh are your products?",
        a: "Our fruit, vegetables, meat, fish and bakery items are handpicked daily from trusted farms and suppliers, so you get the freshest possible groceries.",
      },
      {
        q: "What happens if an item is out of stock?",
        a: "We never want you to be disappointed. If an item is unavailable at dispatch, we will either substitute it with a like-for-like product or refund you for that item. Our team will let you know before it ships.",
      },
      {
        q: "Are your products organic?",
        a: "We stock a wide organic range alongside quality conventional produce. Products that are organic are clearly labelled, so check the product page for details.",
      },
      {
        q: "Do you label allergens and nutrition info?",
        a: "Yes. Every product page includes nutritional information and allergen highlights, and all items arrive with their original labels so you can verify before use.",
      },
    ],
  },
  {
    category: "Payments & Security",
    icon: CreditCard,
    items: [
      {
        q: "Which payment methods do you accept?",
        a: "We accept all major debit and credit cards (Visa, Mastercard, American Express) as well as PayPal and Cash on Delivery where available. Payments are processed securely by Stripe.",
      },
      {
        q: "Is my payment information safe?",
        a: "Absolutely. All transactions are processed by Stripe, a PCI-DSS compliant payment provider. We never store your full card details on our servers.",
      },
      {
        q: "When will I be charged?",
        a: "You are charged when you place your order. If an item later turns out to be unavailable, the relevant amount is refunded back to your original payment method automatically.",
      },
      {
        q: "Do you offer Cash on Delivery?",
        a: "Yes, Cash on Delivery is available in selected areas and can be chosen at checkout. Please have the exact amount ready, as our drivers may not carry change.",
      },
    ],
  },
  {
    category: "Returns & Refunds",
    icon: RotateCcw,
    items: [
      {
        q: "What is your returns policy?",
        a: "If you are not happy with an item, contact us within 48 hours of delivery with a photo and we'll arrange a refund or replacement. Perishable items must be reported quickly so we can resolve it fairly.",
      },
      {
        q: "When will my refund appear?",
        a: "Approved refunds are processed back to your original payment method, usually within 5–10 working days depending on your bank.",
      },
      {
        q: "I received a damaged or wrong item. What now?",
        a: "We're sorry about that. Contact us through the Contact page and include your order number and a photo of the item. We'll replace it or refund you as quickly as possible.",
      },
    ],
  },
  {
    category: "Account & Support",
    icon: UserRound,
    items: [
      {
        q: "How do I create an account?",
        a: "Click Sign Up in the top navigation, enter your name, email and a password, and you're ready to shop. Your cart and order history are saved to your account automatically.",
      },
      {
        q: "I forgot my password. How do I reset it?",
        a: "Use the Forgot Password link on the login page. We'll email you a secure reset link that expires after one hour.",
      },
      {
        q: "How do I update my personal details?",
        a: "Sign in and visit your Profile page, where you can update your name, email address and password at any time.",
      },
      {
        q: "How can I contact customer support?",
        a: "The quickest way is through our Contact page — we reply within 24 hours. You can also email hello@freshmart.com or call +44 20 1234 5678, Mon–Sat 8am–8pm.",
      },
    ],
  },
];

export default function FaqPage() {
  const [openId, setOpenId] = useState(null);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const categories = useMemo(
    () => ["All", ...faqs.map((f) => f.category)],
    []
  );

  const results = useMemo(() => {
    return activeCategory === "All"
      ? faqs
      : faqs.filter((f) => f.category === activeCategory);
  }, [activeCategory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return results;
    return results
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (i) => i.q.toLowerCase().includes(q) || i.a.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [results, query]);

  const totalMatches = filtered.reduce((sum, g) => sum + g.items.length, 0);

  const toggle = (key) => {
    setOpenId((prev) => (prev === key ? null : key));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
      <BackToHome className="mb-8" />
      {/* Header */}
      <div className="text-center">
        <span className="inline-flex items-center gap-2 text-primary-600 bg-primary-50 rounded-full px-4 py-1.5 text-sm font-medium">
          <HelpCircle className="w-4 h-4" />
          Frequently asked questions
        </span>
        <h1 className="mt-4 text-3xl md:text-4xl font-bold text-gray-900">
          How can we help?
        </h1>
        <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
          Everything you need to know about ordering, delivery, payments,
          returns and your account on FreshMart.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-xl mx-auto mt-8">
        <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for answers, e.g. delivery, refund, payment..."
          className="w-full pl-12 pr-4 py-3 rounded-full bg-white border border-gray-200 shadow-sm text-sm focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-200"
        />
      </div>

      {/* Category tabs */}
      {!query && (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat
                  ? "bg-primary-600 text-white shadow-md shadow-primary-600/20"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-primary-400 hover:text-primary-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* FAQ sections */}
      <div className="mt-10 space-y-8">
        {query && totalMatches === 0 && (
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-10 text-center">
            <p className="text-gray-500">
              No questions matched your search. Try a different term or{" "}
              <Link to="/contact" className="text-primary-600 hover:underline">
                contact us
              </Link>{" "}
              instead.
            </p>
          </div>
        )}

        {filtered.map((group) => {
          const GroupIcon = (
            faqs.find((f) => f.category === group.category) || {}
          ).icon;
          return (
            <section key={group.category} className="max-w-3xl mx-auto">
              {!query && (
                <h2 className="flex items-center gap-2 text-lg md:text-xl font-bold text-gray-900 mb-3">
                  {GroupIcon && (
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 text-primary-600">
                      <GroupIcon className="w-4 h-4" />
                    </span>
                  )}
                  {group.category}
                </h2>
              )}

              <div className="space-y-3">
                {group.items.map((item, idx) => {
                  const key = `${group.category}-${idx}`;
                  const isOpen = openId === key;
                  return (
                    <div
                      key={key}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden card-hover"
                    >
                      <button
                        onClick={() => toggle(key)}
                        aria-expanded={isOpen}
                        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                      >
                        <span className="font-medium text-gray-800">
                          {item.q}
                        </span>
                        <ChevronDown
                          className={`w-5 h-5 shrink-0 text-primary-600 transition-transform duration-200 ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed">
                          {item.a}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Still need help? */}
      <div className="mt-14 bg-gray-950 text-white rounded-2xl overflow-hidden">
        <div className="p-8 md:p-10 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="flex items-center gap-2.5 text-2xl font-bold">
              <MessageCircle className="w-6 h-6 text-primary-400" />
              Still need help?
            </h2>
            <p className="mt-3 text-gray-300 text-sm leading-relaxed">
              Our friendly support team is ready to answer any question you
              haven't found here. We typically reply within 24 hours.
            </p>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-gray-300">
              <span className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary-400" />
                hello@freshmart.com
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary-400" />
                12 Market Street, London, UK
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-3 md:justify-end">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Contact Us
            </Link>
            <Link
              to="/shop"
              className="inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/15 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              Start Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}