import mongoose from "mongoose";
import mongooseAutopopulate from "mongoose-autopopulate";

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // Not required - supports guest checkout
      autopopulate: { select: "name email" },
    },
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
          autopopulate: { select: "name price image" }, // optional
        },
        name: { type: String, required: true },      // snapshot of product name
        price: { type: Number, required: true },     // snapshot of product price
        image: { type: String },                     // snapshot of product image
        sku: { type: String },                       // merchant product code at time of order
        quantity: { type: Number, required: true, min: 1 },
      },
    ],
    total_amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "paid", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    customer_email: {
      type: String,
      required: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    shipping_address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
    },
    payment_info: {
      method: { type: String, enum: ["card", "paypal", "cash_on_delivery"], default: "card" },
      transaction_id: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

// 🔹 Calculate total amount
orderSchema.methods.calculateTotal = function () {
  this.total_amount = this.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  return this.total_amount;
};

// 🔹 Create order from cart with product snapshots
orderSchema.statics.createFromCart = async function (cart, user, email, shippingAddress) {
  if (!cart || cart.items.length === 0) throw new Error("Cart is empty");

  const orderItems = cart.items.map((item) => ({
    product: item.product._id || item.product,
    name: item.product.name,
    price: item.product.price,
    image: item.product.image,
    sku: item.product.sku,
    quantity: item.quantity,
  }));

  const totalAmount = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const order = new this({
    user,
    items: orderItems,
    total_amount: totalAmount,
    customer_email: email,
    shipping_address: shippingAddress,
  });

  return order.save();
};

// Indexes for the recommendation engine and order history lookups.
// - user+status: seeds a signed-in shopper's own non-cancelled orders.
// - status+items.product: popularity and co-purchase aggregations.
orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ status: 1, "items.product": 1 });

// Enable auto-populate
orderSchema.plugin(mongooseAutopopulate);

const Order = mongoose.model("Order", orderSchema);

export default Order;
