
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { MOCK_USERS } from '../constants';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldCheck, ChevronDown } from 'lucide-react';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQuickFill, setShowQuickFill] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const success = await login(email, password);
      if (success) {
        navigate('/');
      } else {
        setError('Invalid credentials. Please check your email and password.');
        setLoading(false);
      }
    } catch (err) {
      setError('An error occurred during login.');
      setLoading(false);
    }
  };

  const fillCredentials = (u: typeof MOCK_USERS[0]) => {
    setEmail(u.email);
    setPassword(u.password);
    setShowQuickFill(false);
    setError('');
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-zankli-cream">
      {/* Visual Side (Hidden on Mobile) */}
      <div className="hidden md:flex md:w-1/2 bg-zankli-black relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/medical-icons.png')]"></div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-zankli-orange/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-zankli-orange/10 rounded-full blur-3xl -ml-48 -mb-48"></div>
        
        <div className="relative z-10 max-w-lg text-white">
          <div className="w-20 h-20 bg-zankli-orange rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-orange-900/50">
            <span className="text-4xl font-bold">Z</span>
          </div>
          <h1 className="text-5xl font-bold mb-6 leading-tight">Zankli Medical Centre</h1>
          <p className="text-xl text-gray-400 font-light leading-relaxed">
            Streamlined requisition management for Laboratory, Pharmacy, and Administrative departments.
          </p>
          <div className="mt-12 flex items-center gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-zankli-orange" />
              <span>Secure Access</span>
            </div>
            <div className="w-1.5 h-1.5 rounded-full bg-gray-700"></div>
            <span>Internal Use Only</span>
          </div>
        </div>
      </div>

      {/* Login Form Side */}
      <div className="flex-1 flex flex-col justify-center p-6 sm:p-12 lg:p-24 bg-white relative">
        <div className="w-full max-w-md mx-auto space-y-8">
          {/* Mobile Logo */}
          <div className="md:hidden mb-8">
            <div className="w-12 h-12 bg-zankli-orange rounded-lg flex items-center justify-center mb-4">
              <span className="text-2xl font-bold text-white">Z</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-gray-900 hidden md:block">Sign In</h2>
            <p className="text-gray-500">Access your requisition dashboard.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zankli-orange/20 focus:border-zankli-orange transition-colors bg-gray-50 focus:bg-white"
                    placeholder="name@zankli.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-zankli-orange/20 focus:border-zankli-orange transition-colors bg-gray-50 focus:bg-white"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full flex items-center justify-center gap-2 py-3.5 px-4 border border-transparent rounded-xl shadow-lg shadow-zankli-orange/30 text-base font-semibold text-white bg-zankli-orange hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-zankli-orange transition-all transform hover:-translate-y-0.5 active:translate-y-0 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? 'Authenticating...' : 'Sign In'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>

          {/* Developer Quick Fill Helper */}
          <div className="pt-8 border-t border-gray-100">
            <button 
              type="button"
              onClick={() => setShowQuickFill(!showQuickFill)}
              className="flex items-center justify-between w-full text-xs text-gray-400 hover:text-zankli-orange transition-colors"
            >
              <span>Developer: Quick Fill Credentials</span>
              <ChevronDown size={14} className={`transform transition-transform ${showQuickFill ? 'rotate-180' : ''}`} />
            </button>
            
            {showQuickFill && (
              <div className="mt-4 grid grid-cols-1 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                {MOCK_USERS.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => fillCredentials(u)}
                    className="flex items-center gap-3 w-full p-2 text-left text-sm rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 group-hover:bg-zankli-orange group-hover:text-white transition-colors">
                      {u.name.charAt(0)}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <p className="font-medium text-gray-700 truncate">{u.name}</p>
                      <p className="text-xs text-gray-400 truncate">{u.role}</p>
                    </div>
                    <div className="text-xs text-gray-300 font-mono">
                      {u.password}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="absolute bottom-4 left-0 right-0 text-center">
             <p className="text-xs text-gray-300">&copy; {new Date().getFullYear()} Zankli Medical Centre</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
