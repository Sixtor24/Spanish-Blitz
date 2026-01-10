/**
 * Use Case: Create Classroom
 * 
 * Handles the business logic for creating a new classroom.
 * Separates domain logic from UI components.
 */

import type { DbClassroom } from '../../../types/api.types';

export interface CreateClassroomDTO {
  name: string;
  description?: string;
  color?: string;
}

export interface IClassroomRepository {
  create(data: CreateClassroomDTO): Promise<DbClassroom>;
}

export interface IAuthService {
  getCurrentUser(): Promise<{ id: string; role: string; email: string }>;
}

export class CreateClassroomUseCase {
  constructor(
    private classroomRepository: IClassroomRepository,
    private authService: IAuthService
  ) {}

  async execute(data: CreateClassroomDTO): Promise<DbClassroom> {
    // 1. Validate permissions
    const currentUser = await this.authService.getCurrentUser();
    
    if (!['teacher', 'admin'].includes(currentUser.role)) {
      throw new Error('Only teachers and admins can create classrooms');
    }

    // 2. Validate business rules
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Classroom name is required');
    }

    if (data.name.length > 100) {
      throw new Error('Classroom name must be less than 100 characters');
    }

    if (data.description && data.description.length > 500) {
      throw new Error('Classroom description must be less than 500 characters');
    }

    // 3. Set defaults
    const classroomData: CreateClassroomDTO = {
      name: data.name.trim(),
      description: data.description?.trim() || '',
      color: data.color || '#8B5CF6', // Default purple
    };

    // 4. Create classroom via repository
    const classroom = await this.classroomRepository.create(classroomData);

    return classroom;
  }
}
