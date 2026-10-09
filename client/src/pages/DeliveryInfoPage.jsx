import { Link } from "react-router-dom";
import {
  Truck,
  MapPin,
  Timer,
  PoundSterling,
  PackageCheck,
  Search,
  ClipboardList,
  MessageCircle,
  Zap,
  Leaf,
} from "lucide-react";
import BackToHome from "../components/BackToHome";

const coverage = [
  "London & Greater London",
  "South East England",
  "Birmingham & West Midlands",
  "Manchester & North West",
  "Leeds & Yorkshire",
  "Bristol & South West",
];

const options = [
  {
    icon: Zap,
    title: "Express",
    time: "Next-day delivery",
    cost: "£6.99",
    note: "Order before 3pm for delivery tomorrow",
  },
  {
    icon: Truck,
    title: "Standard",
    time: "1–3 working days",
    cost: "£3.99",
    note: "Free on all orders over £40",
  },
  {
    icon: Timer,
    title: "Scheduled",
    time: "Choose your slot",
    cost: "£5.99",
    note: "Pick a 2-hour window that suits you",
  },
];

const steps = [
  {
    title: "We pick & pack",
    text: "Your groceries are carefully handpicked, quality-checked and packed to stay fresh in transit.",
  },
  {
    title: "We ship",
    text: "Orders placed before 6pm Mon–Sat are dispatched the same day with real-time tracking.",
  },
  {
    title: "You track",
    text: "Once dispatched, you'll get a confirmation email and can follow your order status in My Orders.",
  },
  {
    title: "It arrives",
    text: "Your order is delivered to your door — on time and in great condition.",
  },
];

export default function DeliveryInfoPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
      <BackToHome className="mb-8" />
      <div className="text-center">
        <span className="inline-flex items-center gap-2 text-primary-600 bg-primary-50 rounded-full px-4 py-1.5 text-sm font-medium">
          <Truck className="w-4 h-4" />
          We bring the market to you
        </span>
        <h1 className="mt-4 text-3xl md:text-4xl font-bold text-gray-900">
          Delivery Info
        </h1>
        <p className="mt-3 text-gray-500 max-w-2xl mx-auto">
          Fresh groceries delivered fast and carefully to your doorstep. Here's
          how delivery with FreshMart works.
        </p>
      </div>

      {/* Delivery options */}
      <div className="mt-10">
        <h2 className="flex items-center gap-2 text-lg md:text-xl font-bold text-gray-900">
          <Truck className="w-5 h-5 text-primary-600" />
          Delivery options
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <div
                key={opt.title}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center"
              >
                <span className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-50 text-primary-600">
                  <Icon className="w-6 h-6" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">
                  {opt.title}
                </h3>
                <p className="text-sm text-gray-500">{opt.time}</p>
                <p className="mt-3 text-2xl font-bold text-primary-600">
                  {opt.cost}
                </p>
                <p className="mt-1.5 text-xs text-gray-400">{opt.note}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <PoundSterling className="w-4 h-4 text-primary-600" />
          All orders include free delivery over £40. The exact cost is always
          shown before you pay.
        </p>
      </div>

      {/* How it works */}
      <div className="mt-12">
        <h2 className="flex items-center gap-2 text-lg md:text-xl font-bold text-gray-900">
          <ClipboardList className="w-5 h-5 text-primary-600" />
          How delivery works
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <div
              key={step.title}
              className="bg-white rounded-xl border border-gray-100 shadow-sm p-6"
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

      {/* Delivery areas */}
      <div className="mt-12 bg-gray-950 text-white rounded-2xl p-6 md:p-8 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h2 className="flex items-center gap-2 text-lg md:text-xl font-bold">
            <MapPin className="w-5 h-5 text-primary-400" />
            Where we deliver
          </h2>
          <p className="mt-3 text-sm text-gray-300 leading-relaxed">
            We currently deliver across mainland UK. Enter your postcode at
            checkout — if we can't reach you yet, we'll let you know before you
            pay and we're expanding to more areas every quarter.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {coverage.map((area) => (
              <span
                key={area}
                className="inline-flex items-center gap-1.5 text-sm bg-white/10 border border-white/10 rounded-full px-3.5 py-1.5"
              >
                <Leaf className="w-3.5 h-3.5 text-primary-400" />
                {area}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-start gap-4">
            <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-500/15 text-primary-300 shrink-0">
              <Search className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-semibold">Track your order</h3>
              <p className="mt-1 text-sm text-gray-300">
                Follow your order in real time under{" "}
                <Link
                  to="/orders"
                  className="text-primary-300 hover:underline"
                >
                  My Orders
                </Link>{" "}
                — pending, paid, shipped, delivered.
              </p>
            </div>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-start gap-4">
            <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-500/15 text-primary-300 shrink-0">
              <PackageCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-semibold">Responsible packaging</h3>
              <p className="mt-1 text-sm text-gray-300">
                We use chilled, recyclable packaging to keep items fresh while
                keeping waste to a minimum.
              </p>
            </div>
          </div>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-5 py-3 rounded-lg font-medium text-sm transition-colors mt-2"
          >
            <MessageCircle className="w-4 h-4" />
            Questions about delivery? Contact us
          </Link>
        </div>
      </div>
    </div>
  );
}