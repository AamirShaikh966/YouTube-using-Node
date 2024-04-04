// require("dotenv").config({ path: "./env" });
// import express from "express";
// const app = express();
import { app } from "./app.js";
import dotenv from "dotenv";
import connectDB from "./db/index.js";

dotenv.config({
  path: "./env"
});

connectDB()
  .then(() => {
    const portNumber = process.env.PORT || 8000;
    app.on("error", error => {
      console.log("Application not able to connect with the database: ", error);
    });
    app.listen(portNumber, () => {
      console.log(`Server is running at port : ${portNumber}`);
    });
  })
  .catch(err => {
    console.log("Database Connection Failed !!! ", err);
  });

/*
import express from "express";
const app = express();

(async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URL}/${DB_NAME}`);
    app.on("error", (error) => {
      console.log("Application not able to connect with the database: ", error);
      throw error;
    });

    app.listen(process.env.PORT, () => {
      console.log(`App is listening on port ${process.env.PORT}`);
    });
  } catch (error) {
    console.error("ERROR CONECTING DATABASE: ", error);
    throw err;
  }
})();
*/
