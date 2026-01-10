import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Navigation from "../../shared/components/Navigation";
import useUser from "../../shared/hooks/useUser";
import { Calendar, Clock, CheckCircle, Loader2, ArrowRight, BookOpen } from "lucide-react";
import { api } from "../../config/api";

interface Assignment {
  id: string;
  title: string;
  description: string | null;
  deck_id: string;
  deck_title: string;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  classroom_id: string;
  classroom_name: string;
  classroom_color?: string;
}

export default function StudentAssignmentsPage() {
  const { user, loading: userLoading } = useUser();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userLoading && user) {
      fetchAllAssignments();
    }
  }, [user, userLoading]);

  const fetchAllAssignments = async () => {
    try {
      setLoading(true);
      // Get all classrooms first
      const classrooms = await api.classrooms.list();
      
      // Get assignments from all classrooms
      const allAssignments = await Promise.all(
        classrooms.map(async (classroom: any) => {
          const classroomAssignments = await api.classrooms.assignments(classroom.id);
          return classroomAssignments.map((assignment: any) => ({
            ...assignment,
            classroom_id: classroom.id,
            classroom_name: classroom.name,
            classroom_color: classroom.color,
          }));
        })
      );
      
      // Flatten and sort by due date
      const flatAssignments = allAssignments.flat().sort((a: any, b: any) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      });
      
      setAssignments(flatAssignments);
    } catch (err) {
      console.error("Error fetching assignments:", err);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="text-blue-600" size={32} />
            Assignments
          </h1>
          <p className="text-gray-600 mt-2">
            View all your assignments from enrolled classrooms
          </p>
        </div>

        {assignments.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="text-blue-600" size={32} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Assignments Yet</h2>
            <p className="text-gray-600 mb-6">
              You don't have any assignments at the moment. Check your profile to join a classroom.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => {
              const dueDate = formatDueDate(assignment.due_date);
              
              return (
                <Link
                  key={assignment.id}
                  to={`/study?deck=${assignment.deck_id}&classroom=${assignment.classroom_id}&assignment=${assignment.id}`}
                  className={`block border-l-4 border-2 rounded-lg p-5 transition-all ${
                    assignment.completed
                      ? 'border-green-200 bg-green-50 hover:border-green-300'
                      : dueDate?.isOverdue
                      ? 'border-red-200 bg-red-50 hover:border-red-300'
                      : 'border-gray-200 hover:shadow-md bg-white'
                  }`}
                  style={{
                    borderLeftColor: assignment.classroom_color || '#8B5CF6'
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold text-lg text-gray-900">
                          {assignment.title}
                        </h3>
                        {assignment.completed && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                            <CheckCircle size={14} />
                            Completed
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 mb-2">
                        <p className="text-sm font-semibold" style={{ color: assignment.classroom_color || '#8B5CF6' }}>
                          {assignment.classroom_name}
                        </p>
                      </div>

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

                    <ArrowRight 
                      className={`flex-shrink-0 ${
                        assignment.completed
                          ? 'text-green-600'
                          : dueDate?.isOverdue
                          ? 'text-red-600'
                          : 'text-blue-600'
                      }`} 
                      size={24} 
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
