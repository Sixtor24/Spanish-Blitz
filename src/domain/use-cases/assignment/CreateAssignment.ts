/**
 * Use Case: Create Assignment
 * 
 * Handles the business logic for creating a new assignment in a classroom.
 */

export interface CreateAssignmentDTO {
  classroomId: string;
  deckId: string;
  title: string;
  description?: string;
  dueDate?: string;
  studentIds?: string[];
  requiredRepetitions?: number;
}

export interface IAssignmentRepository {
  create(data: CreateAssignmentDTO): Promise<any>;
  findClassroomById(classroomId: string): Promise<{ id: string; teacher_id: string } | null>;
}

export interface IAuthService {
  getCurrentUser(): Promise<{ id: string; role: string; email: string }>;
}

export class CreateAssignmentUseCase {
  constructor(
    private assignmentRepository: IAssignmentRepository,
    private authService: IAuthService
  ) {}

  async execute(data: CreateAssignmentDTO): Promise<any> {
    // 1. Validate permissions
    const currentUser = await this.authService.getCurrentUser();
    
    if (!['teacher', 'admin'].includes(currentUser.role)) {
      throw new Error('Only teachers and admins can create assignments');
    }

    // 2. Validate classroom ownership
    const classroom = await this.assignmentRepository.findClassroomById(data.classroomId);
    
    if (!classroom) {
      throw new Error('Classroom not found');
    }

    const isOwner = classroom.teacher_id === currentUser.id;
    const isAdmin = currentUser.role === 'admin';

    if (!isOwner && !isAdmin) {
      throw new Error('You do not have permission to create assignments in this classroom');
    }

    // 3. Validate business rules
    if (!data.title || data.title.trim().length === 0) {
      throw new Error('Assignment title is required');
    }

    if (data.title.length > 200) {
      throw new Error('Assignment title must be less than 200 characters');
    }

    if (data.description && data.description.length > 1000) {
      throw new Error('Assignment description must be less than 1000 characters');
    }

    if (!data.deckId) {
      throw new Error('Deck is required for assignment');
    }

    // 4. Validate due date if provided
    if (data.dueDate) {
      const dueDate = new Date(data.dueDate);
      const now = new Date();

      if (dueDate < now) {
        throw new Error('Due date cannot be in the past');
      }
    }

    // 5. Create assignment via repository
    const assignment = await this.assignmentRepository.create({
      classroomId: data.classroomId,
      deckId: data.deckId,
      title: data.title.trim(),
      description: data.description?.trim(),
      dueDate: data.dueDate,
      studentIds: data.studentIds,
      requiredRepetitions: data.requiredRepetitions || 1,
    });

    return assignment;
  }
}
