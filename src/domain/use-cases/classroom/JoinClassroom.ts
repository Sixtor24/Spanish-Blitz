/**
 * Use Case: Join Classroom
 * 
 * Handles the business logic for a student joining a classroom.
 */

import type { DbClassroom } from '../../../types/api.types';

export interface JoinClassroomDTO {
  code: string;
}

export interface IClassroomRepository {
  joinByCode(code: string): Promise<DbClassroom>;
}

export interface IAuthService {
  getCurrentUser(): Promise<{ id: string; role: string; email: string }>;
}

export class JoinClassroomUseCase {
  constructor(
    private classroomRepository: IClassroomRepository,
    private authService: IAuthService
  ) {}

  async execute(data: JoinClassroomDTO): Promise<DbClassroom> {
    // 1. Validate input
    if (!data.code || data.code.trim().length === 0) {
      throw new Error('Classroom code is required');
    }

    const code = data.code.trim().toUpperCase();

    // 2. Ensure user is authenticated
    await this.authService.getCurrentUser();

    // 3. Join classroom - backend handles validation
    // (checking if classroom exists, if it's full, if user is already a member, etc.)
    return await this.classroomRepository.joinByCode(code);
  }
}
