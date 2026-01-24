
import React, { useState, useMemo, useEffect } from 'react';
import { usePatients } from '../contexts/PatientContext';
import { useToast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { Appointment, AppointmentType, AppointmentPriority, PatientStatus, UserRole, InsuranceType } from '../types';
import { getProviders } from '../services/providerService';
import { useDebounce } from '../utils/debounce';
import { UI_TIMING } from '../constants';
import { formatDate, formatTime } from '../utils/dateTimeUtils';

interface AppointmentsProps {
  onOpenEMR?: (patientId: string) => void;
}

const Appointments: React.FC<AppointmentsProps> = ({ onOpenEMR }) => {
  const { patients, updatePatient } = usePatients();
  const { activeRole } = useAuth();
  const { success: showSuccess, error: showError } = useToast();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'queue' | 'appointments'>('queue');
  const debouncedSearchTerm = useDebounce(searchTerm, UI_TIMING.DEBOUNCE_DELAY);
  const [providers, setProviders] = useState<any[]>([]);
  
  const isOptometrist = activeRole === UserRole.OPTOMETRIST;

  // Load providers
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const providersList = await getProviders();
        setProviders(providersList);
      } catch (error) {
        console.error('Failed to load providers:', error);
        setProviders([]);
      }
    };
    loadProviders();
  }, []);

  // Get clinical queue for optometrists (patients waiting or in clinical)
  const clinicalQueue = useMemo(() => {
    if (!isOptometrist) return [];
    return patients
      .filter(p => p.status === PatientStatus.WAITING || p.status === PatientStatus.IN_CLINICAL)
      .sort((a, b) => {
        // Prioritize patients with appointments
        if (a.appointment && !b.appointment) return -1;
        if (!a.appointment && b.appointment) return 1;
        // Then prioritize IN_CLINICAL over WAITING
        if (a.status === PatientStatus.IN_CLINICAL && b.status === PatientStatus.WAITING) return -1;
        if (a.status === PatientStatus.WAITING && b.status === PatientStatus.IN_CLINICAL) return 1;
        return 0;
      });
  }, [patients, isOptometrist]);

  // Extract all appointments from patient records
  const allAppointments = useMemo(() => {
    const appointments: Array<Appointment & { patientName: string; patientPhone: string; patientId: string; patientStatus: PatientStatus }> = [];
    
    patients.forEach(patient => {
      if (patient.appointment) {
        appointments.push({
          ...patient.appointment,
          patientName: patient.name,
          patientPhone: patient.phone,
          patientId: patient.id,
          patientStatus: patient.status,
        });
      }
    });

    // Sort by date and time (upcoming first, then past)
    return appointments.sort((a, b) => {
      const dateA = new Date(`${a.appointmentDate}T${a.appointmentTime}`).getTime();
      const dateB = new Date(`${b.appointmentDate}T${b.appointmentTime}`).getTime();
      const now = Date.now();
      
      // Upcoming appointments first
      if (dateA > now && dateB <= now) return -1;
      if (dateA <= now && dateB > now) return 1;
      
      // Then sort by date (upcoming: earliest first, past: most recent first)
      if (dateA > now && dateB > now) return dateA - dateB;
      return dateB - dateA;
    });
  }, [patients]);

  // Filter appointments
  const filteredAppointments = useMemo(() => {
    let filtered = allAppointments;

    // Filter by status
    if (filterStatus !== 'ALL') {
      filtered = filtered.filter(apt => apt.status === filterStatus);
    }

    // Filter by appointment type
    if (filterType !== 'ALL') {
      filtered = filtered.filter(apt => apt.appointmentType === filterType);
    }

    // Filter by search term
    if (debouncedSearchTerm.trim()) {
      const search = debouncedSearchTerm.toLowerCase();
      filtered = filtered.filter(apt =>
        apt.patientName.toLowerCase().includes(search) ||
        apt.patientPhone.includes(search) ||
        apt.patientId.toLowerCase().includes(search) ||
        (apt.assignedDoctorId && providers.find(p => p.id === apt.assignedDoctorId)?.name.toLowerCase().includes(search))
      );
    }

    return filtered;
  }, [allAppointments, filterStatus, filterType, debouncedSearchTerm]);

  // Get appointment statistics
  const stats = useMemo(() => ({
    total: allAppointments.length,
    scheduled: allAppointments.filter(a => a.status === 'SCHEDULED').length,
    confirmed: allAppointments.filter(a => a.status === 'CONFIRMED').length,
    completed: allAppointments.filter(a => a.status === 'COMPLETED').length,
    cancelled: allAppointments.filter(a => a.status === 'CANCELLED').length,
  }), [allAppointments]);

  const getDoctorName = (doctorId?: string) => {
    if (!doctorId) return 'Auto Assigned';
    const doctor = providers.find(p => p.id === doctorId);
    return doctor ? doctor.name : 'Unknown';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SCHEDULED':
        return 'bg-orange-100 text-orange-700';
      case 'CONFIRMED':
        return 'bg-brand-primary-100 text-brand-primary-dark';
      case 'COMPLETED':
        return 'bg-green-100 text-green-700';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const getPriorityColor = (priority: AppointmentPriority) => {
    return priority === AppointmentPriority.EMERGENCY
      ? 'bg-red-100 text-red-700'
      : 'bg-slate-100 text-slate-600';
  };

  const handleStartAttending = async (patientId: string) => {
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    // Update status to IN_CLINICAL
    if (patient.status === PatientStatus.WAITING) {
      await updatePatient(patient.id, { status: PatientStatus.IN_CLINICAL });
      showSuccess(`Started attending ${patient.name}`);
    }

    // Open EMR if callback provided
    if (onOpenEMR) {
      onOpenEMR(patientId);
    }
  };

  // Optometrist View - Queue and Appointments
  if (isOptometrist) {
    const upcomingAppointments = allAppointments.filter(apt => {
      const aptDate = new Date(`${apt.appointmentDate}T${apt.appointmentTime}`).getTime();
      return aptDate > Date.now() && apt.status !== 'CANCELLED' && apt.status !== 'COMPLETED';
    });

    return (
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header with Toggle */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">Patient Queue & Appointments</h2>
              <p className="text-xs text-slate-500 font-medium mt-1">Manage your patient queue and scheduled appointments</p>
            </div>
            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('queue')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'queue'
                    ? 'text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                style={viewMode === 'queue' ? { backgroundColor: 'var(--brand-primary)' } : {}}
              >
                <i className="fas fa-list-ol mr-2"></i>
                Queue ({clinicalQueue.length})
              </button>
              <button
                onClick={() => setViewMode('appointments')}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'appointments'
                    ? 'text-white shadow-md'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                style={viewMode === 'appointments' ? { backgroundColor: 'var(--brand-primary)' } : {}}
              >
                <i className="fas fa-calendar-check mr-2"></i>
                Scheduled ({upcomingAppointments.length})
              </button>
            </div>
          </div>
        </div>

        {/* Queue View */}
        {viewMode === 'queue' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 mb-1">Clinical Queue</h3>
              <p className="text-xs text-slate-500 font-medium">Patients waiting for examination</p>
            </div>
            <div className="divide-y divide-slate-100">
              {clinicalQueue.length > 0 ? (
                clinicalQueue.map(patient => (
                  <div
                    key={patient.id}
                    className="p-6 hover:bg-slate-50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-4 flex-1">
                        <div 
                          className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${
                            patient.status === PatientStatus.IN_CLINICAL
                              ? 'text-white'
                              : 'bg-orange-100 text-orange-600'
                          }`}
                          style={patient.status === PatientStatus.IN_CLINICAL ? { backgroundColor: 'var(--brand-primary)' } : {}}
                        >
                          {patient.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-sm font-bold text-slate-900">{patient.name}</h4>
                            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                              patient.status === PatientStatus.IN_CLINICAL
                                ? 'bg-brand-primary-100 text-brand-primary-dark'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {patient.status === PatientStatus.IN_CLINICAL ? 'In Session' : 'Waiting'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                            <span className="font-mono">{patient.id}</span>
                            <span>•</span>
                            <span>{patient.gender}</span>
                            {patient.age && (
                              <>
                                <span>•</span>
                                <span>Age: {patient.age}</span>
                              </>
                            )}
                            <span>•</span>
                            <span className={`px-2 py-0.5 rounded font-semibold ${
                              patient.insuranceType === InsuranceType.NHIF
                                ? 'bg-brand-primary-100 text-brand-primary-dark'
                                : patient.insuranceType === InsuranceType.PRIVATE
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}>
                              {patient.insuranceType === InsuranceType.PRIVATE && patient.insuranceProvider 
                                ? patient.insuranceProvider 
                                : patient.insuranceType === InsuranceType.NHIF 
                                ? 'NHIF'
                                : patient.insuranceType}
                            </span>
                          </div>
                          {patient.appointment && (
                            <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                              <i className="fas fa-calendar-alt"></i>
                              <span>{patient.appointment.appointmentType}</span>
                              {patient.appointment.priority === AppointmentPriority.EMERGENCY && (
                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-bold">
                                  Emergency
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleStartAttending(patient.id)}
                        className="px-6 py-2.5 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
                        style={{
                          backgroundColor: 'var(--brand-primary)',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--brand-primary-dark)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
                        }}
                      >
                        <i className="fas fa-file-medical"></i>
                        Open EMR
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <i className="fas fa-user-slash text-4xl mb-3 opacity-20"></i>
                  <p className="text-sm font-semibold text-slate-600">No patients in queue</p>
                  <p className="text-xs text-slate-500 mt-1">Patients will appear here when registered</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scheduled Appointments View */}
        {viewMode === 'appointments' && (
          <>
            {/* Upcoming Appointments */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <h3 className="text-base font-bold text-slate-900 mb-1">Scheduled Appointments</h3>
                <p className="text-xs text-slate-500 font-medium">Upcoming appointments assigned to you</p>
              </div>
              <div className="divide-y divide-slate-100">
                {upcomingAppointments.length > 0 ? (
                  upcomingAppointments.map(appointment => {
                    const patient = patients.find(p => p.id === appointment.patientId);
                    return (
                      <div
                        key={appointment.id}
                        className="p-6 hover:bg-slate-50 transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            <div className="w-12 h-12 rounded-full bg-brand-primary-50 text-brand-primary flex items-center justify-center font-bold text-sm">
                              {appointment.patientName.charAt(0)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-sm font-bold text-slate-900">{appointment.patientName}</h4>
                                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${getStatusColor(appointment.status)}`}>
                                  {appointment.status}
                                </span>
                                {appointment.priority === AppointmentPriority.EMERGENCY && (
                                  <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded-full font-bold">
                                    Emergency
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1 text-xs text-slate-600">
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-calendar-alt w-4"></i>
                                  <span className="font-semibold">{appointment.appointmentType}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-clock w-4"></i>
                                  <span>{formatDate(appointment.appointmentDate)} at {formatTime(appointment.appointmentTime)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <i className="fas fa-id-card w-4"></i>
                                  <span className="font-mono">{appointment.patientId}</span>
                                  {patient && (
                                    <>
                                      <span>•</span>
                                      <span>{patient.phone}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => handleStartAttending(appointment.patientId)}
                            className="px-6 py-2.5 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
                            style={{
                              backgroundColor: 'var(--brand-primary)',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--brand-primary-dark)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'var(--brand-primary)';
                            }}
                          >
                            <i className="fas fa-file-medical"></i>
                            Open EMR
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-12 text-center text-slate-400">
                    <i className="fas fa-calendar-times text-4xl mb-3 opacity-20"></i>
                    <p className="text-sm font-semibold text-slate-600">No upcoming appointments</p>
                    <p className="text-xs text-slate-500 mt-1">Scheduled appointments will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // Receptionist/Admin View - Appointment History
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with Stats */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Appointment History</h2>
            <p className="text-xs text-slate-500 font-medium mt-1">View and manage all patient appointments</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-initial">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input
                type="text"
                placeholder="Search appointments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full sm:w-64 pl-11 pr-4 h-12 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all font-medium"
              />
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <p className="text-xs font-semibold text-slate-500 mb-1">Total</p>
            <p className="text-base font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
            <p className="text-xs font-semibold text-orange-600 mb-1">Scheduled</p>
            <p className="text-base font-bold text-orange-700">{stats.scheduled}</p>
          </div>
          <div className="bg-brand-primary-50 p-4 rounded-xl border border-brand-primary-100">
            <p className="text-xs font-semibold text-blue-600 mb-1">Confirmed</p>
            <p className="text-base font-bold text-brand-primary-dark">{stats.confirmed}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-xl border border-green-200">
            <p className="text-xs font-semibold text-green-600 mb-1">Completed</p>
            <p className="text-base font-bold text-green-700">{stats.completed}</p>
          </div>
          <div className="bg-red-50 p-4 rounded-xl border border-red-200">
            <p className="text-xs font-semibold text-red-600 mb-1">Cancelled</p>
            <p className="text-base font-bold text-red-700">{stats.cancelled}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
            >
              <option value="ALL">All Status</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-600">Type:</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-10 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
            >
              <option value="ALL">All Types</option>
              {Object.values(AppointmentType).map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Appointments Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Patient</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Appointment</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Date & Time</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Assigned Doctor</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Priority</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Status</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-600 uppercase tracking-wide">Department</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAppointments.length > 0 ? (
                filteredAppointments.map(appointment => (
                  <tr key={appointment.id} className="hover:bg-slate-50/50 transition-all">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{appointment.patientName}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{appointment.patientPhone}</p>
                        <p className="text-xs text-slate-400 mt-0.5">ID: {appointment.patientId}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-700">{appointment.appointmentType}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-700">
                        {formatDate(appointment.appointmentDate)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatTime(appointment.appointmentTime)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-slate-700">
                        {getDoctorName(appointment.assignedDoctorId)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getPriorityColor(appointment.priority)}`}>
                        {appointment.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getStatusColor(appointment.status)}`}>
                        {appointment.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs px-3 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold">
                        {appointment.assignedDepartment || 'N/A'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center text-slate-400 bg-white">
                    <i className="fas fa-calendar-times text-5xl mb-4 opacity-20"></i>
                    <p className="text-sm font-semibold text-slate-600">No appointments found</p>
                    {searchTerm && (
                      <p className="text-xs text-slate-500 mt-1">Try adjusting your search or filters</p>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        {filteredAppointments.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
            <p className="text-sm font-medium text-slate-600">
              Showing <span className="font-semibold">{filteredAppointments.length}</span> of <span className="font-semibold">{allAppointments.length}</span> appointments
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Appointments;
