import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiErrors.js";
import { User } from "../models/user.models.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary
} from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// Function to generate the refresh and access token
const generatingAccessAndRefreshToken = async userId => {
  try {
    // Find the user by using userId of the user from the User(which is in user.models.js file)
    const user = await User.findById(userId);

    // Call the methods  to generate the tokens and store it in a seperate variable
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    //

    // Add the refreshToken to the user object
    user.refreshToken = refreshToken;

    // When we try to save the object in database using save() method then it will kickin(called) the whole user model and validate the fields (ex. It will check for password that were required). So we are using validateBeforeSave() method which is false. This method will not validate the required fields that are in the user.models.js file. It will directly save the user data in to the database without applying the validations.
    await user.save({ validateBeforeSave: false });

    // Returnig both the tokens
    return { accessToken, refreshToken };
  } catch (error) {
    // Throwing error if somehow token could not been generated
    throw new apiError(
      500,
      "Something went wrong while generating access and refresh token"
    );
  }
};

// Registration functionality
export const registerUser = asyncHandler(async (req, res) => {
  //////// Get the details of user from the frontend

  // Storing every field in a seperate variable
  const { fullName, email, userName, password } = req.body;

  //////// Validate the details like each field must not empty
  const validation =
    fullName === "" || email === "" || userName === "" || password === "";

  // Throwing the error if one of the fields is empty using apiError
  if (validation) throw new apiError(400, "All the fields required");

  //////// Check if user is already exist or not by using username and email

  // This findOne method will check if user is already exist or not
  const existedUSer = await User.findOne({
    $or: [{ userName }, { email }]
  }); // If true means user exists else false

  if (existedUSer)
    // Throwing the error if user already been exist
    throw new apiError(
      409,
      "Username & email you entered has already been exist"
    );

  //////// Check for images and avatar
  const avatarLocalPath = req.files.avatar[0].path;

  // This is for checking if cover image is empty
  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) throw new apiError(400, "Avatar file is required");

  //////// Upload them to the cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatarLocalPath) throw new apiError(400, "Avatar file is required");

  //////// Create object of user as well as create entry in database for that user
  const user = await User.create({
    fullName,
    email,
    password,
    userName: userName.toLowerCase(),
    avatar: avatar.url,
    coverImage: coverImage.url || ""
  });

  //////// Remove password and refresh token fields from the response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  //////// Check if user has been created or not??
  if (!createdUser)
    throw new apiError(500, "Something went wrong while registering user");

  //////// Return response to the user side
  return res
    .status(201)
    .json(new apiResponse(200, createdUser, "User registered successfully "));
});

// Login functionality
export const loginUser = asyncHandler(async (req, res) => {
  // Get the data from the user

  // Storing the data in a seperate variable
  const { userName, email, password } = req.body;

  // Verify the user details from the database

  // Check if username or email is empty then throw error
  if (!(userName || email))
    throw new apiError(400, "Username or email is required");

  // Find the user according to the details entered by User
  const user = await User.findOne({
    $or: [{ userName }, { email }]
  });

  // Throw error if user does not exist
  if (!user) throw new apiError(404, "User does not exist");

  // Verify the password using isPasswordCorrect method which has been provided by bcrypt library
  const isPasswordValid = await user.isPasswordCorrect(password);

  // Thorw error if password is not valid
  if (!isPasswordValid) throw new apiError(401, "Invalid user credentials");

  // Calling generateAccessAndRefreshToken function and store the accessToken and refreshToken in a seperate variable
  const { accessToken, refreshToken } = await generatingAccessAndRefreshToken(
    user._id
  );

  // Creating another variable which hold the values that we want to send to the user(Front-end Side)
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true
  };

  // Returning the response if user logged in successfully
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new apiResponse(
        200,
        { user: loggedInUser, refreshToken, accessToken },
        "User logged in successfully"
      )
    );
});

// Logout functionality
export const logoutUser = asyncHandler(async (req, res) => {
  // Finding the loggedin user and delete the refreshToken from the database using $set method
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1
      }
    },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new apiResponse(200, {}, "User logged out "));
});

// Refreshing access token
export const refreshAccessToken = asyncHandler(async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) throw new apiError(401, "Unauthorized request");

    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken._id);

    if (!user) throw new apiError(401, "Invalid refresh token");

    if (incomingRefreshToken !== user.refreshToken)
      throw new apiError(401, "Refresh token is expired or used");

    const options = {
      httpOnly: true,
      secure: true
    };

    const {
      accessToken,
      newRefreshToken
    } = await generatingAccessAndRefreshToken(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new apiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new apiError(401, error.message || "Invalid refresh token");
  }
});

// Change password functionality
export const changeCurrentPassword = asyncHandler(async (req, res) => {
  // Take the oldPassword and newPassword from the user
  const { oldPassword, newPassword } = req.body;

  // Find that user by id of the user from the "User"
  const user = await User.findById(req.user._id);

  // Check if oldPassword is correct or not (This variable hold the true or false value)
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  // If oldPassword is false then it will throw the error
  if (!isPasswordCorrect) throw new apiError(400, "Invalid old password");

  // Set the newPassword in to the users password field
  user.password = newPassword;

  // Save the data without applying the validations
  user.save({ validateBeforeSave: false });

  // Return the response
  return res
    .status(200)
    .json(new apiResponse(200, {}, "Password changed successfully"));
});

// Get current loggedin user functionality
export const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new apiResponse(200, req.user, "Current user fetched successfully"));
});

// Update account details functionality
export const updateAccountDetails = asyncHandler(async (req, res) => {
  // Get the fullName and email from the user for updation
  const { fullName, email } = req.body;

  // If any of the fields are empty then throw error
  if (!fullName || !email) throw new apiError(400, "All fields are required");

  // Find the user from the "User" and update the fullName and email using $set method
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullName,
        email
      } // $set method will set the updated values in to the database and update it
    },
    { new: true } // new:true :->it will return the new updated data from the database after the updation
  ).select("-password");

  // Return the response if account details has been successfully updated
  return res
    .status(200)
    .json(new apiResponse(200, user, "Account details updated successsfully"));
});

// Update the avatar functionality
export const updateUserAvatar = asyncHandler(async (req, res) => {
  // Get the path of the avatar from the user
  const avatarLocalPath = req.file.path;

  // If avatar path is invalid then throw error
  if (!avatarLocalPath) throw new apiError(400, "Avatar file is missing");

  ///////////This delete method is from someone from the github if something went wrong then comment this code and uncomment the below code////////////

  const user = await User.findById(req.user._id).select(
    "-password -refreshToken"
  );

  const oldFileToBeDeleted = await deleteFromCloudinary(user.avatar);

  if (!oldFileToBeDeleted)
    throw new apiError(400, "Error while updating the avatar");

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  user.avatar = avatar.url;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new apiResponse(200, user, "Avatar image updated successfully"));
  //////////////////////

  /* 
  // Upload the avatar file on cloudinary using uploadOnCloudinary function that were present in to the utils/cloudinary.js
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  // Error if url of avatar has not been generated
  if (!avatar.url) throw new apiError(400, "Error while uploading the avatar");

  // Find the user and update the avatar url
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { avatar: avatar.url }
    },
    { new: true }
  ).select("-password");

  // Return the response to the user
  return res
    .status(200)
    .json(new apiResponse(200, user, "Avatar file updated successfully"));*/
});

// Update the cover image functionality
export const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file.path;

  if (!coverImageLocalPath)
    throw new apiError(400, "Cover image file is missing");

  ///////////This delete method is from someone from the github if something went wrong then comment this code and uncomment the below code////////////

  const user = await User.findById(req.user._id).select(
    "-password -refreshToken"
  );

  const oldFileToBeDeleted = await deleteFromCloudinary(user.avatar);

  if (!oldFileToBeDeleted)
    throw new apiError(400, "Error while updating the cover image");

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  user.coverImage = coverImage.url;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new apiResponse(200, user, "Cover image updated successfully"));
  //////////////////////

  /*
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url)
    throw new apiError(400, "Error while uploading the cover image");

  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        coverImage: coverImage.url
      }
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json(new apiResponse(200, user, "Cover image file updated successfully"));
     */
});

// User / Channel profile functionality
export const getUserChannelProfile = asyncHandler(async (req, res) => {
  // Get the username by using params
  const { userName } = req.params;

  // Throw error if username is missing
  if (!userName) throw new apiError(400, "Username is missing");

  // MongoDB aggregation pipeline starts
  const channel = await User.aggregate([
    // match the username from the database
    {
      $match: {
        userName: userName.toLowerCase()
      }
    },
    // Fetch who is the subscribers of the user from subscription.models.js _id and foreign field is channel as subscribers
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers"
      }
    },
    // Fetch in which channel user has been subscribed to using subscription.models.js _id and foreign field is subscriber as subscribedTo
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo"
      }
    },
    // Add other fields
    // 1. Subscribers count of the channel
    // 2. Channels in which user has been subscribed to
    // 3. Subscribed or not?
    {
      $addFields: {
        subscribersCount: {
          size: "$subscribers"
        },
        channelsSubscribedToCount: {
          size: "$subscribedTo"
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user._id, "$subscribers.subscriber"] },
            then: true,
            else: false
          }
        }
      }
    },
    // This are the fields that is displayed on User / Channel profile page
    {
      $project: {
        fullName: 1,
        userName: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        coverImage: 1,
        avatar: 1,
        email: 1,
        createdAt: 1
      }
    }
  ]);

  // Throw error if channel does not exist
  if (!channel.length) throw new apiError(404, "Channel does not exist");

  // Return the response to the user and send only 0th index data
  return res
    .status(200)
    .json(
      new apiResponse(200, channel[0], "User channel fetched successfully")
    );
});

// User's Watch history functionality
export const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(req.user._id) }
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    avatar: 1,
                    userName: 1,
                    fullName: 1
                  }
                }
              ]
            }
          },
          {
            $addFields: {
              owner: {
                $first: "$owner"
              }
            }
          }
        ]
      }
    }
  ]);

  return res
    .status(200)
    .json(
      new apiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully"
      )
    );
});

// If we export the function in curly braces then we must import it using curly braces
// If we export the function without using curly braces then we dont need to use curly braces
