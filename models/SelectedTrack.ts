// models/SelectedTrack.ts
import mongoose, { Schema, model } from "mongoose";

const SelectedTrackSchema = new Schema(
  {
    track: { type: Schema.Types.ObjectId, ref: "Track", required: true },
  },
  { timestamps: true }
);

export default mongoose.models.SelectedTrack ||
       model("SelectedTrack", SelectedTrackSchema);
