import { asyncHandler } from "../utils/asyncHandler.js";
import { apiError } from "../utils/apiErrors.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { apiResponse } from "../utils/apiResponse.js";

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

    // When we try to save the object in database using save() method then it will kickin the whole user model and validate the fields (ex. It will check for password that were required). So we are using validateBeforeSave() method which is false. This method will not validate the required fields that are in the user.models.js file. It will directly save the user data in to the database without applying the validations.
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
  console.log(
    "This is coming from USER Variable from user.controller.js : \n",
    user
  );

  //////// Remove password and refresh token fields from the response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  console.log(
    "This is coming from CREATEDUSER variable from user.controller.js : \n",
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

// If we export the function in curly braces then we must import it using curly braces
// If we export the function without using curly braces then we dont need to use curly braces
