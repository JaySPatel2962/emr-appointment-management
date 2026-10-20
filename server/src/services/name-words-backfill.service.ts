import { AppointmentModel } from '#app/models/appointment.model.js';
import { PatientModel } from '#app/models/patient.model.js';
import { nameWords } from '#app/utils/name-words.js';

// Fills in the searchable name words (patients.nameWords, appointments.patientNameWords) of
// documents saved before word search existed, and corrects any that are out of date. Safe to
// run again: a document whose words are already right is left alone.

const BATCH_SIZE = 500;

export interface BackfillCounts {
  checked: number;
  updated: number;
}

interface WordUpdate {
  id: unknown;
  words: string[];
}

const sameWords = (a: unknown, b: readonly string[]): boolean =>
  Array.isArray(a) && a.length === b.length && a.every((word, index) => word === b[index]);

/** Writes `target` from `source` on every document whose words are missing or out of date. */
const backfill = async (
  documents: AsyncIterable<Record<string, unknown>>,
  source: string,
  target: string,
  write: (updates: WordUpdate[]) => Promise<unknown>,
): Promise<BackfillCounts> => {
  const counts = { checked: 0, updated: 0 };
  let batch: WordUpdate[] = [];
  const flush = async (): Promise<void> => {
    if (batch.length > 0) {
      await write(batch);
      counts.updated += batch.length;
      batch = [];
    }
  };
  for await (const document of documents) {
    counts.checked += 1;
    const value = document[source];
    const words = typeof value === 'string' ? nameWords(value) : [];
    if (!sameWords(document[target], words)) {
      batch.push({ id: document._id, words });
    }
    if (batch.length === BATCH_SIZE) {
      await flush();
    }
  }
  await flush();
  return counts;
};

export const backfillNameWords = async (): Promise<{
  patients: BackfillCounts;
  appointments: BackfillCounts;
}> => ({
  patients: await backfill(
    PatientModel.find({}, { name: 1, nameWords: 1 }).lean().cursor(),
    'name',
    'nameWords',
    (updates) =>
      PatientModel.bulkWrite(
        updates.map(({ id, words }) => ({
          updateOne: { filter: { _id: id }, update: { $set: { nameWords: words } } },
        })),
      ),
  ),
  appointments: await backfill(
    AppointmentModel.find({}, { patientName: 1, patientNameWords: 1 }).lean().cursor(),
    'patientName',
    'patientNameWords',
    (updates) =>
      AppointmentModel.bulkWrite(
        updates.map(({ id, words }) => ({
          updateOne: { filter: { _id: id }, update: { $set: { patientNameWords: words } } },
        })),
      ),
  ),
});
