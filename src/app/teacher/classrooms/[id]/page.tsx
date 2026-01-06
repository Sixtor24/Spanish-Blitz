"use client";
import { useState, useEffect } from "react";
import Navigation from "../../../../shared/components/Navigation";
import useUser from "../../../../shared/hooks/useUser";
import { ArrowLeft, Users, Trash2, Plus, Calendar, Loader2, Copy, Check } from "lucide-react";
import { api } from "../../../../config/api";
import type { DbClassroom, DbDeck } from "../../../../types/api.types";

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
}

export default function ClassroomDetailPage({ params }: { params: { id: string } }) {
  const { user, loading: userLoading } = useUser();
  const classroomId = params.id;
  
  const [classroom, setClassroom] = useState<DbClassroom | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [decks, setDecks] = useState<DbDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  
  const [assignmentForm, setAssignmentForm] = useState({
    deck_id: "",
    title: "",
    description: "",
    due_date: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) {
      window.location.href = "/account/signin";
    }
  }, [user, userLoading]);

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

    if (!assignmentForm.deck_id || !assignmentForm.title) {
      alert("Please select a deck and enter a title");
      return;
    }

    try {
      setSubmitting(true);
      await api.classrooms.createAssignment(classroomId, {
        deck_id: assignmentForm.deck_id,
        title: assignmentForm.title,
        description: assignmentForm.description || undefined,
        due_date: assignmentForm.due_date || undefined,
      });
      
      setShowAssignmentModal(false);
      setAssignmentForm({ deck_id: "", title: "", description: "", due_date: "" });
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
      await api.classrooms.deleteAssignment(classroomId, assignmentId);
      await fetchClassroomData();
    } catch (err) {
      console.error("Error deleting assignment:", err);
      alert(err instanceof Error ? err.message : "Failed to delete assignment");
    }
  };

  if (userLoading || loading) {
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
          <a href="/teacher" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mt-4">
            <ArrowLeft size={20} />
            Back to Teacher Panel
          </a>
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
          <a href="/teacher" className="inline-flex items-center gap-2 mb-4 transition-colors" style={{ color: classroomColor }}>
            <ArrowLeft size={20} />
            Back to Teacher Panel
          </a>
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
                        <h3 className="font-bold text-gray-900">{assignment.title}</h3>
                        <p className="text-sm text-gray-600">{assignment.deck_title}</p>
                        {assignment.description && <p className="text-sm text-gray-500">{assignment.description}</p>}
                        {assignment.due_date && <p className="text-xs text-orange-600 mt-1">Due: {new Date(assignment.due_date).toLocaleDateString()}</p>}
                      </div>
                      {isTeacher && (
                        <button onClick={() => handleDeleteAssignment(assignment.id)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                      {assignment.completed_count || 0} / {assignment.total_students || 0} completed
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
                <label className="block text-sm font-semibold mb-2" style={{ color: classroomColor }}>Select Deck *</label>
                <select value={assignmentForm.deck_id} onChange={(e) => setAssignmentForm({ ...assignmentForm, deck_id: e.target.value })} className="w-full px-4 py-2 border-2 rounded-lg" style={{ borderColor: `${classroomColor}60` }} required disabled={submitting}>
                  <option value="">Choose a deck...</option>
                  {decks.map((deck) => <option key={deck.id} value={deck.id}>{deck.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Assignment Title *</label>
                <input type="text" value={assignmentForm.title} onChange={(e) => setAssignmentForm({ ...assignmentForm, title: e.target.value })} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg" placeholder="e.g., Week 1 Practice" required disabled={submitting} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Instructions (Optional)</label>
                <textarea value={assignmentForm.description} onChange={(e) => setAssignmentForm({ ...assignmentForm, description: e.target.value })} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg resize-none" rows={4} placeholder="Add instructions..." disabled={submitting} />
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
              <div className="flex gap-3 pt-6 border-t border-gray-200">
                <button type="button" onClick={() => setShowAssignmentModal(false)} className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold" disabled={submitting}>Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 text-white rounded-lg font-semibold flex items-center justify-center gap-2" style={{ backgroundColor: classroomColor }} disabled={submitting}>
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
