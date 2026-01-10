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
   * Find classroom by join code
   * Note: We need to verify the code exists without actually joining yet
   */
  async findByCode(code: string): Promise<DbClassroom | null> {
    try {
      // Get all classrooms and find by code
      const classrooms = await api.classrooms.list();
      const classroom = classrooms.find((c: DbClassroom) => c.code === code);
      return classroom || null;
    } catch (error) {
      // If classroom not found, return null instead of throwing
      if (error instanceof Error && error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
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
   */
  async addStudent(classroomId: string, studentId: string): Promise<void> {
    // Get the classroom to find its code
    const classroom = await this.findById(classroomId);
    if (!classroom) {
      throw new Error('Classroom not found');
    }
    
    // Get all classrooms to find the code
    const classrooms = await api.classrooms.list();
    const fullClassroom = classrooms.find((c: DbClassroom) => c.id === classroomId);
    
    if (!fullClassroom?.code) {
      throw new Error('Classroom code not found');
    }
    
    // Join using the code
    await api.classrooms.join(fullClassroom.code);
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
