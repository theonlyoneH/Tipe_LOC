import { motion } from 'motion/react';
import { User, Mail, Building, Globe, Bell, Shield, Key, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

const API = "http://10.120.101.22:8005";

export function Profile() {
  const [userData, setUserData] = useState({
    email: '',
    industry: '',
    category: '',
    country: '',
    description: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const storedUser = localStorage.getItem('user');
      if (!storedUser) return;

      const { email } = JSON.parse(storedUser);
      try {
        const res = await fetch(`${API}/user/profile?email=${email}`);
        if (res.ok) {
          const data = await res.json();
          setUserData(data);
        }
      } catch (err) {
        console.error("Failed to fetch profile", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/user/profile?email=${userData.email}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: userData.description,
          industry: userData.industry,
          category: userData.category
        })
      });

      if (res.ok) {
        toast.success("Profile updated successfully!");
        // Update local storage too
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({ ...storedUser, ...userData }));
      } else {
        toast.error("Failed to update profile");
      }
    } catch (err) {
      toast.error("Connection error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 flex items-center justify-center">Loading profile...</div>;
  }

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">Profile Settings</h1>
        <p className="text-slate-600">Manage your account and preferences</p>
      </div>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200"
      >
        <div className="flex items-center gap-6 mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center text-white text-3xl font-bold">
            {userData.email.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900 mb-1">{userData.email.split('@')[0]}</h2>
            <p className="text-slate-600 capitalize">{userData.category} Manager</p>
            <button className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
              Change Photo
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email (read-only)
                </div>
              </label>
              <input
                type="email"
                value={userData.email}
                readOnly
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none text-slate-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Category
                </div>
              </label>
              <select
                value={userData.category}
                onChange={(e) => setUserData({ ...userData, category: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="exporter">Exporter</option>
                <option value="importer">Importer</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4" />
                  Industry
                </div>
              </label>
              <input
                type="text"
                value={userData.industry}
                onChange={(e) => setUserData({ ...userData, industry: e.target.value })}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  Location
                </div>
              </label>
              {/* <input
                type="text"
                defaultValue="New York, USA"
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-xl focus:outline-none"
              /> */}
              <select
                value={userData.country}
                onChange={(e) =>
                  setUserData({ ...userData, country: e.target.value })
                }
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="India">India</option>
                <option value="Global">Global</option>
              </select>
            </div>

          </div>

          {/* Description Field (Requested) */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Company Description
              </div>
            </label>
            <textarea
              rows={4}
              value={userData.description}
              onChange={(e) => setUserData({ ...userData, description: e.target.value })}
              placeholder="Tell us about your company and export goals..."
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-70"
        >
          {saving ? "Saving Changes..." : "Save Changes"}
        </button>
      </motion.div>

      {/* Preferences (Keep as is for UI consistency) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200"
      >
        <div className="flex items-center gap-2 mb-6">
          <Bell className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900">Notification Preferences</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <div className="font-medium text-slate-900">New Lead Matches</div>
              <div className="text-sm text-slate-600">Get notified when AI finds new matches</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </motion.div>

      {/* Security */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200"
      >
        <div className="flex items-center gap-2 mb-6">
          <Shield className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900">Security</h2>
        </div>

        <div className="space-y-4">
          <button className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-slate-600" />
              <div className="text-left">
                <div className="font-medium text-slate-900">Change Password</div>
                <div className="text-sm text-slate-600">Secure your account</div>
              </div>
            </div>
            <span className="text-blue-600">→</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// Simple icon component to avoid import issues if not in lucide
function Briefcase(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      <rect width="20" height="14" x="2" y="6" rx="2" />
    </svg>
  );
}
