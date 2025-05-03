// models/Track.ts
import mongoose, { Schema, model } from "mongoose";

const TrackSchema = new Schema(
  {
    name:   { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

export default mongoose.models.Track || model("Track", TrackSchema);
