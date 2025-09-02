import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'wouter';
import { 
  Calendar, 
  Check, 
  Filter, 
  Clock,
  Users,
  DollarSign,
  Save,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  Download,
  Upload,
  Eye,
  EyeOff,
  History,
  BarChart3
} from 'lucide-react';
import { db } from '../../lib/firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  query,
  where,
  orderBy 
} from 'firebase/firestore';

// Interfaces
interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  hourlyRate: number;
  status: 'Active' | 'Inactive' | 'On Leave' | 'Fired' | 'Resigned';
}

interface WorkSchedule {
  id?: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  hoursWorked: number;
  salary: number;
  status: 'present' | 'absent' | 'late' | 'overtime';
  notes?: string;
  checked: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

const Horaires: React.FC = () => {
  // State management
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'pending'>('all');
  const [showCheckedOnly, setShowCheckedOnly] = useState(false);
  
  // UI state
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [pendingTimes, setPendingTimes] = useState<{[key: string]: {startTime?: string, endTime?: string}}>({});
  const [timeoutRefs, setTimeoutRefs] = useState<{[key: string]: NodeJS.Timeout}>({});

  // Debounced save function for time inputs
  const debouncedSaveTime = useCallback((employeeId: string, field: 'startTime' | 'endTime', value: string) => {
    // Clear existing timeout for this field
    const key = `${employeeId}-${field}`;
    if (timeoutRefs[key]) {
      clearTimeout(timeoutRefs[key]);
    }

    // Set new timeout
    const newTimeout = setTimeout(async () => {
      console.log(`⏱️ Debounced save: ${field} = ${value} for employee ${employeeId}`);
      await updateScheduleField(employeeId, field, value);
      
      // Clear pending time after save
      setPendingTimes(prev => {
        const updated = { ...prev };
        if (updated[employeeId]) {
          delete updated[employeeId][field];
          if (Object.keys(updated[employeeId]).length === 0) {
            delete updated[employeeId];
          }
        }
        return updated;
      });
    }, 1000); // 1 second delay

    setTimeoutRefs(prev => ({ ...prev, [key]: newTimeout }));
  }, [timeoutRefs]);

  // Firebase real-time listeners
  useEffect(() => {
    // Listen to employees
    const unsubscribeEmployees = onSnapshot(
      query(collection(db, 'personnel'), where('status', '==', 'Active')),
      (snapshot) => {
        const employeesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Employee[];
        setEmployees(employeesData);
        setLoading(false);
      }
    );

    return () => unsubscribeEmployees();
  }, []);

  // Listen to schedules for selected date
  useEffect(() => {
    if (!selectedDate) return;

    const unsubscribeSchedules = onSnapshot(
      query(
        collection(db, 'work_schedules'),
        where('date', '==', selectedDate),
        orderBy('createdAt', 'desc')
      ),
      (snapshot) => {
        const schedulesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WorkSchedule[];
        setSchedules(schedulesData);
      }
    );

    return () => unsubscribeSchedules();
  }, [selectedDate]);

  // Helper functions
  const calculateHoursAndSalary = (startTime: string, endTime: string, hourlyRate: number) => {
    if (!startTime || !endTime) return { hours: 0, salary: 0 };
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    let hours = endHour - startHour;
    let minutes = endMin - startMin;
    
    if (minutes < 0) {
      hours--;
      minutes += 60;
    }
    
    const totalHours = hours + (minutes / 60);
    const salary = Math.round(totalHours * hourlyRate);
    
    return { hours: Number(totalHours.toFixed(2)), salary };
  };

  const getWorkStatus = (hours: number): 'present' | 'late' | 'overtime' => {
    if (hours >= 8) return 'overtime';
    if (hours >= 6) return 'present';
    return 'late';
  };

  // Schedule management
  const saveSchedule = async (employeeId: string, scheduleData: Partial<WorkSchedule>) => {
    setSaving(true);
    try {
      const existingSchedule = schedules.find(s => s.employeeId === employeeId);
      
      if (existingSchedule?.id) {
        // Update existing schedule
        await updateDoc(doc(db, 'work_schedules', existingSchedule.id), {
          ...scheduleData,
          date: selectedDate, // Ensure date is always set
          updatedAt: serverTimestamp()
        });
        console.log(`Updated schedule for employee ${employeeId} on ${selectedDate}`);
      } else {
        // Create new schedule
        const newScheduleData = {
          employeeId,
          date: selectedDate,
          startTime: '',
          endTime: '',
          hoursWorked: 0,
          salary: 0,
          status: 'absent' as const,
          notes: '',
          checked: false,
          ...scheduleData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        
        await addDoc(collection(db, 'work_schedules'), newScheduleData);
        console.log(`Created new schedule for employee ${employeeId} on ${selectedDate}`);
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      alert('Error saving schedule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const updateScheduleField = async (employeeId: string, field: keyof WorkSchedule, value: any) => {
    console.log(`🔄 Updating ${field} for employee ${employeeId} with value: ${value}`);
    
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) {
      console.error('❌ Employee not found:', employeeId);
      alert('Employee not found!');
      return;
    }

    // Set saving state
    setSaving(true);

    try {
      const existingSchedule = schedules.find(s => s.employeeId === employeeId);
      let updatedSchedule: Partial<WorkSchedule> = {
        [field]: value
      };

      // Recalculate if time changes
      if (field === 'startTime' || field === 'endTime') {
        const startTime = field === 'startTime' ? value : existingSchedule?.startTime || '';
        const endTime = field === 'endTime' ? value : existingSchedule?.endTime || '';
        
        console.log(`⏰ Times: start=${startTime}, end=${endTime}`);
        
        if (startTime && endTime) {
          const { hours, salary } = calculateHoursAndSalary(startTime, endTime, employee.hourlyRate || 15);
          updatedSchedule = {
            ...updatedSchedule,
            hoursWorked: hours,
            salary,
            status: getWorkStatus(hours)
          };
          
          console.log(`💰 Calculated: ${hours}h worked, ${salary} MAD salary`);
        }
      }

      await saveSchedule(employeeId, updatedSchedule);
      console.log(`✅ Successfully saved ${field} for employee ${employeeId}`);
      
      // Show success feedback
      if (field === 'startTime' || field === 'endTime') {
        console.log(`🎉 ${field} saved successfully!`);
      }
      
    } catch (error) {
      console.error(`❌ Error saving ${field} for employee ${employeeId}:`, error);
      alert(`Error saving ${field}. Please try again.`);
    } finally {
      setSaving(false);
    }
  };

  // Bulk save all schedules for the day
  const saveAllSchedules = async () => {
    setSaving(true);
    try {
      const promises = employees.map(async (employee) => {
        const schedule = schedules.find(s => s.employeeId === employee.id);
        if (schedule && schedule.startTime && schedule.endTime) {
          await saveSchedule(employee.id, { checked: true });
        }
      });
      
      await Promise.all(promises);
      alert(`Successfully saved schedules for ${selectedDate}`);
    } catch (error) {
      console.error('Error saving all schedules:', error);
      alert('Error saving schedules. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Test function to manually save a schedule
  const testSaveSchedule = async (employeeId: string) => {
    console.log('Testing schedule save for employee:', employeeId);
    try {
      await saveSchedule(employeeId, {
        startTime: '08:00',
        endTime: '17:00',
        hoursWorked: 9,
        salary: 135,
        status: 'overtime',
        checked: false
      });
      console.log('Test save successful');
      alert('Test save successful!');
    } catch (error) {
      console.error('Test save failed:', error);
      alert('Test save failed: ' + error);
    }
  };

  const toggleEmployeeCheck = async (employeeId: string) => {
    const existingSchedule = schedules.find(s => s.employeeId === employeeId);
    
    // Ensure start and end times are filled before checking
    if (!existingSchedule?.startTime || !existingSchedule?.endTime) {
      alert('Please fill in both start and end times before checking in.');
      return;
    }
    
    await updateScheduleField(employeeId, 'checked', !existingSchedule?.checked);
  };

  // Filtered data
  const filteredEmployees = useMemo(() => {
    return employees.filter(employee => {
      const fullName = `${employee.firstName} ${employee.lastName}`.toLowerCase();
      const matchesSearch = fullName.includes(searchTerm.toLowerCase()) ||
                           employee.position.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDepartment = !departmentFilter || employee.department === departmentFilter;
      
      const schedule = schedules.find(s => s.employeeId === employee.id);
      let matchesStatus = true;
      
      if (statusFilter === 'present') matchesStatus = schedule?.checked === true;
      if (statusFilter === 'absent') matchesStatus = schedule?.checked === false || !schedule;
      if (statusFilter === 'pending') matchesStatus = !schedule?.checked && !!schedule?.startTime;
      
      const matchesCheckedFilter = !showCheckedOnly || schedule?.checked;
      
      return matchesSearch && matchesDepartment && matchesStatus && matchesCheckedFilter;
    });
  }, [employees, schedules, searchTerm, departmentFilter, statusFilter, showCheckedOnly]);

  // Statistics
  const stats = useMemo(() => {
    const presentEmployees = schedules.filter(s => s.checked);
    const totalSalary = presentEmployees.reduce((sum, s) => sum + (s.salary || 0), 0);
    const totalHours = presentEmployees.reduce((sum, s) => sum + (s.hoursWorked || 0), 0);
    const overtimeEmployees = presentEmployees.filter(s => (s.hoursWorked || 0) >= 8).length;
    
    return {
      totalEmployees: employees.length,
      presentEmployees: presentEmployees.length,
      absentEmployees: employees.length - presentEmployees.length,
      totalSalary,
      totalHours: Number(totalHours.toFixed(2)),
      overtimeEmployees
    };
  }, [employees, schedules]);

  const departments = Array.from(new Set(employees.map(e => e.department)));

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Debug Panel (Development only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 mb-6">
            <h3 className="font-semibold text-yellow-800 mb-2">🔧 Debug Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>Firebase Connection:</strong><br/>
                Employees loaded: {employees.length}<br/>
                Schedules loaded: {schedules.length}<br/>
                Selected date: {selectedDate}
              </div>
              <div>
                <strong>UI State:</strong><br/>
                Loading: {loading ? 'Yes' : 'No'}<br/>
                Saving: {saving ? 'Yes' : 'No'}<br/>
                Search term: "{searchTerm}"
              </div>
              <div>
                <strong>Filters:</strong><br/>
                Department: {departmentFilter || 'All'}<br/>
                Status: {statusFilter}<br/>
                Show checked only: {showCheckedOnly ? 'Yes' : 'No'}
              </div>
            </div>
            <div className="mt-3 p-2 bg-white rounded border">
              <strong>Recent Schedules:</strong><br/>
              {schedules.slice(0, 3).map(s => (
                <div key={s.id} className="text-xs">
                  Employee: {s.employeeId.substring(0, 8)}... | Start: {s.startTime || 'None'} | End: {s.endTime || 'None'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-3 rounded-full">
                <Clock className="text-white w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Work Schedules</h1>
                <p className="text-gray-600">Employee time tracking and attendance management</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Today</p>
              <p className="text-2xl font-bold text-blue-600">{new Date().toLocaleDateString()}</p>
            </div>
            <Link href="/work-hours-history">
              <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold transition-colors">
                <History className="w-5 h-5" />
                <span>View Work History</span>
              </button>
            </Link>
          </div>

          {/* Controls Row */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            {/* Date Picker */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Work Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Search */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Employees</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Name or position..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Department Filter */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Status</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          {/* Toggle Options */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowCheckedOnly(!showCheckedOnly)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  showCheckedOnly 
                    ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                    : 'bg-gray-100 text-gray-600 border border-gray-300'
                }`}
              >
                {showCheckedOnly ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="text-sm">Show Checked Only</span>
              </button>
            </div>
            
            {/* Bulk Actions */}
            <div className="flex gap-2">
              <button
                onClick={saveAllSchedules}
                disabled={saving || schedules.filter(s => s.startTime && s.endTime && !s.checked).length === 0}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                  saving || schedules.filter(s => s.startTime && s.endTime && !s.checked).length === 0
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-green-500 hover:bg-green-600 text-white'
                }`}
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span className="text-sm">Save All ({schedules.filter(s => s.startTime && s.endTime && !s.checked).length})</span>
              </button>
              
              <button
                onClick={() => {
                  const csvData = schedules
                    .filter(s => s.checked)
                    .map(s => {
                      const employee = employees.find(e => e.id === s.employeeId);
                      return `${employee?.firstName} ${employee?.lastName},${s.date},${s.startTime},${s.endTime},${s.hoursWorked},${s.salary}`;
                    })
                    .join('\n');
                  const header = 'Employee,Date,Start Time,End Time,Hours Worked,Salary (MAD)\n';
                  const blob = new Blob([header + csvData], { type: 'text/csv' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `work-schedules-${selectedDate}.csv`;
                  a.click();
                }}
                disabled={schedules.filter(s => s.checked).length === 0}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-colors ${
                  schedules.filter(s => s.checked).length === 0
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <Download className="w-4 h-4" />
                <span className="text-sm">Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
            <div className="flex items-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Present</h3>
                <p className="text-3xl font-bold text-green-600">{stats.presentEmployees}</p>
                <p className="text-sm text-gray-500">of {stats.totalEmployees} employees</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-red-500">
            <div className="flex items-center">
              <XCircle className="w-8 h-8 text-red-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Absent</h3>
                <p className="text-3xl font-bold text-red-600">{stats.absentEmployees}</p>
                <p className="text-sm text-gray-500">not checked in</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Total Hours</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.totalHours}</p>
                <p className="text-sm text-gray-500">hours worked</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-yellow-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Total Pay</h3>
                <p className="text-3xl font-bold text-yellow-600">{stats.totalSalary} MAD</p>
                <p className="text-sm text-gray-500">daily payment</p>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Cards */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-lg text-gray-600">Loading employees...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredEmployees.map(employee => {
              const schedule = schedules.find(s => s.employeeId === employee.id);
              const isExpanded = expandedCard === employee.id;
              
              return (
                <div key={employee.id} className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <div className="p-6">
                    {/* Employee Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                          schedule?.checked ? 'bg-green-500' : 'bg-gray-400'
                        }`}>
                          {employee.firstName.charAt(0)}{employee.lastName.charAt(0)}
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-800">
                            {employee.firstName} {employee.lastName}
                          </h3>
                          <p className="text-sm text-gray-600">{employee.position} • {employee.department}</p>
                          <p className="text-xs text-gray-500">{employee.hourlyRate || 15} MAD/hour</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedCard(isExpanded ? null : employee.id)}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Time Inputs */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Start Time
                          {(schedule?.startTime || pendingTimes[employee.id]?.startTime) && (
                            <span className="ml-2 text-xs text-green-600">
                              {pendingTimes[employee.id]?.startTime ? '⏳ Saving...' : '✓ Saved'}
                            </span>
                          )}
                        </label>
                        <input
                          type="time"
                          value={pendingTimes[employee.id]?.startTime ?? schedule?.startTime ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            console.log('🕐 Start time input changed:', value);
                            
                            // Update pending state immediately for UI feedback
                            setPendingTimes(prev => ({
                              ...prev,
                              [employee.id]: {
                                ...prev[employee.id],
                                startTime: value
                              }
                            }));
                            
                            // Debounced save to Firebase
                            if (value) {
                              debouncedSaveTime(employee.id, 'startTime', value);
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                            (schedule?.startTime || pendingTimes[employee.id]?.startTime)
                              ? 'border-green-300 bg-green-50' 
                              : 'border-gray-300'
                          }`}
                          placeholder="--:--"
                        />
                        {(schedule?.startTime || pendingTimes[employee.id]?.startTime) && (
                          <p className="text-xs text-green-600 mt-1">
                            Start time: {pendingTimes[employee.id]?.startTime || schedule?.startTime}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          End Time
                          {(schedule?.endTime || pendingTimes[employee.id]?.endTime) && (
                            <span className="ml-2 text-xs text-green-600">
                              {pendingTimes[employee.id]?.endTime ? '⏳ Saving...' : '✓ Saved'}
                            </span>
                          )}
                        </label>
                        <input
                          type="time"
                          value={pendingTimes[employee.id]?.endTime ?? schedule?.endTime ?? ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            console.log('🕐 End time input changed:', value);
                            
                            // Update pending state immediately for UI feedback
                            setPendingTimes(prev => ({
                              ...prev,
                              [employee.id]: {
                                ...prev[employee.id],
                                endTime: value
                              }
                            }));
                            
                            // Debounced save to Firebase
                            if (value) {
                              debouncedSaveTime(employee.id, 'endTime', value);
                            }
                          }}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                            (schedule?.endTime || pendingTimes[employee.id]?.endTime)
                              ? 'border-green-300 bg-green-50' 
                              : 'border-gray-300'
                          }`}
                          placeholder="--:--"
                        />
                        {(schedule?.endTime || pendingTimes[employee.id]?.endTime) && (
                          <p className="text-xs text-green-600 mt-1">
                            End time: {pendingTimes[employee.id]?.endTime || schedule?.endTime}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Debug Information */}
                    {process.env.NODE_ENV === 'development' && (
                      <div className="bg-gray-100 p-2 rounded text-xs mb-4">
                        <strong>Debug Info:</strong><br/>
                        Employee ID: {employee.id}<br/>
                        Schedule ID: {schedule?.id || 'Not created yet'}<br/>
                        Start Time: {schedule?.startTime || 'Not set'}<br/>
                        End Time: {schedule?.endTime || 'Not set'}<br/>
                        Hours: {schedule?.hoursWorked || 0}<br/>
                        Salary: {schedule?.salary || 0} MAD
                      </div>
                    )}

                    {/* Auto-save notification */}
                    {schedule?.startTime && schedule?.endTime && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                        <div className="flex items-center space-x-2">
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-green-800 font-medium">
                            Work hours automatically saved for {selectedDate}
                          </span>
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          {schedule.startTime} - {schedule.endTime} ({schedule.hoursWorked}h worked, {schedule.salary} MAD)
                        </div>
                      </div>
                    )}

                    {/* Status and Summary */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col space-y-1">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-600">
                            {schedule?.hoursWorked ? `${schedule.hoursWorked}h worked` : 'No time logged'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span className="text-sm font-semibold text-green-600">
                            {schedule?.salary || 0} MAD
                          </span>
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      {schedule?.status && (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          schedule.status === 'present' ? 'bg-green-100 text-green-800' :
                          schedule.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                          schedule.status === 'overtime' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1)}
                        </span>
                      )}
                    </div>

                    {/* Expanded Content */}
                    {isExpanded && (
                      <div className="border-t pt-4 mt-4">
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                          <textarea
                            value={schedule?.notes || ''}
                            onChange={(e) => updateScheduleField(employee.id, 'notes', e.target.value)}
                            placeholder="Add notes about this work day..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="space-y-2">
                      {/* Test Button (Development only) */}
                      {process.env.NODE_ENV === 'development' && (
                        <button
                          onClick={() => testSaveSchedule(employee.id)}
                          className="w-full py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition-colors text-sm"
                        >
                          🧪 Test Save (Dev Only)
                        </button>
                      )}
                      
                      {/* Main Check In Button */}
                      <button
                        onClick={() => toggleEmployeeCheck(employee.id)}
                        disabled={saving || !schedule?.startTime || !schedule?.endTime}
                        className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center space-x-2 ${
                          schedule?.checked
                            ? 'bg-green-500 hover:bg-green-600 text-white'
                            : schedule?.startTime && schedule?.endTime
                            ? 'bg-blue-500 hover:bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        {saving ? (
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        ) : (
                          <>
                            {schedule?.checked ? (
                              <CheckCircle2 className="w-5 h-5" />
                            ) : (
                              <Save className="w-5 h-5" />
                            )}
                            <span>
                              {schedule?.checked ? 'Checked In' : 'Check In'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredEmployees.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">No employees found</h3>
            <p className="text-gray-500">Try adjusting your search or filter criteria</p>
          </div>
        )}

        {/* Daily Summary Report */}
        {schedules.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Daily Work Summary - {selectedDate}</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Attendance Summary */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Attendance Overview</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Employees:</span>
                    <span className="font-semibold text-gray-800">{stats.totalEmployees}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Present Today:</span>
                    <span className="font-semibold text-green-600">{stats.presentEmployees}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Absent Today:</span>
                    <span className="font-semibold text-red-600">{stats.absentEmployees}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Overtime Workers:</span>
                    <span className="font-semibold text-blue-600">{stats.overtimeEmployees}</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-gray-600">Attendance Rate:</span>
                    <span className="font-semibold text-purple-600">
                      {stats.totalEmployees > 0 ? Math.round((stats.presentEmployees / stats.totalEmployees) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Financial Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Hours Worked:</span>
                    <span className="font-semibold text-gray-800">{stats.totalHours}h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Regular Hours:</span>
                    <span className="font-semibold text-blue-600">
                      {schedules.filter(s => s.checked && (s.hoursWorked || 0) <= 8).reduce((sum, s) => sum + (s.hoursWorked || 0), 0).toFixed(2)}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Overtime Hours:</span>
                    <span className="font-semibold text-orange-600">
                      {schedules.filter(s => s.checked && (s.hoursWorked || 0) > 8).reduce((sum, s) => sum + Math.max(0, (s.hoursWorked || 0) - 8), 0).toFixed(2)}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-gray-600 font-medium">Total Daily Pay:</span>
                    <span className="font-bold text-green-600 text-lg">{stats.totalSalary} MAD</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Average Pay/Employee:</span>
                    <span className="font-semibold text-gray-800">
                      {stats.presentEmployees > 0 ? Math.round(stats.totalSalary / stats.presentEmployees) : 0} MAD
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Individual Employee Details */}
            {schedules.filter(s => s.checked).length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-4">Employee Work Details</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-semibold text-gray-700">Employee</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Department</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Start Time</th>
                        <th className="text-left p-3 font-semibold text-gray-700">End Time</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Hours</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Status</th>
                        <th className="text-right p-3 font-semibold text-gray-700">Pay (MAD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {schedules
                        .filter(s => s.checked)
                        .map(schedule => {
                          const employee = employees.find(e => e.id === schedule.employeeId);
                          return (
                            <tr key={schedule.id} className="border-b hover:bg-gray-50">
                              <td className="p-3 font-medium">{employee?.firstName} {employee?.lastName}</td>
                              <td className="p-3 text-gray-600">{employee?.department}</td>
                              <td className="p-3">{schedule.startTime}</td>
                              <td className="p-3">{schedule.endTime}</td>
                              <td className="p-3 font-semibold">{schedule.hoursWorked}h</td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  schedule.status === 'present' ? 'bg-green-100 text-green-800' :
                                  schedule.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                  schedule.status === 'overtime' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {schedule.status}
                                </span>
                              </td>
                              <td className="p-3 text-right font-semibold text-green-600">{schedule.salary}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Horaires;