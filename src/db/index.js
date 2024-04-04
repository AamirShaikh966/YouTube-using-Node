import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    // Connecting to the database
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );

    console.log(
      `\n MongoDB Connected !! DB_HOST: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    // Throw the error if database has not been connected
    console.log("Unable to connect the Database: ", error);
    process.exit(1);
  }
};

export default connectDB;
