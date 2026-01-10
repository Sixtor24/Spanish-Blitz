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
  findByCode(code: string): Promise<DbClassroom | null>;
  addStudent(classroomId: string, studentId: string): Promise<void>;
  getStudentCount(classroomId: string): Promise<number>;
}

export interface IAuthService {
  getCurrentUser(): Promise<{ id: string; role: string; email: string }>;
}

export class JoinClassroomUseCase {
  private readonly MAX_STUDENTS_PER_CLASSROOM = 100;

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

    // 2. Get current user
    const currentUser = await this.authService.getCurrentUser();

    // 3. Find classroom by code
    const classroom = await this.classroomRepository.findByCode(code);

    if (!classroom) {
      throw new Error('Classroom not found. Please check the code and try again.');
    }

    // 4. Business rule: Check if classroom is full
    const studentCount = await this.classroomRepository.getStudentCount(classroom.id);

    if (studentCount >= this.MAX_STUDENTS_PER_CLASSROOM) {
      throw new Error('This classroom is full. Maximum 100 students allowed.');
    }

    // 5. Add student to classroom
    await this.classroomRepository.addStudent(classroom.id, currentUser.id);

    return classroom;
  }
}
