import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import {
  deleteFromCloudinary,
  extractPublicIdFromUrl,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { userName, fullName, email, password } = req.body;
  // console.log(req.body);

  if (
    [fullName, email, userName, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  try {
    const existedUser = await User.findOne({ $or: [{ email }, { userName }] });

    if (existedUser) {
      throw new ApiError(409, "User already exist");
    }

    const avatarLocalPath = req.files.avatar && req.files.avatar[0]?.path;
    const coverImageLocalPath =
      req.files.coverImage && req.files.coverImage[0]?.path;

    // console.log(avatarLocalPath);

    if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is required");
    }

    const avatarResponse = await uploadOnCloudinary(avatarLocalPath);
    const coverImageResponse = await uploadOnCloudinary(coverImageLocalPath);

    // console.log(avatarResponse);

    if (!avatarResponse) {
      throw new ApiError(400, "Avatar file is required");
    }

    const user = await User.create({
      fullName,
      email,
      password,
      userName: userName.toLowerCase(),
      avatar: avatarResponse.url,
      coverImage: coverImageResponse?.url || "",
    });

    const createdUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    if (!createdUser) {
      throw new ApiError(500, "Something went wrong while creating the user");
    }

    return res
      .status(201)
      .json(new ApiResponse(200, createdUser, "User register successfully"));
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "Something went wrong while registering user"
    );
  }
});

const loginUser = asyncHandler(async (req, res) => {
  const { userName, email, password } = req.body;

  if (!userName && !email) {
    throw new ApiError(400, "at least give userName or email");
  }

  if (!password) {
    throw new ApiError(400, "password is required");
  }
  try {
    const user = await User.findOne({
      $or: [{ userName }, { email }],
    });

    if (!user) {
      throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid User Credentials");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    const loggedInUser = await User.findById(user._id).select(
      "-password -refreshToken"
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            user: loggedInUser,
            accessToken,
            refreshToken,
          },
          "User Logged In Successfully"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "something went wrong while login"
    );
  }
});

const logoutUser = asyncHandler(async (req, res) => {
  try {
    await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: {
          refreshToken: undefined,
        },
      },
      {
        new: true,
      }
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, {}, "User Logged Out  "));
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "something went wrong while logout"
    );
  }
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized Request");
  }
  try {
    const decodedRefreshToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedRefreshToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh Token is used or expried");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
      user._id
    );

    const options = {
      httpOnly: true,
      secure: true,
    };

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken },
          "AccessToken refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh Token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  try {
    const user = await User.findById(req.user?._id);

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
      throw new ApiError(400, "Invalid old password");
    }

    user.password = newPassword;

    await user.save({ validateBeforeSave: false });

    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Password changed successfully"));
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "something went wrong while changing password"
    );
  }
});

const getCurrentUser = asyncHandler(async (req, res) => {
  try {
    return res
      .status(200)
      .json(
        new ApiResponse(200, req.user, "current user fetched successfully")
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "something went wrong while getting current user"
    );
  }
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  // console.log(fullName, "+", email);
  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }
  try {
    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          fullName: fullName,
          email: email,
        },
      },
      { new: true }
    ).select("-password -refreshToken");

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return res
      .status(201)
      .json(
        new ApiResponse(201, user, "Account detailed updated successfully")
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "something went wrong while updating account details"
    );
  }
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user?._id);

    if (!user) {
      throw new ApiError(404, "User Not Found");
    }

    const oldAvaterUrl = user.avatar;
    // console.log(oldAvaterUrl);
    if (oldAvaterUrl) {
      const publicId = await extractPublicIdFromUrl(oldAvaterUrl);
      const response = await deleteFromCloudinary(publicId);
      console.log(response.result);
    }

    const avatarLocalPath = req.files.avatar && req.files.avatar[0].path;
    if (!avatarLocalPath) {
      throw new ApiError(400, "Avatar file is missing...");
    }
    // console.log("avatarLocalPath",avatarLocalPath);

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar) {
      throw new ApiError(500, "Error while uploading on avatar");
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user?._id,
      {
        $set: {
          avatar: avatar.url,
        },
      },
      { new: true }
    ).select("-password -refreshToken");

    return res
      .status(201)
      .json(new ApiResponse(201, updatedUser, "Avatar Successfully Updated"));
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "something went wrong while updating user avatar"
    );
  }
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
  try {
    const user = await User.findById(req.user?._id);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const oldCoverImageUrl = user.coverImage;
    if (oldCoverImageUrl) {
      const publicId = await extractPublicIdFromUrl(oldCoverImageUrl);
      const response = await deleteFromCloudinary(publicId);
      console.log(response.result);
    }

    const coverImageLocalPath =
      req.files.coverImage && req.files.coverImage[0].path;

    if (!coverImageLocalPath) {
      throw new ApiError("Cover Image is missing...");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        $set: { coverImage: coverImage.url },
      },
      { new: true }
    ).select("-password -refreshToken");

    return res
      .status(201)
      .json(
        new ApiResponse(201, updatedUser, "Cover Image Changed successfully")
      );
  } catch (error) {
    throw new ApiError(500, "something went wrong while updating cover image");
  }
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { userName } = req.params;

  if (!userName?.trim()) {
    throw new ApiError(400, "userName is missing");
  }
  try {
    const channel = await User.aggregate([
      {
        $match: {
          userName: userName?.toLowerCase(),
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "channel",
          as: "subscribers",
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "_id",
          foreignField: "subscriber",
          as: "subscribeTo",
        },
      },
      {
        $addFields: {
          subscribersCount: {
            $size: "$subscribers",
          },
          channelsSubscribedToCount: {
            $size: "$subscribeTo",
          },
          isSubscribed: {
            $cond: {
              if: { $in: [req.user?._id, "$subscribers.subscriber"] },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $project: {
          fullName: 1,
          userName: 1,
          email: 1,
          avatar: 1,
          coverImage: 1,
          createdAt: 1,
          isSubscribed: 1,
          subscribersCount: 1,
          channelsSubscribedToCount: 1,
        },
      },
    ]);

    if (!channel?.length) {
      throw new ApiError(404, "channel does not exists");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message ||
        "something went wrong while getting user channel profile"
    );
  }
});

const getWatchUserHistory = asyncHandler(async (req, res) => {
  try {
    const user = await User.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.user._id),
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "watchHistory",
          foreignField: "_id",
          as: "watchHistory",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                  {
                    $project: {
                      fullName: 1,
                      userName: 1,
                      avatar: 1,
                    },
                  },
                  {
                    $addFields: {
                      owner: {
                        $first: "$owner",
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    ]);

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          user[0].watchHistory,
          "successfully get user watch history"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "something went wrong while getting user watch history"
    );
  }
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
  getWatchUserHistory,
};
