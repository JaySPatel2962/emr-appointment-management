import type { Types } from 'mongoose';

import { DepartmentModel } from '#app/models/department.model.js';

export interface DepartmentDto {
  id: string;
  name: string;
}

// The department index's collation, so sorting ignores case and uses that index.
const CASE_INSENSITIVE = { locale: 'en', strength: 2 };

export const toDepartmentDto = (department: {
  _id: Types.ObjectId;
  name: string;
}): DepartmentDto => ({
  id: department._id.toString(),
  name: department.name,
});

export const listDepartments = async (): Promise<DepartmentDto[]> => {
  const departments = await DepartmentModel.find({}, { name: 1 })
    .collation(CASE_INSENSITIVE)
    .sort({ name: 1 })
    .lean();
  return departments.map(toDepartmentDto);
};

/** Loads several departments in one query, keyed by id. */
export const getDepartmentsById = async (
  ids: readonly Types.ObjectId[],
): Promise<Map<string, DepartmentDto>> => {
  const departments = await DepartmentModel.find({ _id: { $in: ids } }, { name: 1 }).lean();
  return new Map(
    departments.map((department) => [department._id.toString(), toDepartmentDto(department)]),
  );
};
