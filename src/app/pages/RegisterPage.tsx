// import React, { useState } from "react";
// import { useNavigate, Link } from "react-router";
// import { Sparkles, Mail, Lock, Building2, Briefcase } from "lucide-react";

// const COLORS = {
//   primary: "#1e3a8a", // Navy blue
//   accent: "#2563eb",  // Brighter blue
//   success: "#22c55e",
//   error: "#ef4444",
//   bg: "#f8fafc",
//   text: "#0f172a",
//   muted: "#64748b"
// };

// const API = import.meta.env.VITE_API_URL || "http://10.120.101.22:8005";

// export default function RegisterPage() {
//   const [formData, setFormData] = useState({
//     email: "",
//     password: "",
//     category: "exporter",
//     industry: "",
//   });
//   const industries = [
//   "Auto Parts",
//   "Chemicals",
//   "Electronics",
//   "Engineering",
//   "IT Software",
//   "Machinery",
//   "Medical Devices",
//   "Pharmaceuticals",
//   "Solar",
//   "Textiles"
// ];
//   const [loading, setLoading] = useState(false);
//   const [errorMsg, setErrorMsg] = useState("");
//   const navigate = useNavigate();

//   const handleRegister = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);
//     setErrorMsg("");

//     try {
//       const res = await fetch(`${API}/register`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(formData),
//       });

//       const data = await res.json();
//       if (res.ok) {
//         navigate("/login");
//       } else {
//         setErrorMsg(data.detail || "Registration failed");
//       }
//     } catch (err) {
//       setErrorMsg("Connection error. Is the server running?");
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen flex font-sans">
//       {/* Left Side - Branding (matching the image) */}
//       <div className="hidden lg:flex w-1/2 bg-blue-900 p-16 flex-col justify-between text-white relative overflow-hidden">
//         <div className="relative z-10">
//           <div className="flex items-center gap-2 mb-12">
//             <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
//               <Sparkles className="w-6 h-6" />
//             </div>
//             <span className="text-2xl font-bold">ProExport</span>
//           </div>

//           <h1 className="text-5xl font-bold mb-6 leading-tight">
//             AI-Powered Export <br /> Growth Engine
//           </h1>
//           <p className="text-xl text-blue-100 mb-12 max-w-lg">
//             Scale your manufacturing exports with intelligent lead generation and automated outreach
//           </p>

//           <div className="space-y-8">
//             <div className="flex gap-4">
//               <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center font-bold">1</div>
//               <div>
//                 <h3 className="font-bold text-lg">Approve Curated Leads</h3>
//                 <p className="text-blue-200">Swipe through AI-selected export opportunities tailored to your ICP</p>
//               </div>
//             </div>
//             <div className="flex gap-4">
//               <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center font-bold">2</div>
//               <div>
//                 <h3 className="font-bold text-lg">AI Handles Outreach</h3>
//                 <p className="text-blue-200">Omni-channel automation across LinkedIn, Email, WhatsApp, and Calls</p>
//               </div>
//             </div>
//             <div className="flex gap-4">
//               <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center font-bold">3</div>
//               <div>
//                 <h3 className="font-bold text-lg">Attend Scheduled Meetings</h3>
//                 <p className="text-blue-200">Focus on closing deals while AI manages the pipeline</p>
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="relative z-10 text-sm text-blue-300">
//           © 2025 ProExport. All rights reserved.
//         </div>

//         {/* Decorative elements */}
//         <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-blue-800/50 to-transparent" />
//       </div>

//       {/* Right Side - Form */}
//       <div className="w-full lg:w-1/2 bg-slate-50 flex items-center justify-center p-8">
//         <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-10 border border-slate-100">
//           <div className="mb-8">
//             <h2 className="text-3xl font-bold text-slate-900 mb-2">Create Account</h2>
//             <p className="text-slate-500">Join ProExport to scale your global trade</p>
//           </div>

//           <form onSubmit={handleRegister} className="space-y-5">
//             <div>
//               <label className="block text-sm font-semibold text-slate-700 mb-1">Email Address</label>
//               <div className="relative">
//                 <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
//                 <input
//                   type="email"
//                   required
//                   placeholder="name@company.com"
//                   className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
//                   value={formData.email}
//                   onChange={(e) => setFormData({ ...formData, email: e.target.value })}
//                 />
//               </div>
//             </div>

//             <div>
//               <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
//               <div className="relative">
//                 <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
//                 <input
//                   type="password"
//                   required
//                   placeholder="••••••••"
//                   className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
//                   value={formData.password}
//                   onChange={(e) => setFormData({ ...formData, password: e.target.value })}
//                 />
//               </div>
//             </div>

//             <div className="grid grid-cols-2 gap-4">
//               <div>
//                 <label className="block text-sm font-semibold text-slate-700 mb-1">You are a/an</label>
//                 <div className="relative">
//                   <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
//                   <select
//                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium appearance-none"
//                     value={formData.category}
//                     onChange={(e) => setFormData({ ...formData, category: e.target.value })}
//                   >
//                     <option value="exporter">Exporter</option>
//                     <option value="importer">Importer</option>
//                   </select>
//                 </div>
//               </div>

//               <div>
//                 <label className="block text-sm font-semibold text-slate-700 mb-1">Industry</label>
//                 <div className="relative">
//                   <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
//                   {/* <input
//                     type="text"
//                     required
//                     placeholder="e.g. Textiles"
//                     className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
//                     value={formData.industry}
//                     onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
//                   /> */}
//                   <div className="mb-4">
//   <label className="block text-sm font-medium mb-2">
//     Industry
//   </label>

//   <select
//     value={industry}
//     onChange={(e) => setIndustry(e.target.value)}
//     className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
//     required
//   >
//     <option value="">Select Industry</option>

//     {industries.map((ind) => (
//       <option key={ind} value={ind}>
//         {ind}
//       </option>
//     ))}
//   </select>
// </div>
//                 </div>
//               </div>
//             </div>

//             {errorMsg && (
//               <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
//                 {errorMsg}
//               </div>
//             )}

//             <button
//               type="submit"
//               disabled={loading}
//               className="w-full py-4 bg-gradient-to-r from-blue-700 to-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-70 disabled:translate-y-0"
//             >
//               {loading ? "Creating Account..." : "Start Free Trial"}
//             </button>
//           </form>

//           <div className="mt-8 text-center pt-6 border-t border-slate-100">
//             <p className="text-slate-600">
//               Already have an account?{" "}
//               <Link to="/login" className="text-blue-600 font-bold hover:underline">
//                 Sign In
//               </Link>
//             </p>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }
import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Sparkles, Mail, Lock, Building2, Briefcase } from "lucide-react";

const API = "http://10.120.101.22:8005";

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