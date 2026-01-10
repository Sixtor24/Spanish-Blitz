/**
 * Use Case: Delete Assignment
 * 
 * Handles the business logic for deleting an assignment from a classroom.
 */

export interface IAssignmentRepository {
  findById(assignmentId: string): Promise<{ id: string; classroom_id: string } | null>;
  findClassroomById(classroomId: string): Promise<{ id: string; teacher_id: string } | null>;
  delete(classroomId: string, assignmentId: string): Promise<void>;
}

export interface IAuthService {
  getCurrentUser(): Promise<{ id: string; role: string; email: string }>;
}

export class DeleteAssignmentUseCase {
  constructor(
    private assignmentRepository: IAssignmentRepository,
    private authService: IAuthService
  ) {}

  async execute(classroomId: string, assignmentId: string): Promise<void> {
    // 1. Validate input
    if (!classroomId || classroomId.trim().length === 0) {
      throw new Error('Classroom ID is required');
    }

    if (!assignmentId || assignmentId.trim().length === 0) {
      throw new Error('Assignment ID is required');
    }

    // 2. Get current user
    const currentUser = await this.authService.getCurrentUser();

    // 3. Find classroom and verify ownership
    const classroom = await this.assignmentRepository.findClassroomById(classroomId);

    if (!classroom) {
      throw new Error('Classroom not found');
    }

    const isOwner = classroom.teacher_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new Error('You do not have permission to delete assignments in this classroom');
    }

    // 4. Delete assignment (backend will validate assignment belongs to classroom)
    await this.assignmentRepository.delete(classroomId, assignmentId);
  }
}
