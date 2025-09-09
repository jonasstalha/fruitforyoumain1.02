import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'wouter';
import { 
  Calendar, 
  Clock,
  Users,
  DollarSign,
  Save,
  Search,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  History,
  Coffee,
  Settings
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
  entryTime: string;
  exitTime: string;
  pauseDuration: number; // in minutes
  machineCollapseDuration: number; // in minutes
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

  // Firebase real-time listeners
  useEffect(() => {
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

  // Improved calculation function
  const calculateHoursAndSalary = (entryTime: string, exitTime: string, hourlyRate: number, pauseDuration = 0, machineCollapseDuration = 0) => {
    if (!entryTime || !exitTime) return { hours: 0, salary: 0 };

    const [entryHour, entryMin] = entryTime.split(':').map(Number);
    const [exitHour, exitMin] = exitTime.split(':').map(Number);

    // Calculate total minutes worked
    let totalMinutes = (exitHour * 60 + exitMin) - (entryHour * 60 + entryMin);
    
    // Handle next day scenarios
    if (totalMinutes < 0) {
      totalMinutes += 24 * 60; // Add 24 hours in minutes
    }

    // Subtract pause duration
    const workMinutes = totalMinutes - pauseDuration;
    const totalHours = Math.max(0, workMinutes / 60);

    // Calculate salary
    // Machine collapse hours are paid at half rate
    const machineCollapseHours = Math.min(machineCollapseDuration / 60, totalHours);
    const normalHours = totalHours - machineCollapseHours;
    
    const salary = Math.round((normalHours * hourlyRate) + (machineCollapseHours * (hourlyRate / 2)));

    return { 
      hours: Number(totalHours.toFixed(2)), 
      salary: Math.max(0, salary)
    };
  };

  const getWorkStatus = (hours: number): 'present' | 'late' | 'overtime' => {
    if (hours >= 8) return 'overtime';
    if (hours >= 6) return 'present';
    return 'late';
  };

  // Schedule management
  const updateScheduleField = async (employeeId: string, field: keyof WorkSchedule, value: any) => {
    const employee = employees.find(e => e.id === employeeId);
    if (!employee) return;

    setSaving(true);

    try {
      const existingSchedule = schedules.find(s => s.employeeId === employeeId);
      let updatedSchedule: Partial<WorkSchedule> = { [field]: value };

      // Recalculate when any time-related field changes
      if (['entryTime', 'exitTime', 'pauseDuration', 'machineCollapseDuration'].includes(field)) {
        const entryTime = field === 'entryTime' ? value : existingSchedule?.entryTime || '';
        const exitTime = field === 'exitTime' ? value : existingSchedule?.exitTime || '';
        const pauseDuration = field === 'pauseDuration' ? value : existingSchedule?.pauseDuration || 0;
        const machineCollapseDuration = field === 'machineCollapseDuration' ? value : existingSchedule?.machineCollapseDuration || 0;
        
        if (entryTime && exitTime) {
          const { hours, salary } = calculateHoursAndSalary(
            entryTime, 
            exitTime, 
            employee.hourlyRate || 12, 
            pauseDuration, 
            machineCollapseDuration
          );
          
          updatedSchedule = {
            ...updatedSchedule,
            hoursWorked: hours,
            salary,
            status: getWorkStatus(hours)
          };
        }
      }

      if (existingSchedule?.id) {
        await updateDoc(doc(db, 'work_schedules', existingSchedule.id), {
          ...updatedSchedule,
          updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'work_schedules'), {
          employeeId,
          date: selectedDate,
          entryTime: '',
          exitTime: '',
          pauseDuration: 0,
          machineCollapseDuration: 0,
          hoursWorked: 0,
          salary: 0,
          status: 'absent' as const,
          notes: '',
          checked: false,
          ...updatedSchedule,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error updating schedule:', error);
      alert('Error saving data. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEmployeeCheck = async (employeeId: string) => {
    const existingSchedule = schedules.find(s => s.employeeId === employeeId);

    if (!existingSchedule?.entryTime || !existingSchedule?.exitTime) {
      alert('Please fill in entry and exit times before checking in.');
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
      if (statusFilter === 'pending') matchesStatus = !schedule?.checked && !!schedule?.entryTime;
      
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

  // Format time for display
  const formatTime = (time: string) => {
    if (!time) return '--:--';
    return time;
  };

  // Calculate total working time display
  const getWorkingTimeDisplay = (schedule: WorkSchedule) => {
    if (!schedule.entryTime || !schedule.exitTime) return '';
    
    const pauseDisplay = schedule.pauseDuration > 0 ? ` (Pause: ${schedule.pauseDuration}min)` : '';
    const machineDisplay = schedule.machineCollapseDuration > 0 ? ` (Machine: ${Math.round(schedule.machineCollapseDuration)}min@50%)` : '';
    
    return `${formatTime(schedule.entryTime)} - ${formatTime(schedule.exitTime)}${pauseDisplay}${machineDisplay}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-3 rounded-full">
                <Clock className="text-white w-8 h-8" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">Pointage des Employés</h1>
                <p className="text-gray-600">Gestion du temps et présence</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Aujourd'hui</p>
                <p className="text-2xl font-bold text-blue-600">{new Date().toLocaleDateString('fr-FR')}</p>
              </div>
              <Link href="/work-hours-history">
                <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-semibold transition-colors">
                  <History className="w-5 h-5" />
                  <span>Historique</span>
                </button>
              </Link>
            </div>
          </div>

          {/* Controls Row */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date de travail</label>
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

            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Nom ou poste..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Département</label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tous les départements</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Statut</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les statuts</option>
                <option value="present">Présents</option>
                <option value="absent">Absents</option>
                <option value="pending">En attente</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center justify-between">
            <button
              onClick={() => setShowCheckedOnly(!showCheckedOnly)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                showCheckedOnly 
                  ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                  : 'bg-gray-100 text-gray-600 border border-gray-300'
              }`}
            >
              {showCheckedOnly ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              <span className="text-sm">Afficher pointés uniquement</span>
            </button>
            
            <button
              onClick={() => {
                const csvData = schedules
                  .filter(s => s.checked)
                  .map(s => {
                    const employee = employees.find(e => e.id === s.employeeId);
                    return `${employee?.firstName} ${employee?.lastName},${s.date},${s.entryTime},${s.exitTime},${s.pauseDuration},${s.machineCollapseDuration},${s.hoursWorked},${s.salary}`;
                  })
                  .join('\n');
                const header = 'Employé,Date,Entrée,Sortie,Pause (min),Machine Arrêtée (min),Heures,Salaire (MAD)\n';
                const blob = new Blob([header + csvData], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `pointage-${selectedDate}.csv`;
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
              <span className="text-sm">Exporter CSV</span>
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
            <div className="flex items-center">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Présents</h3>
                <p className="text-3xl font-bold text-green-600">{stats.presentEmployees}</p>
                <p className="text-sm text-gray-500">sur {stats.totalEmployees} employés</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-red-500">
            <div className="flex items-center">
              <XCircle className="w-8 h-8 text-red-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Absents</h3>
                <p className="text-3xl font-bold text-red-600">{stats.absentEmployees}</p>
                <p className="text-sm text-gray-500">non pointés</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-blue-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Heures Total</h3>
                <p className="text-3xl font-bold text-blue-600">{stats.totalHours}</p>
                <p className="text-sm text-gray-500">heures travaillées</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500">
            <div className="flex items-center">
              <DollarSign className="w-8 h-8 text-yellow-500" />
              <div className="ml-4">
                <h3 className="text-lg font-semibold text-gray-800">Salaire Total</h3>
                <p className="text-3xl font-bold text-yellow-600">{stats.totalSalary} MAD</p>
                <p className="text-sm text-gray-500">paiement journalier</p>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Cards */}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <span className="ml-4 text-lg text-gray-600">Chargement des employés...</span>
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
                    <div className="flex items-center justify-between mb-6">
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
                          <p className="text-xs text-gray-500">{employee.hourlyRate || 12} MAD/heure</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedCard(isExpanded ? null : employee.id)}
                        className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                      >
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Main Time Inputs - Simplified Layout */}
                    <div className="space-y-4 mb-6">
                      {/* Entry and Exit Times */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Heure d'entrée
                          </label>
                          <input
                            type="time"
                            value={schedule?.entryTime || ''}
                            onChange={(e) => updateScheduleField(employee.id, 'entryTime', e.target.value)}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                            placeholder="--:--"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Heure de sortie
                          </label>
                          <input
                            type="time"
                            value={schedule?.exitTime || ''}
                            onChange={(e) => updateScheduleField(employee.id, 'exitTime', e.target.value)}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                            placeholder="--:--"
                          />
                        </div>
                      </div>

                      {/* Pause and Machine Collapse */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <Coffee className="w-4 h-4 mr-1" />
                            Durée pause (minutes)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={schedule?.pauseDuration || ''}
                            onChange={(e) => updateScheduleField(employee.id, 'pauseDuration', Number(e.target.value) || 0)}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center">
                            <Settings className="w-4 h-4 mr-1" />
                            Machine arrêtée (minutes)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={schedule?.machineCollapseDuration || ''}
                            onChange={(e) => updateScheduleField(employee.id, 'machineCollapseDuration', Number(e.target.value) || 0)}
                            className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
                            placeholder="0"
                          />
                          <p className="text-xs text-gray-500 mt-1">Payé à 50%</p>
                        </div>
                      </div>
                    </div>

                    {/* Work Summary Display */}
                    {schedule?.entryTime && schedule?.exitTime && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-600">Temps de travail:</p>
                            <p className="font-semibold text-gray-800">{getWorkingTimeDisplay(schedule)}</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-600">Total:</p>
                            <div className="flex items-center space-x-4">
                              <span className="font-semibold text-blue-600">{schedule.hoursWorked}h</span>
                              <span className="font-bold text-green-600">{schedule.salary} MAD</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-600">
                          {schedule?.hoursWorked ? `${schedule.hoursWorked}h travaillées` : 'Pas de temps enregistré'}
                        </span>
                      </div>
                      
                      {schedule?.status && (
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          schedule.status === 'present' ? 'bg-green-100 text-green-800' :
                          schedule.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                          schedule.status === 'overtime' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {schedule.status === 'present' ? 'Présent' :
                           schedule.status === 'late' ? 'Retard' :
                           schedule.status === 'overtime' ? 'Heures sup.' : schedule.status}
                        </span>
                      )}
                    </div>

                    {/* Expanded Content - Notes */}
                    {isExpanded && (
                      <div className="border-t pt-4 mt-4">
                        <div className="mb-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                          <textarea
                            value={schedule?.notes || ''}
                            onChange={(e) => updateScheduleField(employee.id, 'notes', e.target.value)}
                            placeholder="Ajouter des notes sur cette journée de travail..."
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                      </div>
                    )}

                    {/* Check In Button */}
                    <button
                      onClick={() => toggleEmployeeCheck(employee.id)}
                      disabled={!schedule?.entryTime || !schedule?.exitTime || saving}
                      className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center space-x-2 ${
                        schedule?.checked
                          ? 'bg-green-500 hover:bg-green-600 text-white'
                          : schedule?.entryTime && schedule?.exitTime
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
                            {schedule?.checked ? 'Pointé' : 'Pointer'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredEmployees.length === 0 && !loading && (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">Aucun employé trouvé</h3>
            <p className="text-gray-500">Essayez d'ajuster vos critères de recherche ou de filtre</p>
          </div>
        )}

        {/* Daily Summary Report */}
        {schedules.length > 0 && (
          <div className="mt-8 bg-white rounded-2xl shadow-xl p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Résumé Journalier - {new Date(selectedDate).toLocaleDateString('fr-FR')}</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Attendance Summary */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Aperçu de la Présence</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Employés:</span>
                    <span className="font-semibold text-gray-800">{stats.totalEmployees}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Présents Aujourd'hui:</span>
                    <span className="font-semibold text-green-600">{stats.presentEmployees}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Absents Aujourd'hui:</span>
                    <span className="font-semibold text-red-600">{stats.absentEmployees}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Heures Supplémentaires:</span>
                    <span className="font-semibold text-blue-600">{stats.overtimeEmployees}</span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-gray-600">Taux de Présence:</span>
                    <span className="font-semibold text-purple-600">
                      {stats.totalEmployees > 0 ? Math.round((stats.presentEmployees / stats.totalEmployees) * 100) : 0}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2">Résumé Financier</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Heures Totales Travaillées:</span>
                    <span className="font-semibold text-gray-800">{stats.totalHours}h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Heures Régulières:</span>
                    <span className="font-semibold text-blue-600">
                      {schedules.filter(s => s.checked && (s.hoursWorked || 0) <= 8).reduce((sum, s) => sum + (s.hoursWorked || 0), 0).toFixed(2)}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Heures Supplémentaires:</span>
                    <span className="font-semibold text-orange-600">
                      {schedules.filter(s => s.checked && (s.hoursWorked || 0) > 8).reduce((sum, s) => sum + Math.max(0, (s.hoursWorked || 0) - 8), 0).toFixed(2)}h
                    </span>
                  </div>
                  <div className="flex justify-between items-center border-t pt-2">
                    <span className="text-gray-600 font-medium">Salaire Total Journalier:</span>
                    <span className="font-bold text-green-600 text-lg">{stats.totalSalary} MAD</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Salaire Moyen/Employé:</span>
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
                <h3 className="text-lg font-semibold text-gray-700 border-b pb-2 mb-4">Détails du Travail des Employés</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left p-3 font-semibold text-gray-700">Employé</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Département</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Entrée</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Sortie</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Pause</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Machine</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Heures</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Statut</th>
                        <th className="text-right p-3 font-semibold text-gray-700">Salaire (MAD)</th>
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
                              <td className="p-3">{schedule.entryTime}</td>
                              <td className="p-3">{schedule.exitTime}</td>
                              <td className="p-3">{schedule.pauseDuration || 0}min</td>
                              <td className="p-3">{schedule.machineCollapseDuration || 0}min</td>
                              <td className="p-3 font-semibold">{schedule.hoursWorked}h</td>
                              <td className="p-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  schedule.status === 'present' ? 'bg-green-100 text-green-800' :
                                  schedule.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                  schedule.status === 'overtime' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {schedule.status === 'present' ? 'Présent' :
                                   schedule.status === 'late' ? 'Retard' :
                                   schedule.status === 'overtime' ? 'H. Sup.' : schedule.status}
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

            {/* Calculation Example Box */}
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-semibold text-yellow-800 mb-2">Exemple de Calcul:</h4>
              <p className="text-sm text-yellow-700">
                Employé travaille 9h-17h (8h) avec 60min pause et 120min machine arrêtée:<br/>
                • Temps brut: 8h - 1h pause = 7h travaillées<br/>
                • 2h machine arrêtée (payées 50%): 5h normales + 2h à 50%<br/>
                • Calcul: (5h × 12 MAD) + (2h × 6 MAD) = 60 + 12 = 72 MAD
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Horaires;