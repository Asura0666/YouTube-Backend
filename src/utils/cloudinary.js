import { v2 as cloudinary } from "cloudinary";

import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'byasura',
  api_key: process.env.CLOUDINARY_API_KEY || '824536126862173',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'lbpHe4wjflCVuDcnXNh_wbrpqPs',
});


const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) {
      return null;
    }

    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    
    fs.unlinkSync(localFilePath); 
    // console.log("file is uploaded on cloudinary", response.url);
    return response;

  } catch (error) {
    fs.unlinkSync(localFilePath); // Remove the locally saved temporary file as upload operation got failed
    console.log('Cloudinary Error: ' + error);
    return null;
  }
};

export { uploadOnCloudinary };
