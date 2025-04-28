// models/Track.ts
import mongoose from "mongoose";

const TrackSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  active: { type: Boolean, default: true },    // <-- new flag
});

export default mongoose.models.Track ||
  mongoose.model("Track", TrackSchema);
