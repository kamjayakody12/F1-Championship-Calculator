import mongoose, { Schema, Document } from "mongoose";

export interface IResult extends Document {
  track: string;
  position: number;
  driver: mongoose.Types.ObjectId;
  pole: boolean;
  fastestLap: boolean;
}

const ResultSchema: Schema = new Schema({
  track: { type: String, required: true },
  position: { type: Number, required: true },
  driver: { type: Schema.Types.ObjectId, ref: "Driver", required: true },
  pole: { type: Boolean, default: false },
  fastestLap: { type: Boolean, default: false },
});

export default mongoose.models.Result ||
  mongoose.model<IResult>("Result", ResultSchema);
