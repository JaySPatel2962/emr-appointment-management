import type { AccountFormOutput } from '@/features/admin/schemas';
import { postData } from '@/services/api';
import type { User } from '@/types/models';

/** Creates a receptionist's login. Doctors are created with their profile, in doctors/api. */
export const createReceptionist = (body: AccountFormOutput): Promise<User> =>
  postData<User>('/users/receptionists', body);
