import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  DollarSign, 
  Calendar, 
  Download, 
  Search, 
  Filter,
  Calculator,
  FileText,
  Clock,
  TrendingUp,
  Eye,
  Printer
} from 'lucide-react';
import { collection, query, where, getDocs, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Employee } from '../../types';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';

interface PayrollData {
  employeeId: string;
  employee: Employee;
  totalHours: number;
  totalDays: number;
  grossSalary: number;
  deductions: {
    socialSecurity: number;
    taxes: number;
    insurance: number;
    other: number;
  };
  bonuses: {
    performance: number;
    overtime: number;
    transport: number;
    other: number;
  };
  netSalary: number;
  workDays: Array<{
    date: string;
    hours: number;
    salary: number;
    status: string;
  }>;
}

interface WorkSchedule {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  hoursWorked: number;
  salary: number;
  status: string;
  checked: boolean;
}

const FicheDePaie: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [payrollData, setPayrollData] = useState<PayrollData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);

  // Load employees
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'personnel'), where('status', '==', 'Active')),
      (snapshot) => {
        const employeesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Employee[];
        
        console.log('👥 Employees loaded for payroll:', employeesData.length);
        setEmployees(employeesData);
      },
      (error) => {
        console.error('❌ Error loading employees:', error);
      }
    );

    return unsubscribe;
  }, []);

  // Load work schedules for selected month
  useEffect(() => {
    if (!selectedMonth) return;

    const startDate = format(startOfMonth(parseISO(selectedMonth + '-01')), 'yyyy-MM-dd');
    const endDate = format(endOfMonth(parseISO(selectedMonth + '-01')), 'yyyy-MM-dd');

    console.log('📅 Loading schedules for month:', selectedMonth, 'from', startDate, 'to', endDate);

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'work_schedules'),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      ),
      (snapshot) => {
        const schedulesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as WorkSchedule[];
        
        console.log('📊 Work schedules loaded:', schedulesData.length);
        setSchedules(schedulesData);
        setLoading(false);
      },
      (error) => {
        console.error('❌ Error loading work schedules:', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [selectedMonth]);

  // Calculate payroll data
  useEffect(() => {
    if (employees.length === 0 || schedules.length === 0) {
      setPayrollData([]);
      return;
    }

    const payroll = employees.map(employee => {
      const employeeSchedules = schedules.filter(s => s.employeeId === employee.id && s.checked);
      
      const totalHours = employeeSchedules.reduce((sum, s) => sum + (s.hoursWorked || 0), 0);
      const totalDays = employeeSchedules.length;
      const grossSalary = employeeSchedules.reduce((sum, s) => sum + (s.salary || 0), 0);

      // Calculate deductions (approximate percentages)
      const socialSecurity = grossSalary * 0.096; // 9.6% social security
      const taxes = grossSalary > 2500 ? (grossSalary - 2500) * 0.1 : 0; // 10% tax above 2500 MAD
      const insurance = grossSalary * 0.015; // 1.5% insurance
      const totalDeductions = socialSecurity + taxes + insurance;

      // Calculate bonuses
      const overtimeHours = Math.max(0, totalHours - (totalDays * 8));
      const overtimeBonus = overtimeHours * (employee.hourlyRate || 15) * 1.5; // 1.5x rate for overtime
      const performanceBonus = totalDays >= 20 ? 200 : 0; // 200 MAD bonus for full attendance
      const transportBonus = totalDays * 10; // 10 MAD per day transport allowance

      const totalBonuses = overtimeBonus + performanceBonus + transportBonus;
      const netSalary = grossSalary + totalBonuses - totalDeductions;

      const workDays = employeeSchedules.map(s => ({
        date: s.date,
        hours: s.hoursWorked,
        salary: s.salary,
        status: s.status
      }));

      return {
        employeeId: employee.id,
        employee,
        totalHours,
        totalDays,
        grossSalary,
        deductions: {
          socialSecurity,
          taxes,
          insurance,
          other: 0
        },
        bonuses: {
          performance: performanceBonus,
          overtime: overtimeBonus,
          transport: transportBonus,
          other: 0
        },
        netSalary,
        workDays
      };
    });

    setPayrollData(payroll);
  }, [employees, schedules]);

  // Filter employees
  const filteredPayroll = useMemo(() => {
    return payrollData.filter(payroll => {
      const employee = payroll.employee;
      const matchesSearch = !searchTerm || 
        `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.position?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDepartment = !departmentFilter || employee.department === departmentFilter;
      
      return matchesSearch && matchesDepartment;
    });
  }, [payrollData, searchTerm, departmentFilter]);

  // Get unique departments
  const departments = useMemo(() => {
    const depts = employees.map(emp => emp.department).filter(Boolean);
    return [...new Set(depts)];
  }, [employees]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredPayroll.reduce((acc, payroll) => ({
      totalEmployees: acc.totalEmployees + 1,
      totalHours: acc.totalHours + payroll.totalHours,
      totalGrossSalary: acc.totalGrossSalary + payroll.grossSalary,
      totalNetSalary: acc.totalNetSalary + payroll.netSalary,
      totalDeductions: acc.totalDeductions + Object.values(payroll.deductions).reduce((sum, val) => sum + val, 0),
      totalBonuses: acc.totalBonuses + Object.values(payroll.bonuses).reduce((sum, val) => sum + val, 0)
    }), {
      totalEmployees: 0,
      totalHours: 0,
      totalGrossSalary: 0,
      totalNetSalary: 0,
      totalDeductions: 0,
      totalBonuses: 0
    });
  }, [filteredPayroll]);

  const generatePayrollPDF = (payroll: PayrollData) => {
    // This would generate a PDF payslip for individual employee
    console.log('Generating PDF for:', payroll.employee.firstName, payroll.employee.lastName);
    alert(`PDF generation for ${payroll.employee.firstName} ${payroll.employee.lastName} would be implemented here`);
  };

  const exportPayrollCSV = () => {
    const csvData = filteredPayroll.map(payroll => 
      `${payroll.employee.firstName} ${payroll.employee.lastName},${payroll.employee.department},${payroll.totalDays},${payroll.totalHours},${payroll.grossSalary.toFixed(2)},${Object.values(payroll.deductions).reduce((sum, val) => sum + val, 0).toFixed(2)},${Object.values(payroll.bonuses).reduce((sum, val) => sum + val, 0).toFixed(2)},${payroll.netSalary.toFixed(2)}`
    ).join('\n');
    
    const header = 'Employee Name,Department,Days Worked,Hours Worked,Gross Salary (MAD),Total Deductions (MAD),Total Bonuses (MAD),Net Salary (MAD)\n';
    const blob = new Blob([header + csvData], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${selectedMonth}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-4 text-lg text-gray-600">Loading payroll data...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-r from-green-600 to-green-500 p-3 rounded-full">
              <FileText className="text-white w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Fiches de Paie</h1>
              <p className="text-gray-600">Employee payroll management and salary calculations</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Payroll Month</p>
            <p className="text-2xl font-bold text-green-600">
              {format(parseISO(selectedMonth + '-01'), 'MMMM yyyy')}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
          {/* Month Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Payroll Month</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Employees</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Name or position..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Department</label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">All Departments</option>
              {departments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* Export Button */}
          <div className="flex items-end">
            <button
              onClick={exportPayrollCSV}
              disabled={filteredPayroll.length === 0}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-semibold transition-colors w-full justify-center ${
                filteredPayroll.length === 0
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              <Download className="w-4 h-4" />
              <span className="text-sm">Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
          <div className="flex items-center">
            <Users className="w-8 h-8 text-blue-500" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-800">Total Employees</h3>
              <p className="text-3xl font-bold text-blue-600">{totals.totalEmployees}</p>
              <p className="text-sm text-gray-500">active workers</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-purple-500">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-purple-500" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-800">Total Hours</h3>
              <p className="text-3xl font-bold text-purple-600">{totals.totalHours.toFixed(1)}</p>
              <p className="text-sm text-gray-500">hours worked</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-yellow-500">
          <div className="flex items-center">
            <DollarSign className="w-8 h-8 text-yellow-500" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-800">Gross Payroll</h3>
              <p className="text-3xl font-bold text-yellow-600">{totals.totalGrossSalary.toFixed(0)} MAD</p>
              <p className="text-sm text-gray-500">before deductions</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
          <div className="flex items-center">
            <TrendingUp className="w-8 h-8 text-green-500" />
            <div className="ml-4">
              <h3 className="text-lg font-semibold text-gray-800">Net Payroll</h3>
              <p className="text-3xl font-bold text-green-600">{totals.totalNetSalary.toFixed(0)} MAD</p>
              <p className="text-sm text-gray-500">final payment</p>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll Table */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-800">Employee Payroll Details</h2>
          <p className="text-gray-600">Detailed salary breakdown for {format(parseISO(selectedMonth + '-01'), 'MMMM yyyy')}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-4 font-semibold text-gray-700">Employee</th>
                <th className="text-left p-4 font-semibold text-gray-700">Department</th>
                <th className="text-left p-4 font-semibold text-gray-700">Days</th>
                <th className="text-left p-4 font-semibold text-gray-700">Hours</th>
                <th className="text-left p-4 font-semibold text-gray-700">Gross Salary</th>
                <th className="text-left p-4 font-semibold text-gray-700">Deductions</th>
                <th className="text-left p-4 font-semibold text-gray-700">Bonuses</th>
                <th className="text-left p-4 font-semibold text-gray-700">Net Salary</th>
                <th className="text-left p-4 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPayroll.map((payroll) => (
                <tr key={payroll.employeeId} className="hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
                        {payroll.employee.firstName.charAt(0)}{payroll.employee.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">
                          {payroll.employee.firstName} {payroll.employee.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{payroll.employee.position}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-gray-600">{payroll.employee.department}</td>
                  <td className="p-4">
                    <span className="font-semibold text-blue-600">{payroll.totalDays}</span>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-purple-600">{payroll.totalHours.toFixed(1)}h</span>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-yellow-600">{payroll.grossSalary.toFixed(0)} MAD</span>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-red-600">
                      -{Object.values(payroll.deductions).reduce((sum, val) => sum + val, 0).toFixed(0)} MAD
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-semibold text-blue-600">
                      +{Object.values(payroll.bonuses).reduce((sum, val) => sum + val, 0).toFixed(0)} MAD
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="font-bold text-green-600 text-lg">{payroll.netSalary.toFixed(0)} MAD</span>
                  </td>
                  <td className="p-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedEmployee(selectedEmployee === payroll.employeeId ? null : payroll.employeeId)}
                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => generatePayrollPDF(payroll)}
                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                        title="Generate PDF"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredPayroll.length === 0 && (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">No Payroll Data</h3>
            <p className="text-gray-500">No employees found for the selected month and filters.</p>
          </div>
        )}
      </div>

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {(() => {
              const payroll = filteredPayroll.find(p => p.employeeId === selectedEmployee);
              if (!payroll) return null;

              return (
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-800">
                      Payroll Details - {payroll.employee.firstName} {payroll.employee.lastName}
                    </h2>
                    <button
                      onClick={() => setSelectedEmployee(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Employee Info */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-3">Employee Information</h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium">Name:</span> {payroll.employee.firstName} {payroll.employee.lastName}</p>
                        <p><span className="font-medium">Position:</span> {payroll.employee.position}</p>
                        <p><span className="font-medium">Department:</span> {payroll.employee.department}</p>
                        <p><span className="font-medium">Hourly Rate:</span> {payroll.employee.hourlyRate} MAD/hour</p>
                      </div>
                    </div>

                    {/* Salary Breakdown */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h3 className="font-semibold text-gray-800 mb-3">Salary Breakdown</h3>
                      <div className="space-y-2 text-sm">
                        <p><span className="font-medium">Gross Salary:</span> {payroll.grossSalary.toFixed(2)} MAD</p>
                        <p><span className="font-medium">Total Bonuses:</span> +{Object.values(payroll.bonuses).reduce((sum, val) => sum + val, 0).toFixed(2)} MAD</p>
                        <p><span className="font-medium">Total Deductions:</span> -{Object.values(payroll.deductions).reduce((sum, val) => sum + val, 0).toFixed(2)} MAD</p>
                        <p className="font-bold text-green-600"><span className="font-medium">Net Salary:</span> {payroll.netSalary.toFixed(2)} MAD</p>
                      </div>
                    </div>
                  </div>

                  {/* Work Days Table */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-800 mb-3">Work Days ({payroll.workDays.length} days)</h3>
                    <div className="max-h-60 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-200 sticky top-0">
                          <tr>
                            <th className="text-left p-2">Date</th>
                            <th className="text-left p-2">Hours</th>
                            <th className="text-left p-2">Salary</th>
                            <th className="text-left p-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {payroll.workDays.map((day, index) => (
                            <tr key={index} className="hover:bg-gray-100">
                              <td className="p-2">{format(parseISO(day.date), 'dd/MM/yyyy')}</td>
                              <td className="p-2">{day.hours}h</td>
                              <td className="p-2">{day.salary} MAD</td>
                              <td className="p-2">
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  day.status === 'present' ? 'bg-green-100 text-green-800' :
                                  day.status === 'late' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-blue-100 text-blue-800'
                                }`}>
                                  {day.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default FicheDePaie;
