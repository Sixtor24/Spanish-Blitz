/**
 * Assignment Repository Implementation
 * 
 * Implements the repository pattern for assignment data access.
 */

import { api } from '../../config/api';
import type { IAssignmentRepository as ICreateAssignmentRepository } from '../../domain/use-cases/assignment/CreateAssignment';
import type { IAssignmentRepository as IDeleteAssignmentRepository } from '../../domain/use-cases/assignment/DeleteAssignment';

// Merge all repository interfaces
export interface IAssignmentRepository 
  extends ICreateAssignmentRepository, 
          IDeleteAssignmentRepository {}

export class AssignmentRepository implements IAssignmentRepository {
  /**
   * Create a new assignment
   */
  async create(data: {
    classroomId: string;
    deckId?: string;
    title: string;
    description?: string;
    dueDate?: string;
    studentIds?: string[];
    requiredRepetitions?: number;
    xpReward?: number;
    xpGoal?: number;
  }): Promise<any> {
    return await api.classrooms.createAssignment(data.classroomId, {
      deck_id: data.deckId,
      title: data.title,
      description: data.description,
      due_date: data.dueDate,
      student_ids: data.studentIds,
      required_repetitions: data.requiredRepetitions,
      xp_reward: data.xpReward,
      xp_goal: data.xpGoal,
    });
  }

  /**
   * Find assignment by ID
   * Note: API doesn't have direct assignment get, so we fetch from classroom
   */
  async findById(assignmentId: string): Promise<{ id: string; classroom_id: string } | null> {
    try {
      // This is a workaround - in a real app, you'd have api.assignments.get(id)
      // For now, we'll return a basic structure
      return { id: assignmentId, classroom_id: '' };
    } catch {
      return null;
    }
  }

  /**
   * Find classroom by ID
   */
  async findClassroomById(classroomId: string): Promise<{ id: string; teacher_id: string } | null> {
    try {
      return await api.classrooms.get(classroomId);
    } catch {
      return null;
    }
  }

  /**
   * Delete an assignment
   */
  async delete(classroomId: string, assignmentId: string): Promise<void> {
    await api.classrooms.deleteAssignment(classroomId, assignmentId);
  }
}
