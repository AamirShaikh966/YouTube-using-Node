// For uploading the images to the cloudinary
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

export const uploadOnCloudinary = async localFilePath => {
  try {
    // If file path not exist the this condition will return null
    if (!localFilePath) return null;

    // Upload the file on cloudinary
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto"
    });
  
    // File has been successfully uploaded
    // console.log("File is uploaded successfully : ", response.url);

    // If file has been uploaded successfully then unlink it from the cloudinary
    fs.unlinkSync(localFilePath);

    // Return the response
    return response;
  } catch (error) {
    // Remove the locally saved file because/as the upload operation got failed
    fs.unlinkSync(localFilePath);

    return null;
  }
};

// Delete the files from the cloudinary while updating the files
export const deleteFromCloudinary = async (url, resourceType = "image") => {
  const publicId = extractPublicId(url);

  try {
    const response = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });

    return response;
  } catch (error) {
    console.log(error);

    return null;
  }
};
