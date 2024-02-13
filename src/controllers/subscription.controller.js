import mongoose from "mongoose";
import { Subscription } from "../models/subscription.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  if (!channelId) {
    throw new ApiError(400, "Channel Id is required");
  }

  const userId = req.user?._id;

  const credential = { subscriber: userId, channel: channelId };

  try {
    const subscribed = await Subscription.findOne(credential);
    if (!subscribed) {
      const newSubscription = await Subscription.create(credential);
      if (!newSubscription) {
        throw new ApiError(500, "Unable to subscibe channel");
      }
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            newSubscription,
            "Channel Subscribed successfully"
          )
        );
    } else {
      const deletedSubscription = await Subscription.deleteOne(credential);
      if (!deletedSubscription) {
        throw new ApiError(500, "Unable to Unsubscribe channel");
      }

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            deletedSubscription,
            "Channel Unsubscribed successfully"
          )
        );
    }
  } catch (error) {
    throw new ApiError(500, error?.message || "Unable to toggle Subscription");
  }
});

const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;

  if (!subscriberId) {
    throw new ApiError(400, "subscriberId is required");
  }

  try {
    const subscribers = await Subscription.aggregate([
      {
        $match: {
          channel: new mongoose.Types.ObjectId(subscriberId),
        },
      },
      {
        $group: {
          _id: "channel",
          subscribers: { $push: "$subscriber" },
        },
      },
      {
        $project: {
          _id: 0,
          subscribers: 1,
        },
      },
    ]);

    if (!subscribers || subscribers.length === 0) {
      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            subscribers,
            "No Subscriber found for the channel"
          )
        );
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, subscribers, "All Subscriber fetched successfully")
      );
  } catch (error) {
    throw new ApiError(500, error?.message || "Unable to fetch subscribers");
  }
});



export {toggleSubscription, getUserChannelSubscribers}