import { Video } from "../models/video.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import mongoose, { isValidObjectId } from "mongoose";

const isUserOwner = async (videoId, req) => {
  const video = await Video.findById(videoId);

  if (video?.owner.toString() !== req.user._id.toString()) {
    return false;
  }

  return true;
};

const getAllVideos = asyncHandler(async (req, res) => {
  let { page = 1, limit = 5, query, sortBy, sortType, userId } = req.query;

  page = isNaN(page) ? 1 : Number(page);
  limit = isNaN(limit) ? 5 : Number(limit);

  if (page < 0) {
    page = 1;
  }

  if (limit <= 0) {
    limit = 5;
  }

  const matchStage = {};
  if (userId && isValidObjectId(userId)) {
    matchStage["$match"] = {
      "ownerInfo.owner_id": new mongoose.Types.ObjectId(userId),
    };
  } else if (query) {
    matchStage["$match"] = {
      $or: [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { "ownerInfo.userName": { $regex: query, $options: "i" } },
      ],
    };
  } else {
    matchStage["$match"] = {};
  }

  if (userId && query) {
    matchStage["$match"] = {
      $and: [
        {
          "ownerInfo.owner_id": new mongoose.Types.ObjectId(userId),
        },
        {
          $or: [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } },
            { "ownerInfo.userName": { $regex: query, $options: "i" } },
          ],
        },
      ],
    };
  }

  const sortStage = {};
  if (sortBy && sortType) {
    sortStage["$sort"] = {
      [sortBy]: sortType === "asc" ? 1 : -1,
    };
  } else {
    sortStage["$sort"] = {
      createdAt: -1,
    };
  }

  const videos = await Video.aggregate([
    {
      $match: {
        isPublished: true,
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $unwind: "$owner",
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $addFields: {
        likes: {
          $size: "$likes",
        },
      },
    },
    {
      $project: {
        _id: 1,
        title: 1,
        thumbnail: 1,
        views: 1,
        duration: 1,
        createdAt: 1,
        likes: 1,
        videoFile: 1,
        description: 1,
        ownerInfo: {
          owner_id: "$owner._id",
          userName: "$owner.userName",
          avatar: "$owner.avatar",
          fullName: "$owner.fullName",
        },
      },
    },
    matchStage,
    sortStage,
    {
      $skip: (page - 1) * limit,
    },
    {
      $limit: limit,
    },
    {
      $group: {
        _id: null,
        videos: {
          $push: "$$ROOT",
        },
      },
    },
    {
      $project: {
        _id: 0,
        videos: 1,
      },
    },
  ]);

  if (!videos) {
    throw new ApiError(404, "No videos found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "videos fetched successfully"));
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

  if (!videoId || !isValidObjectId(videoId)) {
    throw new ApiError(400, "videoid is required or invalid");
  }
  const authorized = await isUserOwner(videoId, req);

  if (!authorized) {
    throw new ApiError(401, "Unauthorized Access");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video does not exist");
  }

  const { title, description } = req.body;

  if (!title || !description) {
    throw new ApiError(400, "Title or Description is required");
  }

  let updatedVideoData = {
    title: title,
    description: description,
  };

  const newThumbnailLocalPath =
    req.files?.thumbnailFile && req.files.thumbnailFile[0].path;

  if (newThumbnailLocalPath) {
    const oldThumbnailFile = video.thumbnail;
    const publicId = await extractPublicIdFromUrl(oldThumbnailFile);
    await deleteFromCloudinary(publicId); // Delete old thumbnail from Cloudinary

    const newThumbnailResponse = await uploadOnCloudinary(
      newThumbnailLocalPath
    );
    if (!newThumbnailResponse?.url) {
      throw new ApiError(
        500,
        "Something went wrong while uploading thumbnail to Cloudinary"
      );
    }

    updatedVideoData.thumbnail = newThumbnailResponse.url;
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    { $set: updatedVideoData },
    { new: true }
  );

  if (!updatedVideo) {
    throw new ApiError(
      500,
      "Something went wrong while updating video details"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedVideo, "Video details updated successfully")
    );
});

const deleteVideo = asyncHandler(async (req, res) => {});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId && !isValidObjectId(videoId)) {
    throw new ApiError(400, "videoId is required or invalid");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video not found");
  }

  const authorized = await isUserOwner(videoId, req);

  if (!authorized) {
    throw new ApiError(300, "Unauthorized Access");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: !video.isPublished,
      },
    },
    { new: true }
  );

  if (!updatedVideo) {
    throw new ApiError(
      500,
      "Something went wrong while toggling publised status"
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedVideo,
        "PublishStatus of the video is toggle successfully"
      )
    );
});

export {
  getAllVideos,
  uploadVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
