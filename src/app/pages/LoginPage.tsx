import React, { useState } from "react";
import { useNavigate, Link } from "react-router";
import { Sparkles, Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "http://10.120.101.22:8005";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const navigate = useNavigate();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg("");

        try {
            const res = await fetch(`${API}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();
            if (data.success) {
                localStorage.setItem("user", JSON.stringify(data.user));
                localStorage.setItem("token", data.token);
                navigate("/");
                // Force reload to update Layout
                window.location.reload();
            } else {
                setErrorMsg(data.message || "Invalid credentials");
            }
        } catch (err) {
            setErrorMsg("Server error. Is the backend running?");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex font-sans bg-slate-50">
            {/* Left Side - Branding */}
            <div className="hidden lg:flex w-1/2 bg-blue-900 p-16 flex-col justify-between text-white relative overflow-hidden">
                <div className="relative z-10">
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

                    <div className="space-y-8">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center font-bold">1</div>
                            <div>
                                <h3 className="font-bold text-lg">Approve Curated Leads</h3>
                                <p className="text-blue-200">Swipe through AI-selected export opportunities tailored to your ICP</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center font-bold">2</div>
                            <div>
                                <h3 className="font-bold text-lg">AI Handles Outreach</h3>
                                <p className="text-blue-200">Omni-channel automation across LinkedIn, Email, WhatsApp, and Calls</p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center font-bold">3</div>
                            <div>
                                <h3 className="font-bold text-lg">Attend Scheduled Meetings</h3>
                                <p className="text-blue-200">Focus on closing deals while AI manages the pipeline</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 text-sm text-blue-300">
                    © 2025 ProExport. All rights reserved.
                </div>

                <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-blue-800/50 to-transparent" />
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
                <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-10 border border-slate-100">
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h2>
                        <p className="text-slate-500">Sign in to continue to your dashboard</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 mb-1">Email / Username</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="email"
                                    required
                                    placeholder="demo@proexport.ai"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="block text-sm font-semibold text-slate-700">Password</label>
                                <button type="button" className="text-sm text-blue-600 font-semibold hover:underline">Forgot?</button>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {errorMsg && (
                            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                                {errorMsg}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-4 bg-gradient-to-r from-blue-700 to-blue-600 text-white rounded-xl font-bold font-lg shadow-lg shadow-blue-200 flex items-center justify-center gap-2 hover:shadow-blue-300 hover:-translate-y-1 transition-all active:scale-95 disabled:opacity-70 disabled:translate-y-0"
                        >
                            {loading ? "Signing In..." : (
                                <>
                                    Sign In <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-8 relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                        <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-medium">Or continue with</span></div>
                    </div>

                    <div className="mt-6 grid grid-cols-2 gap-4">
                        <button className="flex items-center justify-center gap-2 py-3 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-semibold text-slate-700">
                            <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                            Google
                        </button>
                        <button className="flex items-center justify-center gap-2 py-3 px-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all font-semibold text-slate-700">
                            <img src="https://www.svgrepo.com/show/448234/linkedin.svg" className="w-5 h-5" alt="LinkedIn" />
                            LinkedIn
                        </button>
                    </div>

                    <div className="mt-8 text-center pt-6 border-t border-slate-100">
                        <p className="text-slate-600">
                            Don't have an account?{" "}
                            <Link to="/register" className="text-blue-600 font-bold hover:underline">
                                Start free trial
                            </Link>
                        </p>
                    </div>
                </div>

                <div className="absolute bottom-8 text-xs text-slate-400">
                    By signing in, you agree to our Terms of Service and Privacy Policy
                </div>
            </div>
        </div>
    );
}
