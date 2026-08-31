import mongoose, { Document } from "mongoose";
import { comparePassword, hashPassword } from "../../utils/crypt.utils.js";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  emailVerifiedAt: Date | null;
  authenticate: (password: string) => Promise<boolean>;
}

const userSchema = new mongoose.Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      trim: true,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

userSchema.methods.authenticate = async function (password: string) {
  return await comparePassword(password, this.password);
};

userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    this.password = await hashPassword(this.password);
  }
});

const User = mongoose.model("User", userSchema);

export default User;
