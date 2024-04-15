import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const userSchema = new Schema(
  {
    userName: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true, //Trim() method will remove the white space from the starting and ending of the string
      index: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    password: {
      type: String,
      required: [true, "Password is Required"]
    },
    avatar: {
      type: String, // Used cloudinary services to get the URL
      required: true
    },
    coverImage: {
      type: String // Used cloudinary services to get the URL
    },
    watchHistory: [
      {
        type: Schema.Types.ObjectId,
        ref: "Video"
      }
    ],
    refreshToken: {
      type: String
    }
  },
  { timestamps: true }
);

// Firstly this function will be called whenever the saving the data
userSchema.pre("save", async function(next) {
  // If password has not been modified then it will go to the next functionality
  if (!this.isModified("password")) return next();

  // If password has been modified then it will encrypt it using 10 rounds
  // Once password has been encrypted using bcrypt.hash method then we can not get the password in human readable format
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// When user is logging in then this method will check that user is entered correct password or not
userSchema.methods.isPasswordCorrect = async function(password) {
  // User entered password = encrypted password that were created by bcrypt.hash
  return await bcrypt.compare(password, this.password);
};

// Generating the access token
userSchema.methods.generateAccessToken = function() {
  return jwt.sign(
    {
      _id: this._id,
      userName: this.userName,
      fullName: this.fullName,
      email: this.email
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY
    }
  );
};

// Generating the refresh token
userSchema.methods.generateRefreshToken = function() {
  return jwt.sign(
    {
      _id: this._id
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY
    }
  );
};

export const User = mongoose.model("User", userSchema);
