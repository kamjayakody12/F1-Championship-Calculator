// models/Track.ts
import mongoose from "mongoose";

const TrackSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
});

export default mongoose.models.Track ||
  mongoose.model("Track", TrackSchema);
