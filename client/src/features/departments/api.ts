import { getData } from '@/services/api';
import type { Department } from '@/types/models';

/** Every department, sorted by name. Not paginated: departments come from the seed script. */
export const listDepartments = (signal: AbortSignal): Promise<Department[]> =>
  getData<Department[]>('/departments', { signal });
