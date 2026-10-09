import mongoose from "mongoose";

const subscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      // One row per address. The controller also checks for an existing
      // subscriber up front; this index is the backstop against two
      // concurrent submissions slipping past that check.
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
      maxlength: 200,
    },
    // Which form the subscriber came through, so the list can be segmented
    // later without guessing.
    source: { type: String, enum: ["home", "footer"], default: "home" },
  },
  { timestamps: true }
);

const Subscriber = mongoose.model("Subscriber", subscriberSchema);

export default Subscriber;