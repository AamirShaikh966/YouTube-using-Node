import { Router } from "express";
import {
  registerUser,
  loginUser,
  logoutUser
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// This function will call when user goes to the register page
router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1
    },
    {
      name: "coverImage",
      maxCount: 1
    }
  ]),
  registerUser
);

// This function will call when user goes to the login page
router.route("/login").post(loginUser);

// This function will call when user logout
router.route("/logout").post(verifyJWT, logoutUser);
export default router;
