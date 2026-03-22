import mongoose, { Document, Model, Schema } from "mongoose";

export interface IEvent extends Document {
  title: string;
  slug: string;
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  date: string;
  time: string;
  mode: string;
  audience: string;
  agenda: string[];
  organizer: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: [true, "Title is required"], trim: true },
    // Slug is auto-generated from title; not required on input
    slug: { type: String, unique: true },
    description: { type: String, required: [true, "Description is required"], trim: true },
    overview: { type: String, required: [true, "Overview is required"], trim: true },
    image: { type: String, required: [true, "Image is required"], trim: true },
    venue: { type: String, required: [true, "Venue is required"], trim: true },
    location: { type: String, required: [true, "Location is required"], trim: true },
    date: { type: String, required: [true, "Date is required"] },
    time: { type: String, required: [true, "Time is required"] },
    mode: { type: String, required: [true, "Mode is required"], trim: true },
    audience: { type: String, required: [true, "Audience is required"], trim: true },
    agenda: { type: [String], required: [true, "Agenda is required"] },
    organizer: { type: String, required: [true, "Organizer is required"], trim: true },
    tags: { type: [String], required: [true, "Tags are required"] },
  },
  { timestamps: true }
);

/**
 * Converts a title into a URL-friendly slug.
 * Lowercases the string, removes non-alphanumeric characters, and joins words with hyphens.
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/**
 * Validates that the date string is an ISO calendar date (YYYY-MM-DD) and returns it unchanged.
 * Using new Date() for parsing is intentionally avoided — it shifts dates in timezones behind UTC.
 */
function normalizeDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date value: "${date}". Expected format: YYYY-MM-DD`);
  }

  // UTC round-trip check: catches invalid months/days and leap-year issues
  // e.g. "2026-13-01" or "2026-02-30" pass the regex but fail here
  const [year, month, day] = date.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() + 1 !== month ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date value: "${date}". Expected format: YYYY-MM-DD`);
  }

  return date;
}

/**
 * Normalizes a time string to a consistent 12-hour format (e.g. "09:00 AM").
 * Accepts either 12-hour ("9:00 AM") or 24-hour ("09:00") input.
 */
function normalizeTime(time: string): string {
  const trimmed = time.trim();

  // 12-hour input: pass through with zero-padded hour and uppercased period
  const match12 = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec(trimmed);
  if (match12) {
    const hourNum = parseInt(match12[1], 10);
    const minsNum = parseInt(match12[2], 10);
    // 12-hour clock: hour must be 1–12, minutes 0–59
    if (hourNum < 1 || hourNum > 12 || minsNum < 0 || minsNum > 59) {
      throw new Error(`Invalid time value: "${time}"`);
    }
    const hour = match12[1].padStart(2, "0");
    const mins = match12[2];
    const period = match12[3].toUpperCase();
    return `${hour}:${mins} ${period}`;
  }

  // 24-hour input: convert to 12-hour
  const match24 = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (match24) {
    const h = parseInt(match24[1], 10);
    const mins = match24[2];
    const minsNum = parseInt(mins, 10);
    // 24-hour clock: hour must be 0–23, minutes 0–59
    if (h < 0 || h > 23 || minsNum < 0 || minsNum > 59) {
      throw new Error(`Invalid time value: "${time}"`);
    }
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = String(h % 12 || 12).padStart(2, "0");
    return `${hour12}:${mins} ${period}`;
  }

  throw new Error(`Invalid time format: "${time}"`);
}

// Pre-save: generate slug from title (with collision handling), normalize date and time
eventSchema.pre("save", async function () {
  // Only regenerate the slug when the title is new or has changed
  if (this.isModified("title")) {
    const baseSlug = generateSlug(this.title);
    let slug = baseSlug;
    let suffix = 1;

    // Append an incremental suffix until a slug with no existing owner is found
    while (
      await (this.constructor as mongoose.Model<IEvent>).exists({
        slug,
        _id: { $ne: this._id },
      })
    ) {
      slug = `${baseSlug}-${suffix++}`;
    }

    this.slug = slug;
  }

  if (this.isModified("date")) {
    this.date = normalizeDate(this.date);
  }

  if (this.isModified("time")) {
    this.time = normalizeTime(this.time);
  }
});

/**
 * Reads title/date/time from a query update payload (handling both $set and
 * top-level syntax), normalizes them, and writes results back into $set.
 */
async function normalizeQueryUpdate(
  query: mongoose.Query<unknown, IEvent>
): Promise<void> {
  const update = query.getUpdate() as mongoose.UpdateQuery<IEvent> | null;
  if (!update || Array.isArray(update)) return;

  // Read a field from $set first, then fall back to the top-level update object
  const readField = (key: keyof IEvent): string | undefined => {
    const val =
      (update.$set as Partial<IEvent> | undefined)?.[key] ??
      (update as Partial<IEvent>)[key];
    return typeof val === "string" ? val : undefined;
  };

  // Canonicalize all writes into $set and remove any top-level duplicate
  const writeField = (key: string, value: string): void => {
    if (!update.$set) (update as mongoose.UpdateQuery<IEvent>).$set = {};
    (update.$set as Record<string, string>)[key] = value;
    delete (update as Record<string, unknown>)[key];
  };

  const title = readField("title");
  if (title !== undefined) {
    const baseSlug = generateSlug(title);
    let slug = baseSlug;
    let suffix = 1;
    // Exclude the document being updated from the collision check when _id is known
    const excludeId = (query.getFilter() as { _id?: unknown })._id;
    while (
      await query.model.exists({
        slug,
        ...(excludeId !== undefined ? { _id: { $ne: excludeId } } : {}),
      })
    ) {
      slug = `${baseSlug}-${suffix++}`;
    }
    writeField("slug", slug);
  }

  const date = readField("date");
  if (date !== undefined) writeField("date", normalizeDate(date));

  const time = readField("time");
  if (time !== undefined) writeField("time", normalizeTime(time));
}

// Query middleware: normalize slug, date, and time for update operations
for (const op of ["findOneAndUpdate", "updateOne", "updateMany"] as const) {
  eventSchema.pre(op, async function (this: mongoose.Query<unknown, IEvent>) {
    await normalizeQueryUpdate(this);
  });
}

/**
 * Bulk insert middleware: normalizes slug, date, and time on each document
 * before insertion. Docs have no _id yet so the slug collision check is global.
 */
eventSchema.pre(
  "insertMany",
  async function (
    this: mongoose.Model<IEvent>,
    _next: (err?: Error) => void,
    docs: IEvent[]
  ) {
    for (const doc of docs) {
      if (doc.title) {
        const baseSlug = generateSlug(doc.title);
        let slug = baseSlug;
        let suffix = 1;
        while (await this.exists({ slug })) {
          slug = `${baseSlug}-${suffix++}`;
        }
        doc.slug = slug;
      }
      if (doc.date) doc.date = normalizeDate(doc.date);
      if (doc.time) doc.time = normalizeTime(doc.time);
    }
  }
);

// Guard against model re-registration on Next.js hot reloads
const Event: Model<IEvent> =
  mongoose.models.Event ?? mongoose.model<IEvent>("Event", eventSchema);

export default Event;
