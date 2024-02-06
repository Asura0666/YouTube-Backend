import { Schema, model } from "mongoose";

const subsciptionSchema = new Schema({
  subcriber: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },
  channel: {
    type: Schema.Types.ObjectId,
    ref: "User"
  }
}, { timestamps: true });

export const Subsciption = model("Subscription", subsciptionSchema);
