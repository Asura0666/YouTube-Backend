import { Video } from "../models/video.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import mongoose, { Query, isValidObjectId } from "mongoose";

const isUserOwner = async (videoId, req) => {
  const video = await Video.findById(videoId);

  if (video?.owner.toString() !== req.user._id.toString()) {
    return false;
  }

  return true;
};

const getAllVideos = asyncHandler(async (req, res) => {
  let { page = 1, limit = 10, sortBy, sortType, query, userId } = req.query;

  page = parseInt(page, 10);
  limit = parseInt(limit, 10);

  page = Math.max(1, page);
  limit = Math.min(20, Math.max(1, limit));

  let pipeline = [];

  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(404, "Invalid userId");
    }

    pipeline.push({
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    });
  }

  if (query) {
    pipeline.push({
      $match: {
        $text: {
          $search: query,
        },
      },
    });
  }

  let sortCriteria = {};
  if (sortBy && sortType) {
    sortCriteria[sortBy] = sortType === "asc" ? 1 : -1;
    pipeline.push({
      $sort: sortCriteria,
    });
  } else {
    sortCriteria["createdAt"] = -1;
    pipeline.push({
      $sort: sortCriteria,
    });
  }

  pipeline.push({
    $skip: (page - 1) * 20,
  });
  pipeline.push({
    $limit: limit,
  });

  const videos = await Video.aggregate(pipeline);

  if (!videos || videos.length === 0) {
    throw new ApiError(404, "Videos not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

const uploadVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if ([title, description].some((field) => field.trim() === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const videoLocalPath = req.files.videoFile && req.files.videoFile[0]?.path;
  const thumbnailLocalPath =
    req.files.thumbnailFile && req.files.thumbnailFile[0]?.path;

  if (!videoLocalPath) {
    throw new ApiError(400, "VideoFile is required");
  }

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Thumbnail is required");
  }

  const videoResponse = await uploadOnCloudinary(videoLocalPath);
  const thumbnailResponse = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoResponse || !thumbnailResponse) {
    throw new ApiError(500, "Error while uploading video");
  }

  const publishVideo = await Video.create({
    videoFile: videoResponse.url,
    thumbnail: thumbnailResponse.url,
    duration: videoResponse.duration,
    owner: req.user._id,
    title,
    description,
  });

  if (!publishVideo) {
    throw new ApiError(500, "Something went wrong while publishing video");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, publishVideo, "video published successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new ApiError(400, "videoId is required");
  }

  const video = await Video.findById(videoId);

  if (
    !video ||
    (!video?.isPublished &&
      !(video?.owner.toString() === req.user?._id.toString()))
  ) {
    throw new ApiError(404, "Video does not exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, video, "Successfully get video"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new ApiError(400, "videoId is required");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video does not exist");
  }

  const authorized = await isUserOwner(videoId, req);

  if (!authorized) {
    throw new ApiError(300, "Unauthorized Access");
  }

  const { title, description } = req.body;

  if (!title || !description) {
    throw new ApiError(400, "Title or Description is required");
  }

  const oldThumbnailUrl = video.thumbnail;

  if (oldThumbnailUrl) {
    const publicId = await extractPublicIdFromUrl(oldThumbnailUrl);
    const response = await deleteFromCloudinary(publicId);
    console.log(response.result);
  }

  const thumbnailLocalPath = req.file && req.file.path;

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "thumbnail file is missing");
  }

  const thumbnailResponse = await uploadOnCloudinary(thumbnailLocalPath);

  if (!thumbnailResponse) {
    throw new ApiError(500, "Error while uploading on thumbnail");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title: title,
        description: description,
        thumbnail: thumbnailResponse?.url,
      },
    },
    {
      new: true,
    }
  );

  if (!updatedVideo) {
    throw new ApiError(500, "Something went wrong while updating the details");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {});

const togglePublishStatus = asyncHandler(async (req, res) => {});

export { getAllVideos, uploadVideo, getVideoById, updateVideo };
