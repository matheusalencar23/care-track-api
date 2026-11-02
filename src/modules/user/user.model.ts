import mongoose, { Document } from "mongoose";
import { comparePassword, hashPassword } from "../../utils/crypt.utils.js";
import {
  BRAZILIAN_STATES,
  type BrazilianState,
} from "../../shared/brazilianStates.js";

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  // Número de inscrição no COREN e a UF do conselho regional: identificam a
  // enfermeira como autora dos registros (normas de registro do COFEN)
  coren: string;
  corenState: BrazilianState;
  emailVerifiedAt: Date | null;
  passwordChangedAt: Date | null;
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
    },
    coren: {
      type: String,
      required: true,
      trim: true,
    },
    corenState: {
      type: String,
      required: true,
      enum: BRAZILIAN_STATES,
    },
    emailVerifiedAt: {
      type: Date,
      default: null,
    },
    passwordChangedAt: {
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
