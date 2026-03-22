import mongoose, { Document, Model, Schema, Types } from "mongoose";
import Event from "./event.model"; // Ensures Event schema is registered before the pre-save hook runs

export interface IBooking extends Document {
  eventId: Types.ObjectId;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

// Matches standard email addresses; rejects whitespace and multiple @ symbols
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const bookingSchema = new Schema<IBooking>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      ref: "Event",
      required: [true, "Event ID is required"],
      // Index improves query performance when filtering bookings by event
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      // Normalize to lowercase so "User@Example.com" and "user@example.com" are treated equally
      lowercase: true,
      validate: {
        validator: (value: string) => EMAIL_REGEX.test(value),
        message: "Invalid email address format",
      },
    },
  },
  { timestamps: true }
);

/**
 * Pre-save hook: verifies the referenced event exists before persisting the booking.
 * Prevents orphaned bookings that point to non-existent events.
 */
bookingSchema.pre("save", async function () {
  // Only validate the reference when eventId is new or has changed
  if (!this.isModified("eventId")) return;

  const eventExists = await Event.exists({ _id: this.eventId });
  if (!eventExists) {
    throw new Error(`No event found with ID: ${String(this.eventId)}`);
  }
});

/**
 * Extracts eventId from a query update payload, checking $set then top-level.
 * Returns undefined for aggregation pipeline updates.
 */
function extractEventIdFromUpdate(
  query: mongoose.Query<unknown, IBooking>
): Types.ObjectId | undefined {
  const update = query.getUpdate() as mongoose.UpdateQuery<IBooking> | null;
  if (!update || Array.isArray(update)) return undefined;
  return (
    (update.$set as Partial<IBooking> | undefined)?.eventId ??
    (update as Partial<IBooking>).eventId
  );
}

/**
 * Query middleware: validate that eventId references an existing Event
 * for update operations.
 */
for (const op of ["findOneAndUpdate", "updateOne"] as const) {
  bookingSchema.pre(op, async function (this: mongoose.Query<unknown, IBooking>) {
    // Enable field validators and required checks for query-based updates
    this.setOptions({ runValidators: true, context: "query" });
    const eventId = extractEventIdFromUpdate(this);
    if (!eventId) return;
    const eventExists = await Event.exists({ _id: eventId });
    if (!eventExists) {
      throw new Error(`No event found with ID: ${String(eventId)}`);
    }
  });
}

/**
 * Bulk insert middleware: verify all referenced events exist before insertion.
 */
bookingSchema.pre(
  "insertMany",
  async function (this: mongoose.Model<IBooking>, docs: IBooking[]) {
    for (const doc of docs) {
      if (!doc.eventId) continue;
      const eventExists = await Event.exists({ _id: doc.eventId });
      if (!eventExists) {
        throw new Error(`No event found with ID: ${String(doc.eventId)}`);
      }
    }
  }
);

// Guard against model re-registration on Next.js hot reloads
const Booking: Model<IBooking> =
  mongoose.models.Booking ?? mongoose.model<IBooking>("Booking", bookingSchema);

export default Booking;
