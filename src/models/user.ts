import bcrypt from "bcryptjs";
import mongoose, { Document } from "mongoose";

interface IUser extends Document {
  name: string;
  email: string;
  hash_password: string;
  authenticate: (password: string) => boolean;
}

const userSchema = new mongoose.Schema<IUser>({
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
  hash_password: {
    type: String,
    required: true,
    trim: true,
  },
});

userSchema.methods.authenticate = async function (password: string) {
  return await bcrypt.compare(password, this.hash_password);
};

const User = mongoose.model("User", userSchema);

export default User;
