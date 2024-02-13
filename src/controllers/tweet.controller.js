import { Tweet } from "../models/tweet.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

export { createTweet };
