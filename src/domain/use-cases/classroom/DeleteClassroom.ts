/**
 * Use Case: Delete Classroom
 * 
 * Handles the business logic for deleting a classroom.
 * Includes authorization checks and cascade deletion logic.
 */

export interface IClassroomRepository {
  findById(id: string): Promise<{ id: string; teacher_id: string } | null>;
  delete(id: string): Promise<void>;
  hasActiveAssignments(classroomId: string): Promise<boolean>;
}

export interface IAuthService {
  getCurrentUser(): Promise<{ id: string; role: string; email: string }>;
}

export class DeleteClassroomUseCase {
  constructor(
    private classroomRepository: IClassroomRepository,
    private authService: IAuthService
  ) {}

  async execute(classroomId: string): Promise<void> {
    // 1. Validate input
    if (!classroomId || classroomId.trim().length === 0) {
      throw new Error('Classroom ID is required');
    }

    // 2. Get current user
    const currentUser = await this.authService.getCurrentUser();

    // 3. Find classroom
    const classroom = await this.classroomRepository.findById(classroomId);

    if (!classroom) {
      throw new Error('Classroom not found');
    }

    // 4. Authorization: Only owner or admin can delete
    const isOwner = classroom.teacher_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new Error('You do not have permission to delete this classroom');
    }

    // 5. Business rule: Check for active assignments (optional warning)
    const hasActiveAssignments = await this.classroomRepository.hasActiveAssignments(classroomId);

    if (hasActiveAssignments) {
      // This is just a warning - deletion will cascade
      console.warn(`Deleting classroom ${classroomId} with active assignments`);
    }

    // 6. Delete classroom (cascade will handle students and assignments)
    await this.classroomRepository.delete(classroomId);
  }
}
