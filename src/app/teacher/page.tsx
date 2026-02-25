import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardLayout from "@/shared/components/DashboardLayout";
import useUser from "../../shared/hooks/useUser";
import { Plus, Users, Key, ArrowRight, Loader2, Copy, Check, Trash2 } from "lucide-react";
import { api } from "../../config/api";
import type { DbClassroom } from "../../types/api.types";
import { withTeacherAuth } from "../../shared/hoc/withAuth";
import { CreateClassroomUseCase } from "../../domain/use-cases/classroom/CreateClassroom";
import { ClassroomRepository } from "../../infrastructure/repositories/ClassroomRepository";
import { AuthService } from "../../infrastructure/services/AuthService";

function TeacherPanelPage() {
  const navigate = useNavigate();
  const { user } = useUser();
  const [classrooms, setClassrooms] = useState<DbClassroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [classroomForm, setClassroomForm] = useState({
    name: "",
    description: "",
    color: "#8B5CF6",
  });
  const [joinCode, setJoinCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchClassrooms();
    }
  }, [user]);

  const fetchClassrooms = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.classrooms.list();
      setClassrooms(data);
    } catch (err) {
      console.error("Error fetching classrooms:", err);
      setError(err instanceof Error ? err.message : "Failed to load classrooms");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setSubmitting(true);
      
      // Use Case pattern - business logic is now in the use case
      const repository = new ClassroomRepository();
      const authService = new AuthService();
      const createClassroom = new CreateClassroomUseCase(repository, authService);
      
      await createClassroom.execute({
        name: classroomForm.name,
        description: classroomForm.description || undefined,
        color: classroomForm.color,
      });
      
      setShowCreateModal(false);
      setClassroomForm({ name: "", description: "", color: "#8B5CF6" });
      await fetchClassrooms();
    } catch (err) {
      console.error("Error creating classroom:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to create classroom";
      
      // Show user-friendly message for permission errors
      if (errorMessage.includes("Only teachers")) {
        alert("⚠️ Teacher Account Required\n\n" + errorMessage);
      } else {
        alert(errorMessage);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCode = (code: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeleteClassroom = async (classroomId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm("Are you sure you want to delete this classroom? This action cannot be undone.")) {
      return;
    }

    try {
      await api.classrooms.delete(classroomId);
      await fetchClassrooms();
    } catch (err) {
      console.error("Error deleting classroom:", err);
      alert(err instanceof Error ? err.message : "Failed to delete classroom");
    }
  };

  const handleJoinClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!joinCode.trim()) {
      alert("Please enter a classroom code");
      return;
    }

    try {
      setSubmitting(true);
      await api.classrooms.join(joinCode.toUpperCase());
      setShowJoinModal(false);
      setJoinCode("");
      await fetchClassrooms();
    } catch (err) {
      console.error("Error joining classroom:", err);
      alert(err instanceof Error ? err.message : "Failed to join classroom");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Teacher Panel
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your classrooms and assignments
        </p>
      </div>
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6">
          <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Classrooms</h2>
          {classrooms.length > 0 && (
            <div className="flex gap-3">
              <button onClick={() => setShowJoinModal(true)} className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors text-sm">
                <Key size={18} />Join with Code
              </button>
              <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 font-medium transition-colors text-sm">
                <Plus size={18} />Create Classroom
              </button>
            </div>
          )}
        </div>
        {classrooms.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-block p-6 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4"><Users className="text-purple-600 dark:text-purple-400" size={48} /></div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">You don't have any classrooms yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Create a classroom to start managing students and assignments</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-xl hover:bg-purple-700 font-semibold transition-colors">
                <Plus size={20} />Create Classroom
              </button>
              <button onClick={() => setShowJoinModal(true)} className="inline-flex items-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 font-semibold transition-colors">
                <Key size={20} />Join Classroom with Code
              </button>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classrooms.map((classroom) => (
              <Link
                key={classroom.id}
                to={`/teacher/classrooms/${classroom.id}`}
                className="border rounded-xl p-5 hover:shadow-md transition-all group bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                style={{ borderLeftWidth: "5px", borderLeftColor: classroom.color || '#8B5CF6' }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold mb-1 truncate" style={{ color: classroom.color || '#8B5CF6' }}>{classroom.name}</h3>
                    {classroom.description && <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{classroom.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <button
                      onClick={(e) => handleDeleteClassroom(classroom.id, e)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete classroom"
                    >
                      <Trash2 size={16} />
                    </button>
                    <ArrowRight className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors" size={18} />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div><p className="text-xs text-gray-500 dark:text-gray-400">Students</p><p className="font-semibold text-gray-900 dark:text-gray-100">{classroom.student_count || 0}</p></div>
                  <div><p className="text-xs text-gray-500 dark:text-gray-400">Assignments</p><p className="font-semibold text-gray-900 dark:text-gray-100">{classroom.assignment_count || 0}</p></div>
                  <div className="flex items-center gap-1">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Code</p>
                      <p className="font-mono font-semibold" style={{ color: classroom.color || '#8B5CF6' }}>{classroom.code}</p>
                    </div>
                    <button
                      onClick={(e) => handleCopyCode(classroom.code, e)}
                      className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="Copy code"
                    >
                      {copiedCode === classroom.code ? (
                        <Check size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} style={{ color: classroom.color || '#8B5CF6' }} />
                      )}
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Create Classroom</h2>
            <form onSubmit={handleCreateClassroom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Classroom Name *</label>
                <input type="text" value={classroomForm.name} onChange={(e) => setClassroomForm({ ...classroomForm, name: e.target.value })} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent" placeholder="e.g., Spanish 101" required disabled={submitting} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description (Optional)</label>
                <textarea value={classroomForm.description} onChange={(e) => setClassroomForm({ ...classroomForm, description: e.target.value })} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent" rows={3} placeholder="Add a description for your classroom..." disabled={submitting} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color Theme</label>
                <div className="flex gap-2">
                  {['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setClassroomForm({ ...classroomForm, color })}
                      className={`w-10 h-10 rounded-lg transition-all ${classroomForm.color === color ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                      disabled={submitting}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowCreateModal(false); setClassroomForm({ name: "", description: "", color: "#8B5CF6" }); }} className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors" disabled={submitting}>Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" disabled={submitting}>
                  {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" />Creating...</>) : ("Create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">Join Classroom</h2>
            <form onSubmit={handleJoinClassroom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Classroom Code *</label>
                <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-lg tracking-wider" placeholder="ABCD12" maxLength={6} required disabled={submitting} />
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Enter the 6-character code provided by your teacher</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowJoinModal(false); setJoinCode(""); }} className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors" disabled={submitting}>Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" disabled={submitting}>
                  {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" />Joining...</>) : ("Join")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

// Export with authentication protection
export default withTeacherAuth(TeacherPanelPage);
