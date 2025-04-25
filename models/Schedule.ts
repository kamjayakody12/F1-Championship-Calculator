// models/Schedule.ts
import mongoose from "mongoose";

const ScheduleSchema = new mongoose.Schema({
  track: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Track",
    required: true,
    unique: true,            // one schedule per track
  },
  date: { type: Date, required: true },
});

export default mongoose.models.Schedule ||
  mongoose.model("Schedule", ScheduleSchema);
