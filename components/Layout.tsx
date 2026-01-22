
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserRole, Patient } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useDebounce } from '../utils/debounce';
import { searchPatients } from '../utils/patientUtils';
import { UI_TIMING } from '../constants';

interface LayoutProps {
  children: React.ReactNode;
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  currentPage: string;
  onPageChange: (page: string) => void;
  patients: Patient[];
}

const Layout: React.FC<LayoutProps> = ({ children, activeRole, onRoleChange, currentPage, onPageChange, patients }) => {
  const { logout, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hasManualToggle, setHasManualToggle] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-line', roles: [UserRole.RECEPTIONIST, UserRole.MANAGER, UserRole.ADMIN, UserRole.OPTOMETRIST, UserRole.PHARMACIST, UserRole.OPTICAL_DISPENSER, UserRole.BILLING_OFFICER] },
    { id: 'registration', label: 'Registration', icon: 'fa-user-plus', roles: [UserRole.RECEPTIONIST, UserRole.ADMIN] },
    { id: 'patients', label: 'Patients List', icon: 'fa-users', roles: [UserRole.RECEPTIONIST, UserRole.MANAGER, UserRole.ADMIN] },
    { id: 'appointments', label: 'Appointments', icon: 'fa-calendar-check', roles: [UserRole.RECEPTIONIST, UserRole.ADMIN, UserRole.OPTOMETRIST] },
    { id: 'queue', label: 'Queue Board', icon: 'fa-list-ol', roles: [UserRole.RECEPTIONIST, UserRole.MANAGER, UserRole.ADMIN] },
    { id: 'clinical', label: 'Clinical EMR', icon: 'fa-stethoscope', roles: [UserRole.OPTOMETRIST, UserRole.ADMIN] },
    { id: 'pharmacy', label: 'Pharmacy', icon: 'fa-pills', roles: [UserRole.PHARMACIST, UserRole.ADMIN] },
    { id: 'optical', label: 'Optical Shop', icon: 'fa-glasses', roles: [UserRole.OPTICAL_DISPENSER, UserRole.ADMIN] },
    { id: 'billing', label: 'Billing & Claims', icon: 'fa-file-invoice-dollar', roles: [UserRole.BILLING_OFFICER, UserRole.ADMIN] },
    // Admin-specific menu items
    { id: 'users', label: 'User Management', icon: 'fa-user-shield', roles: [UserRole.ADMIN] },
    { id: 'reports', label: 'Reports & Analytics', icon: 'fa-chart-bar', roles: [UserRole.ADMIN, UserRole.MANAGER] },
    { id: 'settings', label: 'System Settings', icon: 'fa-cog', roles: [UserRole.ADMIN] },
    { id: 'audit', label: 'Audit Logs', icon: 'fa-history', roles: [UserRole.ADMIN] },
  ];

  const filteredMenu = menuItems.filter(item => item.roles.includes(activeRole));

  const debouncedSearchTerm = useDebounce(searchTerm, UI_TIMING.DEBOUNCE_DELAY);
  
  const searchResults = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return [];
    return searchPatients(patients, debouncedSearchTerm).slice(0, 5);
  }, [patients, debouncedSearchTerm]);

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getRoleDisplayName = (role: UserRole) => {
    // Map ADMIN back to Super Admin for display if needed
    if (role === UserRole.ADMIN) {
      return 'Super Admin';
    }
    return role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      // Only auto-set sidebar state if user hasn't manually toggled it
      // On mobile, always close sidebar when resizing to mobile
      if (mobile) {
        setIsSidebarOpen(false);
      } else if (!hasManualToggle) {
        // On desktop, only set to open if it was never manually toggled
        setIsSidebarOpen(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [hasManualToggle]);

  // Determine sidebar width based on state and platform
  const sidebarWidth = isSidebarOpen ? 'w-64' : (isMobile ? 'w-64' : 'w-20');
  const sidebarTranslate = (isMobile && !isSidebarOpen) ? '-translate-x-full' : 'translate-x-0';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 relative">
      {/* Mobile Backdrop */}
      {isMobile && isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 transition-opacity duration-300 opacity-100"
          style={{
            backgroundColor: 'rgba(4, 120, 87, 0.5)', // Dark green backdrop (Emerald-700 with opacity)
          }}
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed lg:relative z-50 h-full text-white flex-shrink-0 flex flex-col transition-all duration-300 ease-in-out ${sidebarWidth} ${sidebarTranslate}`}
        style={{
          backgroundColor: '#047857', // Dark green (Emerald-700) - darker than brand-secondary-dark
        }}
      >
        <div 
          className={`p-6 border-b transition-all duration-300 ease-in-out ${isSidebarOpen ? 'flex flex-col items-center gap-3' : 'flex items-center justify-center'}`}
          style={{
            borderColor: '#065f46', // Even darker green for border (Emerald-800)
          }}
        >
          <div className="bg-white p-2 rounded-xl flex-shrink-0 shadow-md overflow-hidden">
            <img 
              src="/src/assets/Msimbazi Logo.jpg" 
              alt="Msimbazi Logo" 
              className="w-8 h-8 object-cover rounded-lg"
            />
          </div>
          {isSidebarOpen && (
            <div 
              className="flex flex-col items-center text-center min-w-0 transition-opacity duration-300 ease-in-out opacity-100"
              style={{ 
                transitionDelay: '100ms',
                willChange: 'opacity'
              }}
            >
              <span className="font-bold text-sm tracking-tight leading-tight whitespace-nowrap select-none">
                Msimbazi EyeCare
              </span>
              <span className="text-xs text-slate-400 font-medium leading-tight whitespace-nowrap select-none mt-0.5">
                Patient Management System
              </span>
            </div>
          )}
        </div>
        
        <nav className={`flex-1 overflow-y-auto p-4 space-y-2 transition-all duration-300 ${!isSidebarOpen && !isMobile ? 'px-2' : 'px-4'}`}>
          {filteredMenu.map(item => (
            <button
              key={item.id}
              title={!isSidebarOpen ? item.label : ''}
              onClick={() => {
                onPageChange(item.id);
                if (isMobile) setIsSidebarOpen(false);
              }}
              className={`w-full flex items-center transition-all duration-300 rounded-xl ${
                isSidebarOpen ? 'px-4 py-3.5 gap-3' : 'p-3 justify-center'
              } ${
                currentPage === item.id 
                  ? 'text-white shadow-lg font-semibold' 
                  : 'text-slate-300 hover:text-white'
              }`}
              style={currentPage === item.id 
                ? {
                    backgroundColor: 'var(--brand-primary)',
                    boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.2), 0 4px 6px -2px rgba(16, 185, 129, 0.1)',
                  }
                : {
                    backgroundColor: 'transparent',
                  }
              }
              onMouseEnter={(e) => {
                if (currentPage !== item.id) {
                  e.currentTarget.style.backgroundColor = '#065f46'; // Dark green hover (Emerald-800)
                }
              }}
              onMouseLeave={(e) => {
                if (currentPage !== item.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <i className={`fas ${item.icon} text-base w-6 flex-shrink-0 text-center`}></i>
              {isSidebarOpen && (
                <span className="font-medium text-sm whitespace-nowrap overflow-hidden transition-opacity duration-300 opacity-100">
                  {item.label}
                </span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Enhanced Top Header */}
        <header className="h-20 bg-white border-b border-slate-200 shadow-sm relative z-30">
          <div className="h-full flex items-center justify-between gap-4 sm:gap-6 lg:gap-8 px-4 sm:px-6 lg:px-8 xl:px-10">
            {/* Left Section */}
            <div className="flex items-center gap-3 sm:gap-4 lg:gap-6 flex-1 min-w-0">
              {/* Sidebar Toggle */}
              <button 
                onClick={() => {
                  setIsSidebarOpen(!isSidebarOpen);
                  setHasManualToggle(true);
                }}
                className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-600 transition-all flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 flex-shrink-0"
                aria-label="Toggle Sidebar"
              >
                <i className="fas fa-bars text-base"></i>
              </button>

              {/* Page Title */}
              <div className="flex items-center gap-3 sm:gap-4 min-w-0 pr-2 sm:pr-4">
                <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight capitalize whitespace-nowrap hidden sm:block">
                  {currentPage.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </h2>
              </div>
              
              {/* Enhanced Search Bar */}
              <div className="relative hidden md:block flex-1 max-w-md ml-4 lg:ml-6" ref={searchRef}>
                <div className="relative">
                  <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                  <input 
                    type="text"
                    placeholder="Search patients, appointments, or records..."
                    value={searchTerm}
                    onFocus={() => setIsSearchOpen(true)}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsSearchOpen(true);
                    }}
                    className="w-full pl-11 pr-4 py-2.5 sm:py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all placeholder:text-slate-400 hover:border-slate-300"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setIsSearchOpen(false);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <i className="fas fa-times text-xs"></i>
                    </button>
                  )}
                </div>

                {/* Enhanced Search Dropdown */}
                {isSearchOpen && searchTerm.trim() !== '' && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
                    <div className="p-3 bg-gradient-to-r from-brand-primary-50 to-brand-secondary-50 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Search Results</span>
                        <span className="text-xs font-semibold text-slate-500">{searchResults.length} found</span>
                      </div>
                    </div>
                    <div className="max-h-80 overflow-y-auto custom-scrollbar">
                      {searchResults.length > 0 ? (
                        searchResults.map(patient => (
                          <button
                            key={patient.id}
                            onClick={() => {
                              setIsSearchOpen(false);
                              setSearchTerm('');
                              onPageChange('clinical');
                            }}
                            className="w-full flex items-center gap-3 p-4 hover:bg-brand-primary-50 text-left transition-all border-b border-slate-50 last:border-none group"
                          >
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white font-bold text-sm shadow-md group-hover:scale-110 transition-transform">
                              {patient.name.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 truncate">{patient.name}</p>
                              <p className="text-xs text-slate-500 font-medium mt-0.5">
                                <span className="font-mono">{patient.id}</span> • {patient.gender} • {patient.phone}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase whitespace-nowrap ${
                                patient.status === 'WAITING' ? 'bg-orange-100 text-orange-700' :
                                patient.status === 'IN_CLINICAL' ? 'bg-brand-primary-100 text-brand-primary-dark' :
                                patient.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {patient.status.replace('_', ' ')}
                              </span>
                            </div>
                            <i className="fas fa-chevron-right text-slate-300 group-hover:text-brand-primary transition-colors"></i>
                          </button>
                        ))
                      ) : (
                        <div className="p-12 text-center text-slate-400">
                          <i className="fas fa-search text-3xl mb-3 opacity-20"></i>
                          <p className="text-sm font-semibold text-slate-600 mb-1">No matching records</p>
                          <p className="text-xs text-slate-500">Try a different search term</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          
            {/* Right Section */}
            <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 flex-shrink-0 ml-4 lg:ml-6">
              {/* Date & Time Display */}
              <div className="hidden xl:flex flex-col items-end px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-100 min-w-[140px] mr-2">
                <div className="flex items-center gap-2">
                  <i className="fas fa-clock text-xs text-slate-400"></i>
                  <span className="text-sm font-bold text-slate-900">{formatTime(currentTime)}</span>
                </div>
                <span className="text-xs text-slate-500 font-medium mt-0.5">{formatDate(currentTime)}</span>
              </div>

              {/* Notifications */}
              <div className="relative" ref={notificationsRef}>
                <button 
                  onClick={() => {
                    setIsNotificationsOpen(!isNotificationsOpen);
                    setIsProfileOpen(false);
                  }}
                  className="relative p-2.5 hover:bg-brand-primary-50 rounded-xl text-slate-600 hover:text-brand-primary transition-all w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center"
                  title="Notifications"
                >
                  <i className="fas fa-bell text-base"></i>
                  <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                {/* Notifications Dropdown */}
                {isNotificationsOpen && (
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
                    <div className="p-4 bg-gradient-to-r from-brand-primary-50 to-brand-secondary-50 border-b border-slate-100">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
                        <button className="text-xs font-semibold text-brand-primary hover:text-brand-primary-dark">Mark all read</button>
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      <div className="p-8 text-center text-slate-400">
                        <i className="fas fa-bell-slash text-2xl mb-2 opacity-20"></i>
                        <p className="text-xs font-semibold text-slate-600">No new notifications</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => {
                    setIsProfileOpen(!isProfileOpen);
                    setIsNotificationsOpen(false);
                  }}
                  className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-200"
                >
                  <div 
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md flex-shrink-0"
                    style={{
                      background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                    }}
                  >
                    {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div className="hidden lg:flex flex-col items-start min-w-0">
                    <span className="text-sm font-bold text-slate-900 truncate max-w-[200px]">
                      {user?.name || (user?.email ? user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'User')}
                    </span>
                    <span className="text-xs text-slate-500 font-medium truncate max-w-[200px]">{getRoleDisplayName(activeRole)}</span>
                  </div>
                  <i className={`fas fa-chevron-down text-xs text-slate-400 transition-transform flex-shrink-0 ${isProfileOpen ? 'rotate-180' : ''}`}></i>
                </button>

                {/* Profile Dropdown Menu */}
                {isProfileOpen && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50">
                    <div className="p-4 bg-gradient-to-r from-brand-primary-50 to-brand-secondary-50 border-b border-slate-100">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md"
                          style={{
                            background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                          }}
                        >
                          {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-900 truncate max-w-[180px]">
                            {user?.name || (user?.email ? user.email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'User')}
                          </p>
                          <p className="text-xs text-slate-500 font-medium truncate max-w-[180px]">{getRoleDisplayName(activeRole)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="py-2">
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          onPageChange('dashboard');
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-700"
                      >
                        <i className="fas fa-user-circle text-base text-slate-400 w-5"></i>
                        <span>My Profile</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsProfileOpen(false);
                          onPageChange('dashboard');
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm font-medium text-slate-700"
                      >
                        <i className="fas fa-cog text-base text-slate-400 w-5"></i>
                        <span>Settings</span>
                      </button>
                      <div className="h-px bg-slate-100 my-1"></div>
                      <button
                        onClick={async () => {
                          setIsProfileOpen(false);
                          try {
                            const result = await logout();
                            if (!result.success && result.error) {
                              console.error('Logout error:', result.error);
                              // Still proceed with logout even if there's an error
                            }
                            // The AuthContext will handle state updates and App.tsx will redirect to login
                          } catch (error) {
                            console.error('Logout failed:', error);
                            // Force logout by clearing state
                            logout();
                          }
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-red-50 transition-colors flex items-center gap-3 text-sm font-semibold text-red-600"
                      >
                        <i className="fas fa-sign-out-alt text-base w-5"></i>
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 xl:p-10 custom-scrollbar">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
