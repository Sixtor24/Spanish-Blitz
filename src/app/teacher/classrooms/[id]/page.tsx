import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import Navigation from "@/shared/components/Navigation";
import useUser from "@/shared/hooks/useUser";
import { ArrowLeft, Users, Trash2, Plus, Calendar, Loader2, Copy, Check } from "lucide-react";
import { api } from "@/config/api";
import type { DbClassroom, DbDeck } from "@/types/api.types";
import { withTeacherAuth } from "@/shared/hoc/withAuth";
import { CreateAssignmentUseCase, DeleteAssignmentUseCase } from "@/domain/use-cases/assignment";
import { AssignmentRepository } from "@/infrastructure/repositories/AssignmentRepository";
import { AuthService } from "@/infrastructure/services/AuthService";

interface Student {
  id: string;
  email: string;
  display_name: string | null;
  joined_at: Date;
  is_active: boolean;
}

interface Assignment {
  id: string;
  classroom_id: string;
  deck_id: string;
  title: string;
  description: string | null;
  due_date: Date | null;
  created_at: Date;
  deck_title?: string;
  completed_count?: number;
  total_students?: number;
  required_repetitions: number;
}

function ClassroomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const classroomId = id!;
  const { user } = useUser();
  
  const [classroom, setClassroom] = useState<DbClassroom | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [decks, setDecks] = useState<DbDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  
  const [assignmentForm, setAssignmentForm] = useState({ deck_id: "", repetitions: 1, due_date: "" });
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [assignToAll, setAssignToAll] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Auth handled by withTeacherAuth HOC

  useEffect(() => {
    if (user && classroomId) {
      fetchClassroomData();
    }
  }, [user, classroomId]);

  const fetchClassroomData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [classroomData, studentsData, assignmentsData, decksData] = await Promise.all([
        api.classrooms.get(classroomId),
        api.classrooms.students(classroomId),
        api.classrooms.assignments(classroomId),
        api.decks.list({ filter: 'owned' })
      ]);
      setClassroom(classroomData);
      setStudents(studentsData);
      setAssignments(assignmentsData);
      setDecks(decksData);
    } catch (err) {
      console.error("Error fetching classroom data:", err);
      setError(err instanceof Error ? err.message : "Failed to load classroom");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (classroom?.code) {
      navigator.clipboard.writeText(classroom.code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const handleRemoveStudent = async (studentId: string) => {
    if (!confirm("Are you sure you want to remove this student?")) return;

    try {
      await api.classrooms.removeStudent(classroomId, studentId);
      await fetchClassroomData();
    } catch (err) {
      console.error("Error removing student:", err);
      alert(err instanceof Error ? err.message : "Failed to remove student");
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);
      
      // Get the deck name to use as assignment title
      const selectedDeck = decks.find(d => d.id === assignmentForm.deck_id);
      const deckName = selectedDeck?.title || "Study Set";
      
      // Build description based on repetitions
      const description = assignmentForm.repetitions === 1 
        ? `Study this set 1 time`
        : `Study this set ${assignmentForm.repetitions} times`;
      
      // Use Case pattern - business logic is now in the use case
      const repository = new AssignmentRepository();
      const authService = new AuthService();
      const createAssignment = new CreateAssignmentUseCase(repository, authService);
      
      await createAssignment.execute({
        classroomId: classroomId,
        deckId: assignmentForm.deck_id,
        title: deckName,
        description: description,
        dueDate: assignmentForm.due_date || undefined,
        studentIds: assignToAll ? undefined : selectedStudents,
        requiredRepetitions: assignmentForm.repetitions,
      });
      
      setShowAssignmentModal(false);
      setAssignmentForm({ deck_id: "", repetitions: 1, due_date: "" });
      setSelectedStudents([]);
      setAssignToAll(true);
      await fetchClassroomData();
    } catch (err) {
      console.error("Error creating assignment:", err);
      alert(err instanceof Error ? err.message : "Failed to create assignment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm("Are you sure you want to delete this assignment?")) return;

    try {
      // Use Case pattern - business logic is now in the use case
      const repository = new AssignmentRepository();
      const authService = new AuthService();
      const deleteAssignment = new DeleteAssignmentUseCase(repository, authService);
      
      await deleteAssignment.execute(classroomId, assignmentId);
      await fetchClassroomData();
    } catch (err) {
      console.error("Error deleting assignment:", err);
      alert(err instanceof Error ? err.message : "Failed to delete assignment");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !classroom) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg p-4">
            {error || "Classroom not found"}
          </div>
          <Link to="/teacher" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mt-4">
            <ArrowLeft size={20} />
            Back to Teacher Panel
          </Link>
        </div>
      </div>
    );
  }

  const isTeacher = classroom.teacher_id === String(user?.id);
  const classroomColor = classroom.color || '#8B5CF6';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link to="/teacher" className="inline-flex items-center gap-2 mb-4 transition-colors" style={{ color: classroomColor }}>
            <ArrowLeft size={20} />
            Back to Teacher Panel
          </Link>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold mb-2" style={{ color: classroomColor }}>{classroom.name}</h1>
                {classroom.description && <p className="text-gray-600">{classroom.description}</p>}
              </div>
              {isTeacher && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ backgroundColor: `${classroomColor}15` }}>
                  <span className="text-sm font-medium" style={{ color: classroomColor }}>Join Code:</span>
                  <code className="text-lg font-mono font-bold" style={{ color: classroomColor }}>{classroom.code}</code>
                  <button onClick={handleCopyCode} className="p-1 rounded transition-colors">
                    {codeCopied ? <Check size={16} className="text-green-600" /> : <Copy size={16} style={{ color: classroomColor }} />}
                  </button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div>
                <p className="text-sm text-gray-500">Students</p>
                <p className="text-2xl font-bold text-gray-900">{classroom.student_count || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Assignments</p>
                <p className="text-2xl font-bold text-gray-900">{classroom.assignment_count || 0}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Users size={24} />
              Students ({students.length})
            </h2>
            {students.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No students have joined yet.</div>
            ) : (
              <div className="space-y-2">
                {students.map((student) => (
                  <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{student.display_name || student.email}</p>
                      <p className="text-sm text-gray-500">Joined {new Date(student.joined_at).toLocaleDateString()}</p>
                    </div>
                    {isTeacher && (
                      <button onClick={() => handleRemoveStudent(student.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar size={24} />
                Assignments ({assignments.length})
              </h2>
              {isTeacher && (
                <button onClick={() => setShowAssignmentModal(true)} className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-medium" style={{ backgroundColor: classroomColor }}>
                  <Plus size={18} />
                  New Assignment
                </button>
              )}
            </div>
            {assignments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No assignments yet.</div>
            ) : (
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="p-4 border-2 border-gray-200 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-gray-900">{assignment.title}</h3>
                          {assignment.required_repetitions > 1 && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-semibold rounded">
                              {assignment.required_repetitions}x repetitions
                            </span>
                          )}
                        </div>
                        {assignment.description && <p className="text-sm text-gray-600">{assignment.description}</p>}
                        {assignment.due_date && <p className="text-xs text-orange-600 mt-1">Due: {new Date(assignment.due_date).toLocaleDateString()}</p>}
                      </div>
                      {isTeacher && (
                        <button onClick={() => handleDeleteAssignment(assignment.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                      {assignment.completed_count || 0} / {assignment.total_students || 0} students completed
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {showAssignmentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl font-bold text-gray-900">Create Assignment</h2>
                <p className="text-sm text-gray-500 mt-1">Assign a deck to your students</p>
              </div>
              <button onClick={() => setShowAssignmentModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <Plus size={24} className="rotate-45 text-gray-400" />
              </button>
            </div>
            <form onSubmit={handleCreateAssignment} className="space-y-6">
              <div className="rounded-lg p-4" style={{ backgroundColor: `${classroomColor}15`, border: `2px solid ${classroomColor}40` }}>
                <label className="block text-sm font-semibold mb-2" style={{ color: classroomColor }}>What set? *</label>
                <select value={assignmentForm.deck_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, deck_id: e.target.value })} className="w-full px-4 py-2 border-2 rounded-lg" style={{ borderColor: `${classroomColor}60` }} required disabled={submitting}>
                  <option value="">Choose a set...</option>
                  {decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">How many times? *</label>
                <select 
                  value={assignmentForm.repetitions} 
                  onChange={(e) => setAssignmentForm({ ...assignmentForm, repetitions: parseInt(e.target.value) })} 
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg"
                  required 
                  disabled={submitting}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Due Date (Optional)</label>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={assignmentForm.due_date ? assignmentForm.due_date.split('T')[0] : ''} onChange={(e) => setAssignmentForm({ ...assignmentForm, due_date: e.target.value ? `${e.target.value}T23:59` : '' })} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg" disabled={submitting} />
                  <input type="time" value={assignmentForm.due_date ? assignmentForm.due_date.split('T')[1] : ''} onChange={(e) => {
                    const date = assignmentForm.due_date ? assignmentForm.due_date.split('T')[0] : new Date().toISOString().split('T')[0];
                    setAssignmentForm({ ...assignmentForm, due_date: `${date}T${e.target.value}` });
                  }} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg" disabled={submitting} />
                </div>
              </div>

              {/* Student Selection */}
              <div className="rounded-lg p-4 border-2 border-gray-200 bg-gray-50">
                <label className="block text-sm font-semibold text-gray-700 mb-3">Assign to:</label>
                
                <div className="space-y-2 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={assignToAll}
                      onChange={() => {
                        setAssignToAll(true);
                        setSelectedStudents([]);
                      }}
                      className="w-4 h-4"
                      disabled={submitting}
                    />
                    <span className="text-sm font-medium text-gray-700">All students ({students.filter(s => s.is_active).length})</span>
                  </label>
                  
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!assignToAll}
                      onChange={() => setAssignToAll(false)}
                      className="w-4 h-4"
                      disabled={submitting}
                    />
                    <span className="text-sm font-medium text-gray-700">Specific students</span>
                  </label>
                </div>

                {!assignToAll && (
                  <div className="mt-3 max-h-48 overflow-y-auto border rounded-lg p-3 bg-white">
                    {students.filter(s => s.is_active).length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-2">No students yet</p>
                    ) : (
                      <div className="space-y-2">
                        {students.filter(s => s.is_active).map((student) => (
                          <label key={student.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                            <input
                              type="checkbox"
                              checked={selectedStudents.includes(student.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedStudents([...selectedStudents, student.id]);
                                } else {
                                  setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                                }
                              }}
                              className="w-4 h-4"
                              disabled={submitting}
                            />
                            <span className="text-sm text-gray-700">
                              {student.display_name || student.email}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {!assignToAll && selectedStudents.length > 0 && (
                  <p className="text-xs text-gray-600 mt-2">
                    {selectedStudents.length} student{selectedStudents.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button type="button" onClick={() => { setShowAssignmentModal(false); setAssignmentForm({ deck_id: "", repetitions: 1, due_date: "" }); setSelectedStudents([]); setAssignToAll(true); }} className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold" disabled={submitting}>Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 text-white rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed" style={{ backgroundColor: classroomColor }} disabled={submitting || (!assignToAll && selectedStudents.length === 0)}>
                  {submitting ? <><Loader2 className="w-5 h-5 animate-spin" />Creating...</> : <><Plus size={20} />Create Assignment</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default withTeacherAuth(ClassroomDetailPage);
