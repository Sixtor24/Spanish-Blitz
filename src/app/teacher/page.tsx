"use client";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navigation from "../../shared/components/Navigation";
import useUser from "../../shared/hooks/useUser";
import { Plus, Users, Key, ArrowRight, Loader2, Copy, Check, Trash2 } from "lucide-react";
import { api } from "../../config/api";
import type { DbClassroom } from "../../types/api.types";

export default function TeacherPanelPage() {
  const navigate = useNavigate();
  const { user, loading: userLoading } = useUser();
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

  // Redirect students to /classrooms
  useEffect(() => {
    if (!userLoading && user && user.role !== 'teacher' && user.role !== 'admin') {
      navigate('/classrooms');
    }
  }, [user, userLoading, navigate]);

  useEffect(() => {
    if (!userLoading && !user) {
      window.location.href = "/account/signin";
    }
  }, [user, userLoading]);

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
    
    if (!classroomForm.name.trim()) {
      alert("Please enter a classroom name");
      return;
    }

    try {
      setSubmitting(true);
      await api.classrooms.create({
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

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Teacher Panel
          </h1>
          <p className="text-gray-600">
            Manage your classrooms and assignments
          </p>
          {user && user.role !== 'teacher' && user.role !== 'admin' && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>ℹ️ Teacher Account Required:</strong> To create classrooms, you need a teacher account. 
                You can still join classrooms using a code. Contact your administrator to upgrade your account.
              </p>
            </div>
          )}
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Classrooms</h2>
            {classrooms.length > 0 && (
              <div className="flex gap-3">
                <button onClick={() => setShowJoinModal(true)} className="flex items-center gap-2 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium transition-colors">
                  <Key size={20} />Join with Code
                </button>
                <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium transition-colors">
                  <Plus size={20} />Create Classroom
                </button>
              </div>
            )}
          </div>
          {classrooms.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-block p-6 bg-purple-100 rounded-full mb-4"><Users className="text-purple-600" size={48} /></div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">You don't have any classrooms yet</h3>
              <p className="text-gray-600 mb-6">Create a classroom to start managing students and assignments</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 font-semibold transition-colors">
                  <Plus size={20} />Create Classroom
                </button>
                <button onClick={() => setShowJoinModal(true)} className="inline-flex items-center gap-2 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 font-semibold transition-colors">
                  <Key size={20} />Join Classroom with Code
                </button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {classrooms.map((classroom) => (
                <Link
                  key={classroom.id}
                  to={`/teacher/classrooms/${classroom.id}`}
                  className="border-l-4 border-2 border-gray-200 rounded-lg p-5 hover:shadow-lg transition-all group"
                  style={{
                    borderLeftColor: classroom.color || '#8B5CF6'
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900 mb-1 transition-colors" style={{ color: classroom.color || '#8B5CF6' }}>{classroom.name}</h3>
                      {classroom.description && <p className="text-sm text-gray-600">{classroom.description}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleDeleteClassroom(classroom.id, e)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete classroom"
                      >
                        <Trash2 size={16} />
                      </button>
                      <ArrowRight 
                        className="text-gray-400 transition-colors" 
                        style={{
                          color: undefined
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = classroom.color || '#8B5CF6';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#9CA3AF';
                        }}
                        size={20} 
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                    <div><p className="text-xs text-gray-500">Students</p><p className="font-semibold text-gray-900">{classroom.student_count || 0}</p></div>
                    <div><p className="text-xs text-gray-500">Assignments</p><p className="font-semibold text-gray-900">{classroom.assignment_count || 0}</p></div>
                    <div className="flex items-center gap-1">
                      <div>
                        <p className="text-xs text-gray-500">Code</p>
                        <p className="font-mono font-semibold" style={{ color: classroom.color || '#8B5CF6' }}>{classroom.code}</p>
                      </div>
                      <button
                        onClick={(e) => handleCopyCode(classroom.code, e)}
                        className="p-1 rounded transition-colors"
                        style={{
                          backgroundColor: copiedCode === classroom.code ? undefined : undefined
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = `${classroom.color || '#8B5CF6'}20`;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
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
      </div>
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Create Classroom</h2>
            <form onSubmit={handleCreateClassroom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Classroom Name *</label>
                <input type="text" value={classroomForm.name} onChange={(e) => setClassroomForm({ ...classroomForm, name: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" placeholder="e.g., Spanish 101" required disabled={submitting} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                <textarea value={classroomForm.description} onChange={(e) => setClassroomForm({ ...classroomForm, description: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" rows={3} placeholder="Add a description for your classroom..." disabled={submitting} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Color Theme</label>
                <div className="flex gap-2">
                  {['#8B5CF6', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setClassroomForm({ ...classroomForm, color })}
                      className={`w-10 h-10 rounded-lg transition-all ${classroomForm.color === color ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                      disabled={submitting}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowCreateModal(false); setClassroomForm({ name: "", description: "", color: "#8B5CF6" }); }} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors" disabled={submitting}>Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" disabled={submitting}>
                  {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" />Creating...</>) : ("Create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {showJoinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Join Classroom</h2>
            <form onSubmit={handleJoinClassroom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Classroom Code *</label>
                <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-lg tracking-wider" placeholder="ABCD12" maxLength={6} required disabled={submitting} />
                <p className="text-sm text-gray-500 mt-2">Enter the 6-character code provided by your teacher</p>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => { setShowJoinModal(false); setJoinCode(""); }} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors" disabled={submitting}>Cancel</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2" disabled={submitting}>
                  {submitting ? (<><Loader2 className="w-4 h-4 animate-spin" />Joining...</>) : ("Join")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
