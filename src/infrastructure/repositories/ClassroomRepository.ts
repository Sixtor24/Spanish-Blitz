/**
 * Classroom Repository Implementation
 * 
 * Implements the repository pattern for classroom data access.
 * Abstracts the API client and provides a clean interface for use cases.
 */

import { api } from '../../config/api';
import type { DbClassroom } from '../../types/api.types';
import type { IClassroomRepository as ICreateClassroomRepository } from '../../domain/use-cases/classroom/CreateClassroom';
import type { IClassroomRepository as IJoinClassroomRepository } from '../../domain/use-cases/classroom/JoinClassroom';
import type { IClassroomRepository as IDeleteClassroomRepository } from '../../domain/use-cases/classroom/DeleteClassroom';

// Merge all repository interfaces
export interface IClassroomRepository 
  extends ICreateClassroomRepository, 
          IJoinClassroomRepository, 
          IDeleteClassroomRepository {}

export class ClassroomRepository implements IClassroomRepository {
  /**
   * Create a new classroom
   */
  async create(data: { name: string; description?: string; color?: string }): Promise<DbClassroom> {
    return await api.classrooms.create(data);
  }

  /**
   * Join a classroom by code
   * This directly calls the backend API which handles all validation
   */
  async joinByCode(code: string): Promise<DbClassroom> {
    return await api.classrooms.join(code);
  }

  /**
   * Find classroom by join code
   * Note: Since students can't see classrooms they haven't joined,
   * we return a placeholder that lets the backend validate the code
   */
  async findByCode(code: string): Promise<DbClassroom | null> {
    // We can't pre-validate the code on the frontend because api.classrooms.list()
    // only returns classrooms the user is already in. The backend will validate.
    // Return a placeholder to allow the flow to continue
    return {
      id: 'pending',
      code,
      name: '',
      description: null,
      teacher_id: '',
      color: '#8B5CF6',
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  /**
   * Find classroom by ID
   */
  async findById(id: string): Promise<{ id: string; teacher_id: string } | null> {
    try {
      return await api.classrooms.get(id);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Add a student to a classroom
   * Note: classroomId is 'pending' for new joins, so we use the code directly
   */
  async addStudent(classroomId: string, studentId: string): Promise<void> {
    // When joining a new classroom, classroomId is 'pending' and we need to use the code
    // The backend /api/classrooms/join validates the code and adds the student
    if (classroomId === 'pending') {
      throw new Error('Cannot add student without a valid classroom code');
    }
    
    // For already-joined classrooms, get the code and rejoin
    const classrooms = await api.classrooms.list();
    const classroom = classrooms.find((c: DbClassroom) => c.id === classroomId);
    
    if (!classroom?.code) {
      throw new Error('Classroom not found');
    }
    
    await api.classrooms.join(classroom.code);
  }

  /**
   * Get the number of students in a classroom
   */
  async getStudentCount(classroomId: string): Promise<number> {
    const students = await api.classrooms.students(classroomId);
    return students.length;
  }

  /**
   * Delete a classroom
   */
  async delete(id: string): Promise<void> {
    await api.classrooms.delete(id);
  }

  /**
   * Check if classroom has active assignments
   */
  async hasActiveAssignments(classroomId: string): Promise<boolean> {
    try {
      const assignments = await api.classrooms.assignments(classroomId);
      return assignments.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get all classrooms for current user
   */
  async findAll(): Promise<DbClassroom[]> {
    return await api.classrooms.list();
  }

  /**
   * Update a classroom
   */
  async update(id: string, data: { name?: string; description?: string; is_active?: boolean }): Promise<DbClassroom> {
    return await api.classrooms.update(id, data);
  }
}
