import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Sparkles, Mail, Lock, Building2, Briefcase } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    category: "exporter",
    industry: "",
  });

  const industries = [
    "Auto Parts",
    "Chemicals",
    "Electronics",
    "Engineering",
    "IT Software",
    "Machinery",
    "Medical Devices",
    "Pharmaceuticals",
    "Solar",
    "Textiles"
  ];

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        navigate("/login");
      } else {
        setErrorMsg(data.detail || "Registration failed");
      }
    } catch (err) {
      setErrorMsg("Connection error. Is the server running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans">

      {/* LEFT SIDE */}
      <div className="hidden lg:flex w-1/2 bg-blue-900 p-16 flex-col justify-between text-white relative overflow-hidden">
        <div>
          <div className="flex items-center gap-2 mb-12">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold">ProExport</span>
          </div>

          <h1 className="text-5xl font-bold mb-6 leading-tight">
            AI-Powered Export <br /> Growth Engine
          </h1>

          <p className="text-xl text-blue-100 mb-12 max-w-lg">
            Scale your manufacturing exports with intelligent lead generation and automated outreach
          </p>
        </div>

        <div className="text-sm text-blue-300">
          © 2025 ProExport. All rights reserved.
        </div>
      </div>

      {/* RIGHT SIDE FORM */}
      <div className="w-full lg:w-1/2 bg-slate-50 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-10 border border-slate-100">

          <h2 className="text-3xl font-bold text-slate-900 mb-6">
            Create Account
          </h2>

          <form onSubmit={handleRegister} className="space-y-5">

            {/* EMAIL */}
            <div>
              <label className="block text-sm font-semibold mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-blue-500"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                />
              </div>
            </div>

            {/* PASSWORD */}
            <div>
              <label className="block text-sm font-semibold mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="password"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-blue-500"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
              </div>
            </div>

            {/* CATEGORY + INDUSTRY */}
            <div className="grid grid-cols-2 gap-4">

              {/* CATEGORY */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  You are a/an
                </label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-blue-500 appearance-none"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                  >
                    <option value="exporter">Exporter</option>
                    <option value="importer">Importer</option>
                  </select>
                </div>
              </div>

              {/* INDUSTRY */}
              <div>
                <label className="block text-sm font-semibold mb-1">
                  Industry
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <select
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-blue-500 appearance-none"
                    value={formData.industry}
                    onChange={(e) =>
                      setFormData({ ...formData, industry: e.target.value })
                    }
                  >
                    <option value="">Select Industry</option>
                    {industries.map((ind) => (
                      <option key={ind} value={ind}>
                        {ind}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-700 text-white rounded-xl font-bold hover:bg-blue-800 transition"
            >
              {loading ? "Creating Account..." : "Start Free Trial"}
            </button>

          </form>

          <div className="mt-6 text-center text-sm">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 font-semibold">
              Sign In
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}