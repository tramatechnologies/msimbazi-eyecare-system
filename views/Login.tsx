
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';

const Login: React.FC = () => {
  const { login, isLoading } = useAuth();
  const { error: showError, success: showSuccess } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validation
    const newErrors: { email?: string; password?: string } = {};
    
    if (!email) {
      newErrors.email = 'Please enter an email address';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Please enter a password';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Call backend authentication (role is determined by backend)
    const result = await login(email, password);
    
    if (result.success) {
      showSuccess('Login successful!');
    } else {
      showError(result.error || 'Login failed. Please check your credentials.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-primary-50 via-slate-50 to-brand-secondary-50 flex items-center justify-center p-4 font-sans">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-brand-primary-100 rounded-full blur-[100px] opacity-30"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-brand-secondary-100 rounded-full blur-[100px] opacity-30"></div>
      </div>

      {/* Centered Card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden relative z-10 border border-slate-100">
        
        {/* Header with Logo */}
        <div className="bg-gradient-to-r from-brand-primary to-brand-secondary p-8 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16"></div>
          
          <div className="relative z-10">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden">
              <img src="/src/assets/Msimbazi Logo.jpg" alt="Msimbazi Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-2xl font-black text-white mb-1 tracking-tight">Msimbazi</h1>
            <p className="text-white/80 text-sm font-semibold">Eyecare Management System</p>
          </div>
        </div>

        {/* Form Section */}
        <div className="p-8">
          <div className="mb-8">
            <h2 className="text-xl font-black text-slate-900 mb-1 tracking-tight">Welcome Back</h2>
            <p className="text-slate-500 text-sm font-medium">Sign in to your account</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide ml-1">Email Address</label>
              <div className="relative group">
                <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors text-sm"></i>
                <input 
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter Email Address"
                  className={`w-full pl-12 pr-4 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none transition-all font-medium text-sm text-slate-700 placeholder:text-slate-400 ${errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}
                />
                {errors.email && <p className="text-xs text-red-600 ml-1 mt-1 font-medium">{errors.email}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wide ml-1">Password</label>
              <div className="relative group">
                <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors text-sm"></i>
                <input 
                  required
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter Password"
                  className={`w-full pl-12 pr-12 py-3 bg-slate-50 border rounded-xl focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary outline-none transition-all font-medium text-sm text-slate-700 placeholder:text-slate-400 ${errors.password ? 'border-red-300 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}
                />
                {errors.password && <p className="text-xs text-red-600 ml-1 mt-1 font-medium">{errors.password}</p>}
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors text-sm"
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input type="checkbox" id="remember" className="w-4 h-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary" />
              <label htmlFor="remember" className="text-xs font-medium text-slate-600 cursor-pointer hover:text-slate-700">Remember me</label>
            </div>

            <button
              disabled={isLoading}
              type="submit"
              className="w-full btn-brand-gradient text-white py-3 rounded-xl font-bold text-sm uppercase tracking-wide shadow-lg hover:shadow-xl flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Signing in...
                </>
              ) : (
                <>
                  Sign In
                  <i className="fas fa-arrow-right text-xs"></i>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-slate-500 text-[11px] font-medium">
            &copy; 2026 Msimbazi Eyecare. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
