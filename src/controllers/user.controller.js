import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { apiResponse } from "../utils/apiResponse.js";
import { apiError } from "../utils/apiErrors.js";
import { User } from "../models/user.models.js";

export const registerUser = asyncHandler(async (req, res) => {
  //////// Get the details of user from the frontend

  // Storing every field in a seperate variable
  const { fullName, email, userName, password } = req.body;

  console.log(`
    Fullname is: ${fullName}\n
    Email is: ${email}\n
    Username is: ${userName}\n
    Password is: ${password}
  `);

  //////// Validate the details like each field must not empty
  const validation =
    fullName === "" || email === "" || userName === "" || password === "";

  // Throwing the error if one of the fields is empty using apiError
  if (validation) throw new apiError(400, "All the fields required");

  //////// Check if user is already exist or not by using username and email

  // This findOne method will check if user is already exist or not
  const existedUSer = User.findOne({
    $or: [{ userName }, { email }]
  }); // If true means user exists else false

  console.log(`Existed user : ${existedUSer}`);

  if (existedUSer)
    // Throwing the error if user already been exist
    throw new apiError(
      409,
      "Username & email you entered has already been exist"
    );

  //////// Check for images and avatar
  console.log(req.files);

  const avatarLocalPath = req.files.avatar[0].path;
  console.log(avatarLocalPath);

  const coverImageLocalPath = req.files.coverImage[0].path;
  console.log(coverImageLocalPath);

  if (!avatarLocalPath) throw new apiError(400, "Avatar file is required");

  //////// Upload them to the cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  console.log(avatar);

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  console.log(coverImage);

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
  console.log(user);

  //////// Remove password and refresh token fields from the response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  console.log(createdUser);

  //////// Check if user has been created or not??
  if (!createdUser)
    throw new apiError(500, "Something went wrong while registering user");

  //////// Return response to the user side
  return res
    .status(201)
    .json(new apiResponse(200, createdUser, "User registered successfully "));
});

// export { registerUser };

// If we export the function in curly braces then we must import it using curly braces
// If we export the function without using curly braces then we dont need to use curly braces
