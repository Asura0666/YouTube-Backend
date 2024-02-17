import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Playlist } from "../models/playlist.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Video } from "../models/video.models.js";
import mongoose, { isValidObjectId } from "mongoose";

const isUserOwnerOfPlaylist = async (playlistId, userId) => {
  try {
    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
      throw new ApiError(404, "playlist does not exist");
    }

    if (playlist.owner.toString() !== userId.toString()) {
      return false;
    }

    return true;
  } catch (error) {
    throw new ApiError(500, error?.message || "Playlist Not Found");
  }
};

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) {
    throw new ApiError(400, "Playlist name is required");
  }

  let playlistDescription = description || "add description";

  try {
    const playlist = await Playlist.create({
      name,
      description: playlistDescription,
      owner: req.user?._id,
      videos: [],
    });

    if (!playlist) {
      throw new ApiError(500, "Something went wrong while creating a playlist");
    }

    return res
      .status(201)
      .json(new ApiResponse(200, playlist, "Playlist created successfully"));
  } catch (error) {
    throw new ApiError(500, error?.message || "Unable to create playlist");
  }
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (
    !playlistId ||
    !videoId ||
    !isValidObjectId(videoId) ||
    !isValidObjectId(playlistId)
  ) {
    throw new ApiError(400, "playlistId and videoId both are required");
  }

  try {
    const userOwner = await isUserOwnerOfPlaylist(playlistId, req.user?._id);

    if (!userOwner) {
      throw new ApiError(300, "Unauthorized Access");
    }

    const video = await Video.findById(videoId);

    if (
      !video ||
      (!(video.owner.toString() === req.user?._id.toString()) &&
        !video.isPublished)
    ) {
      throw new ApiError(404, "Video not found");
    }

    const playlist = await Playlist.findById(playlistId);

    if (playlist.videos.includes(videoId)) {
      return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video is already present in Playlist"));
    }

    const addedPlaylist = await Playlist.findByIdAndUpdate(
      { _id: new mongoose.Types.ObjectId(playlistId) },
      {
        $push: { videos: videoId },
      },
      { new: true }
    );

    if (!addedPlaylist) {
      throw new ApiError(500, "Unable to add the video to playlist");
    }

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          addedPlaylist,
          "video successfully added to the playlist "
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "Unable to add video to the playlist"
    );
  }
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;

  if (
    !playlistId ||
    !videoId ||
    !isValidObjectId(playlistId) ||
    !isValidObjectId(videoId)
  ) {
    throw new ApiError(400, "playlistId and videoId both are required");
  }

  try {
    const userOwner = await isUserOwnerOfPlaylist(playlistId, req.user._id);

    if (!userOwner) {
      throw new ApiError(300, "Unauthorized Access");
    }

    const video = await Video.findById(videoId);

    if (!video) {
      throw new ApiError(404, "Video not found");
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist.videos.includes(videoId)) {
      throw new ApiError(404, "No video found in playlist");
    }

    const updatedVideoPlaylist = await Playlist.findByIdAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
      {
        $pull: { videos: videoId },
      },
      {
        new: true,
      }
    );

    if (!updatedVideoPlaylist) {
      throw new ApiError(500, "Unable to remove video from the playlist");
    }

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          updatedVideoPlaylist,
          "Video successfully removed from the playlist"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "Unable to remove video from the playlist"
    );
  }
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;

  if (!playlistId || !isValidObjectId(playlistId)) {
    throw new ApiError(400, "playlistId is required or invalid ");
  }

  try {
    const authorized = await isUserOwnerOfPlaylist(playlistId, req.user?._id);

    if (!authorized) {
      throw new ApiError(300, "Unauthorized Access");
    }

    const playlist = await Playlist.findById(playlistId);

    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
      {
        $set: {
          isPublished: !playlist.isPublished,
        },
      },
      {
        new: true,
      }
    );

    if (!updatedPlaylist) {
      throw new ApiError(500, "Unable to toggle publish status");
    }

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          updatedPlaylist,
          "Successfully toggle published status of playlist"
        )
      );
  } catch (error) {
    throw new ApiError(
      500,
      error?.message || "Something went wrong while toggling publish status of playlist"
    );
  }
});

export { createPlaylist, addVideoToPlaylist, removeVideoFromPlaylist, togglePublishStatus };
