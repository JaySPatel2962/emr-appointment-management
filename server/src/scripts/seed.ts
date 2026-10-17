import { z } from 'zod';

import { connectDb, disconnectDb } from '#app/config/db.js';
import { logger } from '#app/config/logger.js';
import { ROLES } from '#app/constants/roles.js';
import { DepartmentModel } from '#app/models/department.model.js';
import { UserModel } from '#app/models/user.model.js';
import { hashPassword } from '#app/services/password.service.js';
import { describeConfigIssues } from '#app/utils/config-issues.js';
import { emailSchema, nameSchema, passwordSchema } from '#app/validators/common.js';

// Creates the first Super Admin and the departments. Safe to run again: nothing is duplicated
// and an existing admin's password is never changed.

const DEFAULT_DEPARTMENTS = 'General Medicine,Cardiology,Dermatology,Orthopedics,Pediatrics';
// Matches the department index's collation, so "cardiology" finds "Cardiology".
const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

const seedConfigSchema = z.object({
  SEED_ADMIN_NAME: nameSchema.default('Super Admin'),
  SEED_ADMIN_EMAIL: emailSchema,
  SEED_ADMIN_PASSWORD: passwordSchema,
  SEED_DEPARTMENTS: z
    .string()
    .default(DEFAULT_DEPARTMENTS)
    .transform((list) =>
      list
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name.length > 0),
    ),
});

const seedDepartments = async (names: string[]): Promise<void> => {
  for (const name of names) {
    const result = await DepartmentModel.updateOne(
      { name },
      { $setOnInsert: { name } },
      { upsert: true, collation: CASE_INSENSITIVE },
    );
    logger.info({ department: name, created: result.upsertedCount === 1 }, 'Department ready');
  }
};

const seedSuperAdmin = async (name: string, email: string, password: string): Promise<void> => {
  if (await UserModel.exists({ email })) {
    logger.info({ email }, 'Super Admin already exists, left unchanged');
    return;
  }
  await UserModel.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: ROLES.SUPER_ADMIN,
  });
  logger.info({ email }, 'Super Admin created');
};

const run = async (): Promise<void> => {
  const config = seedConfigSchema.safeParse(process.env);
  if (!config.success) {
    throw new Error(`Invalid seed configuration:\n${describeConfigIssues(config.error)}`);
  }
  const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_DEPARTMENTS } = config.data;

  await connectDb();
  try {
    await seedDepartments(SEED_DEPARTMENTS);
    await seedSuperAdmin(SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD);
  } finally {
    await disconnectDb();
  }
};

run().catch((error: unknown) => {
  logger.fatal({ err: error }, 'Seeding failed');
  process.exitCode = 1;
});
