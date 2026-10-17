import { model, Schema } from 'mongoose';
import type { InferSchemaType } from 'mongoose';

import { DAY_OF_WEEK, SLOT_DURATION_MINUTES } from '#app/constants/doctor.js';
import { findScheduleProblems } from '#app/utils/schedule.js';
import type { DaySchedule } from '#app/utils/schedule.js';
import { TIME_PATTERN } from '#app/utils/time.js';

const timeRangeSchema = new Schema(
  {
    start: { type: String, required: true, match: TIME_PATTERN },
    end: { type: String, required: true, match: TIME_PATTERN },
  },
  { _id: false },
);

const dayScheduleSchema = new Schema(
  {
    dayOfWeek: {
      type: Number,
      required: true,
      min: DAY_OF_WEEK.SUNDAY,
      max: DAY_OF_WEEK.SATURDAY,
    },
    sessions: { type: [timeRangeSchema], default: [] },
    breaks: { type: [timeRangeSchema], default: [] },
  },
  { _id: false },
);

const describeScheduleProblems = (schedule: readonly DaySchedule[]): string =>
  findScheduleProblems(schedule)
    .map((problem) => problem.message)
    .join('; ');

const doctorSchema = new Schema(
  {
    // One profile per user account. The unique index also serves the user -> doctor lookup at login.
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    // Copied from the user account, so doctor lists and search need no join.
    name: { type: String, required: true, trim: true, maxlength: 100 },
    specialization: { type: String, required: true, trim: true, maxlength: 100 },
    slotDurationMinutes: {
      type: Number,
      required: true,
      min: SLOT_DURATION_MINUTES.MIN,
      max: SLOT_DURATION_MINUTES.MAX,
      validate: {
        validator: Number.isInteger,
        message: 'slotDurationMinutes must be a whole number',
      },
    },
    // Embedded: always read together with the doctor, and at most seven entries. Unlisted days are off.
    schedule: {
      type: [dayScheduleSchema],
      default: [],
      validate: {
        validator: (schedule: DaySchedule[]) => findScheduleProblems(schedule).length === 0,
        message: (props: { value: DaySchedule[] }) => describeScheduleProblems(props.value),
      },
    },
  },
  { timestamps: true },
);

// Doctor lists filtered by department and sorted by name.
doctorSchema.index({ departmentId: 1, name: 1 });

export type Doctor = InferSchemaType<typeof doctorSchema>;

export const DoctorModel = model('Doctor', doctorSchema);
