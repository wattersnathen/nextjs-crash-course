import mongoose, { Document, Model, Schema, Types } from "mongoose";

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
bookingSchema.pre("save", async function (next) {
  // Only validate the reference when eventId is new or has changed
  if (!this.isModified("eventId")) return next();

  const EventModel = mongoose.models.Event;
  if (!EventModel) {
    return next(new Error("Event model is not registered"));
  }

  const eventExists = await EventModel.exists({ _id: this.eventId });
  if (!eventExists) {
    return next(new Error(`No event found with ID: ${String(this.eventId)}`));
  }

  next();
});

// Guard against model re-registration on Next.js hot reloads
const Booking: Model<IBooking> =
  mongoose.models.Booking ?? mongoose.model<IBooking>("Booking", bookingSchema);

export default Booking;
