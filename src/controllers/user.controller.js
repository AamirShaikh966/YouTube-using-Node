import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiErrors.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken";

// Function to generate the refresh and access token
const generatingAccessAndRefreshToken = async userId => {
  try {
    // Find the user by using userId of the user from the User(which is in user.models.js file)
    const user = await User.findById(userId);
    // console.log(
    //   `This is user that we were found by using id of the user :\n ${user}`
    // );

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

  // console.log(`
  //   Fullname is: ${fullName}\n
  //   Email is: ${email}\n
  //   Username is: ${userName}\n
  //   Password is: ${password}
  // `);

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

  // console.log(`Existed user : ${existedUSer}`);

  if (existedUSer)
    // Throwing the error if user already been exist
    throw new apiError(
      409,
      "Username & email you entered has already been exist"
    );

  //////// Check for images and avatar
  // console.log("This is request.files", req.files);

  const avatarLocalPath = req.files.avatar[0].path;
  // console.log("Avatar file local path",avatarLocalPath);

  // const coverImageLocalPath = req.files.coverImage[0].path;
  // console.log("Cover image file local path",coverImageLocalPath);

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
  // console.log(avatar);

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  // console.log(coverImage);

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
  console.log("User has been created : \n", user);

  //////// Remove password and refresh token fields from the response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  console.log(
    "Removed the password & refreshToken while sending the response  : \n",
    createdUser
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
      $set: {
        refreshToken: undefined
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
    .json(new apiResponse(200, user, "Avatar file updated successfully"));
});

// Update the cover image functionality
export const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file.path;

  if (!coverImageLocalPath)
    throw new apiError(400, "Cover image file is missing");

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
});

// If we export the function in curly braces then we must import it using curly braces
// If we export the function without using curly braces then we dont need to use curly braces
