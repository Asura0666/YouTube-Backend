import { Tweet } from "../models/tweet.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";

const isOwnerOfTweet = async (tweetId, userId) => {
  try {
    const tweet = await Tweet.findById(tweetId);

    if (!tweet) {
      throw new ApiError(404, "Tweet does not exist");
    }

    if (tweet.owner.toString() !== userId.toString()) {
      return false;
    }

    return true;
  } catch (error) {
    throw new ApiError(500, "Something went wrong");
  }
};

const createTweet = asyncHandler(async (req, res) => {
  const { tweetContent } = req.body;

  if (!tweetContent) {
    throw new ApiError(400, "Content is required");
  }

  try {
    const tweet = await Tweet.create({
      content: tweetContent,
      owner: req.user?._id,
    });

    if (!tweet) {
      throw new ApiError(500, "Unable to create tweet!!");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, tweet, "Tweet published successfully"));
  } catch (error) {
    throw new ApiError(500, error?.message || "Unable to create tweet");
  }
});

const updateTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!tweetId || !isValidObjectId(tweetId)) {
    throw new ApiError(400, "TweetId is required or invalid");
  }

  const { tweetContent } = req.body;

  if (!tweetContent) {
    throw new ApiError(400, "tweetContent is required");
  }

  try {
    const isOwner = await isOwnerOfTweet(tweetId, req.user?._id);

    if (!isOwner) {
      throw new ApiError(300, "Unauthorized Access");
    }

    const updatedTweet = await Tweet.findByIdAndUpdate(
      tweetId,
      {
        $set: {
          content: tweetContent,
        },
      },
      {
        new: true,
      }
    );

    if (!updatedTweet) {
      throw new ApiError(500, "Something went wrong while updating tweet");
    }

    return res
      .status(201)
      .json(new ApiResponse(201, updatedTweet, "Tweet updated Successfully"));
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "something went wrong while updating tweet..."
    );
  }
});

const deleteTweet = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;

  if (!tweetId || !isValidObjectId(tweetId)) {
    throw new ApiError(400, "TweetId is required or invalid");
  }

  try {
    const isOwner = await isOwnerOfTweet(tweetId, req.user?._id);

    if (!isOwner) {
      throw new ApiError(300, "Unauthorized Access");
    }

    const deletedTweet = await Tweet.findByIdAndDelete(tweetId);

    if (!deletedTweet) {
      throw new ApiError(500, "Unable to delete tweet");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, deletedTweet, "Tweet successfully deleted"));
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "Something went wrong while deleting tweet"
    );
  }
});

const getUsertweets = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  let { page = 1, limit = 10 } = req.query;

  if (!userId || !isValidObjectId(userId)) {
    throw new ApiError(400, "tweetId is required or invalid");
  }

  page = isNaN(page) ? 1 : Number(page);
  limit = isNaN(limit) ? 10 : Number(limit);

  if (page < 0) {
    page = 1;
  }

  if (limit <= 0) {
    limit = 10;
  }

  try {
    const tweets = await Tweet.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(userId),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "ownerInfo",
        },
      },
      {
        $unwind: "$ownerInfo",
      },
      {
        $lookup: {
          from: "likes",
          let: { tweetId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: ["$tweet", "$$tweetId"],
                },
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "likedBy",
                foreignField: "_id",
                as: "likedByInfo",
              },
            },
            {
              $unwind: "$likedByInfo",
            },
            {
              $project: {
                _id: 1,
                likedBy: 1,
                userInfo: {
                  userName: "$likedByInfo.userName",
                  avatar: "$likedByInfo.avatar",
                  fullName: "$likedByInfo.fullName",
                },
              },
            },
          ],
          as: "userslikes",
        },
      },
      {
        $addFields: {
          likesCount: {
            $size: "$userslikes",
          },
          isLiked: {
            $cond: {
              if: {
                $in: [
                  new mongoose.Types.ObjectId(req.user._id),
                  "$userslikes.likedBy",
                ],
              },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $project: {
          ownerInfo: {
            _id: "$ownerInfo._id",
            userName: "$ownerInfo.userName",
            avatar: "$ownerInfo.avatar",
            fullName: "$ownerInfo.fullName",
          },
          likesCount: 1,
          createdAt: 1,
          content: 1,
          _id: 1,
          isLiked: 1,
          userslikes: {
            $map: {
              input: "$userslikes",
              as: "userlike",
              in: {
                _id: "$$userlike._id",
                likedBy: "$$userlike.likedBy",
                userInfo: "$$userlike.userInfo",
              },
            },
          },
        },
      },
      {
        $skip: (page - 1) * limit,
      },
      {
        $limit: limit,
      },
    ]);

    if (!tweets || tweets.length === 0) {
      throw new ApiError(404, "No Tweets");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, tweets, "Tweets fetched successfully"));
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "something went wrong while fetching tweets by userId"
    );
  }
});

export { createTweet, getUsertweets, updateTweet, deleteTweet };
