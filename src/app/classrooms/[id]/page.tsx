import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import Navigation from "../../../shared/components/Navigation";
import useUser from "../../../shared/hooks/useUser";
import { ArrowLeft, BookOpen, Calendar, Clock, CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { api } from "../../../config/api";

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  deck_id: string | null;
  deck_title: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  required_repetitions: number;
  repetitions_completed: number;
  xp_goal?: number | null;
  xp_reward?: number | null;
  xp_progress?: number;
}

interface Classroom {
  id: string;
  name: string;
  description: string | null;
  code: string;
  teacher_name: string | null;
}

export default function StudentClassroomPage() {
  const { id } = useParams();
  const { user, loading: userLoading } = useUser();
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userLoading && user && id) {
      fetchClassroomData();
    }
  }, [user, userLoading, id]);

  const fetchClassroomData = async () => {
    try {
      setLoading(true);
      const [classroomData, assignmentsData] = await Promise.all([
        api.classrooms.get(id as string),
        api.classrooms.assignments(id as string),
      ]);
      setClassroom(classroomData);
      setAssignments(assignmentsData);
    } catch (err) {
      console.error("Error fetching classroom:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDueDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const now = new Date();
    const isOverdue = date < now;
    
    return {
      formatted: date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit'
      }),
      isOverdue
    };
  };

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  if (!classroom) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">Classroom not found</h2>
            <Link to="/classrooms" className="text-purple-600 hover:text-purple-700 mt-4 inline-block">
              ← Back to My Classrooms
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link 
          to="/classrooms"
          className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-700 mb-6 font-medium"
        >
          <ArrowLeft size={20} />
          Back to My Classrooms
        </Link>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{classroom.name}</h1>
              {classroom.description && (
                <p className="text-gray-600 mt-2">{classroom.description}</p>
              )}
              {classroom.teacher_name && (
                <p className="text-sm text-gray-500 mt-2">
                  Teacher: {classroom.teacher_name}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Classroom Code</p>
              <p className="font-mono font-bold text-lg text-purple-600">{classroom.code}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Calendar className="text-purple-600" size={28} />
              Assignments
            </h2>
            <span className="text-sm text-gray-500">
              {assignments.filter(a => a.completed).length} of {assignments.length} completed
            </span>
          </div>

          {assignments.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No assignments yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {assignments.map((assignment) => {
                const dueDate = formatDueDate(assignment.due_date);
                const cardClassName = `block border-2 rounded-lg p-5 transition-all ${
                  assignment.completed
                    ? 'border-green-200 bg-green-50' + (assignment.deck_id ? ' hover:border-green-300' : '')
                    : dueDate?.isOverdue
                    ? 'border-red-200 bg-red-50' + (assignment.deck_id ? ' hover:border-red-300' : '')
                    : 'border-gray-200' + (assignment.deck_id ? ' hover:border-purple-300 hover:shadow-md' : '')
                } ${!assignment.deck_id ? 'cursor-default' : 'cursor-pointer'}`;
                
                const CardContent = (
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-bold text-lg text-gray-900">
                            {assignment.title}
                          </h3>
                          {assignment.required_repetitions > 1 && assignment.deck_id && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                              assignment.completed
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}>
                              {assignment.repetitions_completed || 0}/{assignment.required_repetitions}
                            </span>
                          )}
                          {assignment.xp_reward && assignment.xp_reward > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-yellow-100 to-orange-100 text-orange-700 text-xs font-semibold rounded">
                              ⚡ {assignment.xp_reward} XP Reward
                            </span>
                          )}
                          {assignment.completed && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                              <CheckCircle size={14} />
                              Completed
                            </span>
                          )}
                        </div>
                        
                        {assignment.deck_id && assignment.deck_title && (
                          <p className="text-sm text-gray-600 mb-2">
                            <BookOpen size={14} className="inline mr-1" />
                            {assignment.deck_title}
                          </p>
                        )}

                        {/* XP Goal Progress */}
                        {assignment.xp_goal && assignment.xp_goal > 0 && (
                          <div className="mb-3 mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-purple-700">
                                💰 XP Goal: {assignment.xp_progress || 0}/{assignment.xp_goal}
                              </span>
                              <span className="text-xs font-semibold text-purple-700">
                                {Math.min(100, Math.round(((assignment.xp_progress || 0) / assignment.xp_goal) * 100))}%
                              </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                              <div
                                className={`h-3 rounded-full transition-all duration-500 ${
                                  assignment.completed
                                    ? 'bg-gradient-to-r from-green-400 to-green-600'
                                    : 'bg-gradient-to-r from-purple-400 to-pink-500'
                                }`}
                                style={{ 
                                  width: `${Math.min(100, Math.round(((assignment.xp_progress || 0) / assignment.xp_goal) * 100))}%` 
                                }}
                              ></div>
                            </div>
                            {!assignment.deck_id && (
                              <p className="text-xs text-gray-500 mt-1">
                                Gana XP practicando cualquier set para completar esta meta
                              </p>
                            )}
                          </div>
                        )}

                        {assignment.description && (
                          <p className="text-sm text-gray-600 mb-2">{assignment.description}</p>
                        )}

                        {dueDate && (
                          <div className={`text-sm flex items-center gap-1 ${
                            dueDate.isOverdue && !assignment.completed
                              ? 'text-red-600 font-semibold'
                              : 'text-gray-500'
                          }`}>
                            <Clock size={14} />
                            Due: {dueDate.formatted} at {dueDate.time}
                            {dueDate.isOverdue && !assignment.completed && (
                              <span className="ml-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                Overdue
                              </span>
                            )}
                          </div>
                        )}

                        {assignment.completed && assignment.completed_at && (
                          <p className="text-xs text-green-600 mt-2">
                            Completed on {new Date(assignment.completed_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      {assignment.deck_id && (
                        <ArrowRight 
                          className={`flex-shrink-0 ${
                            assignment.completed
                              ? 'text-green-600'
                              : dueDate?.isOverdue
                              ? 'text-red-600'
                              : 'text-purple-600'
                          }`} 
                          size={24} 
                        />
                      )}
                    </div>
                );

                return assignment.deck_id ? (
                  <Link
                    key={assignment.id}
                    to={`/study?deck=${assignment.deck_id}&classroom=${id}&assignment=${assignment.id}`}
                    className={cardClassName}
                  >
                    {CardContent}
                  </Link>
                ) : (
                  <div key={assignment.id} className={cardClassName}>
                    {CardContent}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
