import mongoose, { Schema, model, models } from "mongoose";

interface TrackDoc {
  name: string;
  date: Date;
}

const TrackSchema = new Schema<TrackDoc>(
  {
    name: { type: String, required: true, unique: true },
    date: { type: Date, required: true },
  },
  { timestamps: true }
);

export default models.Track || model<TrackDoc>("Track", TrackSchema);
