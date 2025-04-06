import mongoose, { Schema, Document } from "mongoose";

export interface IDriver extends Document {
  name: string;
  team: mongoose.Types.ObjectId;
  points: number;
}

const DriverSchema: Schema = new Schema({
  name: { type: String, required: true },
  team: { type: Schema.Types.ObjectId, ref: "Team" },
  points: { type: Number, default: 0 },
});

export default mongoose.models.Driver ||
  mongoose.model<IDriver>("Driver", DriverSchema);
