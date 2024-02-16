import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Like } from "../models/like.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Tweet } from "../models/tweet.models.js";
import { Comment } from "../models/comment.models.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId || !isValidObjectId(videoId)) {
    throw new ApiError(400, "videoId is required or invalid videoId");
  }
  try {
    const video = await Video.findById(videoId);

    if (!video) {
      throw new ApiError(404, "video not found");
    }

    const isLiked = await Like.findOne({
      video: video?._id,
      likedBy: req.user?._id,
    });

    if (!isLiked) {
      const likeDoc = await Like.create({
        video: video._id,
        likedBy: req.user._id,
      });

      return res
        .status(200)
        .json(new ApiResponse(200, likeDoc, "liked successfully"));
    }

    const unLikeDoc = await Like.findByIdAndDelete(isLiked._id);

    return res.status(200).json(new ApiResponse(200, unLikeDoc, "UnLiked Successfully"));
  } catch (error) {
    console.log("toggleVideoLike Error: ", error);
    throw new ApiError(500, "something went wrong", error);
  }
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  if (!commentId || !isValidObjectId(commentId)) {
    throw new ApiError(400, "commentId is required or Invalid commentId");
  }

  try {
    const comment = await Comment.findById(commentId);
    if (!comment) {
      throw new ApiError(404, "Comment not found");
    }

    const isLiked = await Like.findOne({
      comment: commentId,
      likedBy: req.user._id,
    });

    if (!isLiked) {
      const likeDoc = await Like.create({
        comment: commentId,
        likedBy: req.user._id,
      });

      return res
        .status(200)
        .json(new ApiResponse(200, likeDoc, "Liked Successfully"));
    }

    const unLikeDoc = await Like.findByIdAndDelete(isLiked._id);

    return res.status(200).json(new ApiResponse(200, unLikeDoc, "UnLiked Successfully"));
  } catch (error) {
    console.log("toggleCommentLike ERROR: ", error);
    throw new ApiError(500, "Something went wrong");
  }
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!tweetId || !isValidObjectId(tweetId)) {
    throw new ApiError(400, "tweetId is required or Invalid tweetId ");
  }

  try {
    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
      throw new ApiError(404, "Tweet not found");
    }

    const isLiked = await Like.findOne({
      tweet: tweetId,
      likedBy: req.user._id,
    });

    if (!isLiked) {
      const likeDoc = await Like.create({
        tweet: tweetId,
        likedBy: req.user._id,
      });

      return res
        .status(200)
        .json(new ApiResponse(200, likeDoc, "Liked Successfully"));
    }

    const unLikeDoc = await Like.findByIdAndDelete(isLiked._id);

    return res.status(200).json(new ApiResponse(200, unLikeDoc, "UnLiked Successfully"));
  } catch (error) {
    console.log("toggleTweetLike ERROR: ", error);
    throw new ApiError(500, "SomeThing went wrong");
  }
});

const getLikedVideos = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  try {
    const likedVideos = await Like.aggregate([
      {
        $match: {
          likedBy: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "video",
          foreignField: "_id",
          as: "likedVideos",
        },
      },
      {
        $unwind: "$likedVideos",
      },
      {
        $lookup: {
          from: "users",
          let: { owner_id: "$likedVideos.owner" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$_id", "$$owner_id"],
                },
              },
            },
            {
              $project: {
                avatar: 1,
                userName: 1,
                fullName: 1,
                _id: 0,
              },
            },
          ],
          as: "owner",
        },
      },
      {
        $unwind: {
          path: "$owner",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: "$likedVideos._id",
          title: "$likedVideos.title",
          thumbnail: "$likedVideos.thumbnail",
          duration: "$likedVideos.duration",
          createdAt: '$likedVideos.createdAt',
          views: '$likedVideos.views',
          owner: {
            userName: "$owner.userName",
            avatar: "$owner.avatar",
            fullName: "$owner.fullName",
          },
        },
      },
      {
        $group: {
          _id: null,
          likedVideos: {
            $push: "$$ROOT",
          },
        },
      },
      {
        $project: {
          _id: 0,
          likedVideos: 1,
        },
      },
    ]);

    if (likedVideos.length === 0) {
      return res
        .status(404)
        .json(new ApiResponse(404, [], "No liked videos found"));
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, likedVideos, "likedVideos fetched successfully")
      );
  } catch (error) {
    throw new ApiError(500, error?.message || "unable to fetch likedVideos");
  }
});

export { toggleVideoLike, toggleCommentLike, toggleTweetLike, getLikedVideos };
