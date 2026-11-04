import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 6,
      select: false, // do not return password in queries by default
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    // Compressed data URL of the user's uploaded profile picture. Kept small
    // by the client (256x256 JPEG) and capped here as defence in depth.
    avatar: {
      type: String,
      default: "",
      maxlength: 700000,
    },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
    // Bumped on password change/reset. Tokens carry the version they were
    // issued with (`tv`); `protect` rejects any token whose version is stale,
    // which revokes every session the moment the password changes.
    tokenVersion: { type: Number, default: 0 },
    // Brute-force lockout. Consecutive failed logins are counted and, past a
    // threshold, the account is locked until `lockUntil` passes. Both fields are
    // hidden from queries by default.
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
    // TOTP two-factor auth. The secret and recovery-code hashes are never
    // returned by queries; only the enabled flag is public.
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    twoFactorRecoveryCodes: { type: [String], default: [], select: false },
    // Last successful sign-in context, used to detect logins from a new IP and
    // email the account owner a "new sign-in" heads-up. Hidden from queries.
    lastLoginIp: { type: String, default: "", select: false },
    lastLoginUserAgent: { type: String, default: "", select: false },
    lastLoginAt: { type: Date, default: null, select: false },
  },
  {
    timestamps: true,
  }
);

// 🔒 Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next(); // only hash if modified
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// 🔑 Compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// 🚫 Remove password from JSON responses
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};


const User = mongoose.model("User", userSchema);

export default User;
