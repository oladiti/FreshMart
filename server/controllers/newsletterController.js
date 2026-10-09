import Subscriber from "../models/Subscriber.js";

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const ALREADY_SUBSCRIBED = "You're already subscribed — thanks for staying in touch!";

// ✅ Public: add an address to the newsletter
// Re-subscribing is treated as success rather than an error. The confirmation
// auto-dismisses after a few seconds, so people routinely submit twice, and
// showing them an error for that would be hostile.
export const subscribeToNewsletter = async (req, res, next) => {
  try {
    const { email, source } = req.body;
    const normalized = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalized) {
      return res.status(400).json({ message: "Email is required" });
    }

    // Validate here rather than leaning on the schema matcher, which would
    // surface as an opaque 500 ValidationError through the error handler.
    if (!EMAIL_PATTERN.test(normalized)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid email address" });
    }

    const existing = await Subscriber.findOne({ email: normalized });
    if (existing) {
      return res.status(200).json({
        message: ALREADY_SUBSCRIBED,
        alreadySubscribed: true,
      });
    }

    await Subscriber.create({
      email: normalized,
      source: source === "footer" ? "footer" : "home",
    });

    res.status(201).json({
      message: "Thanks for subscribing!",
      alreadySubscribed: false,
    });
  } catch (error) {
    // Lost the findOne/create race, or the unique index caught a duplicate.
    // Either way the subscriber already exists, which is a success for them.
    if (error?.code === 11000) {
      return res.status(200).json({
        message: ALREADY_SUBSCRIBED,
        alreadySubscribed: true,
      });
    }
    next(error);
  }
};

// ✅ Admin-only: list subscribers, newest first
export const getSubscribers = async (req, res) => {
  try {
    // `_id` breaks ties. createdAt has millisecond resolution, so two signups in
    // the same millisecond (a bulk import, or a test seeding a pair) would
    // otherwise come back in an arbitrary order and the list would shuffle
    // between identical requests. ObjectId increases monotonically, so it is a
    // reliable newest-first tiebreak.
    const subscribers = await Subscriber.find()
      .sort({ createdAt: -1, _id: -1 })
      .lean();
    res.json({ success: true, subscribers, total: subscribers.length });
  } catch (error) {
    console.error("❌ Error fetching subscribers:", error);
    res.status(500).json({ message: "Failed to fetch subscribers" });
  }
};