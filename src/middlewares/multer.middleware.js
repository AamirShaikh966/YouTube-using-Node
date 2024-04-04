import multer from "multer";

const storage = multer.diskStorage({
  // CB means CallBack
  // On which folder you want to store your file
  destination: (req, file, cb) => {
    // Storing the file in below location
    cb(null, "./public/temp");
  },
  filename: (req, file, cb) => {
    // Give file name according to it's original name
    cb(null, file.originalname);
    console.log("Uploaded Filename is : ", file.originalname);
  }
});

export const upload = multer({ storage });
