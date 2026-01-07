import { useState, useEffect } from "react";
import useUser from "@/shared/hooks/useUser";
import { api } from "@/config/api";
import Navigation from "@/shared/components/Navigation";
import { Search, Shield, Crown, Trash2 } from "lucide-react";

type AdminUser = {
  id: string;
  email: string;
  display_name: string | null;
  role: "user" | "teacher" | "admin" | string;
  plan: "free" | "premium" | null;
  is_premium: boolean;
  created_at: string;
};

export default function AdminUsersPage() {
  const { data: currentUser, loading: userLoading } = useUser();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (!userLoading && currentUser) {
      if (currentUser.role !== "admin") {
        window.location.href = "/dashboard";
      }
    } else if (!userLoading && !currentUser) {
      window.location.href = "/account/signin";
    }
  }, [currentUser, userLoading]);

  // Fetch users
  useEffect(() => {
    fetchUsers();
  }, [search, roleFilter, planFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params: { search?: string; role?: string; plan?: string } = {};
      if (search) params.search = search;
      if (roleFilter !== "all") params.role = roleFilter;
      if (planFilter !== "all") params.plan = planFilter;

      const data = await api.admin.users.list(params);
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      showMessage("Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (user: AdminUser, newRole: "admin" | "user" | string) => {
    if (newRole === user.role) return;
    setConfirmDialog({
      title: "Change Role?",
      message: `Are you sure you want to change ${user.email}'s role to ${newRole}?`,
      onConfirm: () => updateUser(user.id, { role: newRole }),
    });
  };

  const handleChangePlan = async (user: AdminUser, newPlan: "premium" | "free") => {
    if (newPlan === user.plan) return;
    const action = newPlan === "premium" ? "Grant Premium" : "Set Free";
    setConfirmDialog({
      title: `${action}?`,
      message: `Change ${user.email} plan to ${newPlan}?`,
      onConfirm: () => updateUser(user.id, { plan: newPlan }),
    });
  };

  const handleTogglePremium = async (user: AdminUser) => {
    const next = !user.is_premium;
    const nextPlan = next ? "premium" : "free";
    setConfirmDialog({
      title: next ? "Grant Premium?" : "Revoke Premium?",
      message: `${next ? "Grant" : "Revoke"} premium access for ${user.email}?`,
      onConfirm: () => updateUser(user.id, { is_premium: next, plan: nextPlan }),
    });
  };

  const handleDeleteUser = async (user: AdminUser) => {
    setConfirmDialog({
      title: "Delete User?",
      message: `Are you sure you want to permanently delete ${user.email}? This action cannot be undone.`,
      onConfirm: () => deleteUser(user.id),
    });
  };

  const deleteUser = async (userId: string) => {
    setConfirmDialog(null);
    try {
      await api.admin.users.delete(userId);
      showMessage("User deleted successfully", "success");
      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      const message = error instanceof Error ? error.message : "Failed to delete user";
      showMessage(message, "error");
    }
  };

  const updateUser = async (userId: string, updates: Partial<Pick<AdminUser, "role" | "plan" | "is_premium">>) => {
    setConfirmDialog(null);
    try {
      await api.admin.users.update(userId, updates);
      showMessage("User updated successfully", "success");
      fetchUsers();
    } catch (error) {
      console.error("Error updating user:", error);
      const message = error instanceof Error ? error.message : "Failed to update user";
      showMessage(message, "error");
    }
  };

  const showMessage = (text: string, type: "success" | "error") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  if (userLoading || (currentUser && currentUser.role !== "admin")) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="text-red-600" size={32} />
            Admin — Users
          </h1>
          <p className="text-gray-600 mt-2">
            Manage user roles and premium access
          </p>
        </div>

        {/* Search & Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={20}
              />
              <input
                type="text"
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Roles</option>
              <option value="user">User</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>

            {/* Plan Filter */}
            <select
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Plans</option>
              <option value="premium">Premium</option>
              <option value="free">Free</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-gray-600">No users found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Display Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Plan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.display_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          value={user.role}
                          onChange={(e) =>
                            handleChangeRole(user, e.target.value)
                          }
                          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          disabled={user.id === currentUser?.id}
                        >
                          <option value="user">User</option>
                          <option value="teacher">Teacher</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            user.plan === "premium"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {user.plan === "premium" ? (
                            <>
                              <Crown size={12} /> Premium
                            </>
                          ) : (
                            "Free"
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTogglePremium(user)}
                            className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                              user.is_premium
                                ? "bg-red-100 text-red-700 hover:bg-red-200"
                                : "bg-green-100 text-green-700 hover:bg-green-200"
                            }`}
                          >
                            {user.is_premium ? "Revoke Premium" : "Grant Premium"}
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete User"
                            disabled={user.id === currentUser?.id}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {confirmDialog.title}
            </h3>
            <p className="text-gray-600 mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Message */}
      {message && (
        <div className="fixed bottom-4 right-4 z-50">
          <div
            className={`px-6 py-3 rounded-lg shadow-lg ${
              message.type === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {message.text}
          </div>
        </div>
      )}
    </div>
  );
}
