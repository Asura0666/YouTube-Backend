import mongoose from "mongoose";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Video } from "../models/video.models.js";
import { Comment } from "../models/comment.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  const { page = 1, limit = 10 } = req.query;

  if (!videoId) {
    throw new ApiError(400, "videoId is required");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    await Comment.deleteMany({ video: videoId });
    throw new ApiError(
      404,
      "There is no such video. All associated comment have been deleted."
    );
  }

  const commentsAggregate = Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
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
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: { $in: [req.user?._id, "likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        content: 1,
        createdAt: 1,
        likesCount: 1,
        owner: {
          userName: 1,
          fullName: 1,
          avatar: 1,
        },
        isLiked: 1,
      },
    },
  ]);

  const options = {
    page: +(page, 10),
    limit: +(limit, 10),
  };

  const comments = await Comment.aggregatePaginate(commentsAggregate, options);

  if (!comments || comments.length === 0) {
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "No comments in this video"));
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        comments,
        "Comments of the video fetched successfully"
      )
    );
});

const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { commentContent } = req.body;

  if (!videoId) {
    throw new ApiError(400, "videoId is required");
  }

  if (!commentContent) {
    throw new ApiError(400, "content is required");
  }

  try {
    const video = await Video.findById(videoId);
    if (
      !video ||
      (video?.owner.toString() !== req.user?._id.toString() &&
        !video.isPublished)
    ) {
      throw new ApiError(400, "There is no such video");
    }

    const comment = await Comment.create({
      content: commentContent,
      video: videoId,
      owner: req.user?._id,
    });

    if (!comment) {
      throw new ApiError(500, "Unable to create comment");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, comment, "comment posted successfully"));
  } catch (error) {
    throw new ApiError(500, error?.message || "Unable to create comment");
  }
});

export { addComment, getVideoComments };
