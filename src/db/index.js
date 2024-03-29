import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URL}/${DB_NAME}`
    );
    console.log(
      `\n MongoDB Connected !! DB_HOST: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.log("Unable to connect the Database: ", error);
    process.exit(1);
  }
};
export default connectDB;
