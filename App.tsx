
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { PatientList } from './components/PatientList';
import { PatientDetail } from './components/PatientDetail';
import { AddPatientForm } from './components/AddPatientForm';
import { Patient } from './types';
import { INITIAL_PATIENTS } from './constants';

function App() {
const [patients, setPatients] = useState<Patient[]>(() => {
    try {
        const saved = localStorage.getItem('patients');
        return saved ? JSON.parse(saved) : INITIAL_PATIENTS;
    } catch (e) {
        console.error("Failed to parse patients from localStorage", e);
        return INITIAL_PATIENTS;
    }
});

const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
const [isAddingPatient, setIsAddingPatient] = useState(false);

// Persist data
useEffect(() => {
localStorage.setItem('patients', JSON.stringify(patients));
}, [patients]);

const activePatient = patients.find(p => p.id === selectedPatientId);

const handleSelectPatient = (patient: Patient) => {
setSelectedPatientId(patient.id);
setIsAddingPatient(false);
};

const handleBack = () => {
setSelectedPatientId(null);
};

const handleUpdatePatient = (updated: Patient) => {
setPatients(prev => prev.map(p => p.id === updated.id ? updated : p));
};

const handleDeletePatient = (id: string) => {
    setPatients(prev => prev.filter(p => p.id !== id));
    if (selectedPatientId === id) setSelectedPatientId(null);
};

const handleAddPatientClick = () => {
setIsAddingPatient(true);
setSelectedPatientId(null);
};

const handleSaveNewPatient = (patientData: Omit<Patient, 'id'>) => {
const newId = Date.now().toString();
const newPatient: Patient = {
...patientData,
id: newId
};
setPatients([newPatient, ...patients]);
setIsAddingPatient(false);
setSelectedPatientId(newId);
};

// --- Data Backup & Restore Logic ---

const handleExportData = () => {
try {
const dataStr = JSON.stringify(patients, null, 2);
const blob = new Blob([dataStr], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().split('T')[0];
      link.download = `breast_care_backup_${date}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  } catch (e) {
      alert('导出失败，请重试');
  }
};

const handleImportData = (file: File) => {
const reader = new FileReader();
reader.onload = (e) => {
try {
const content = e.target?.result as string;
const importedData = JSON.parse(content);
// Simple validation
          if (Array.isArray(importedData)) {
              if (window.confirm(`确认导入 ${importedData.length} 条数据？这将覆盖当前的所有数据。`)) {
                  setPatients(importedData);
                  alert('数据恢复成功！');
              }
          } else {
              alert('文件格式错误：必须是 JSON 数组');
          }
      } catch (err) {
          console.error(err);
          alert('导入失败：无法解析文件');
      }
  };
  reader.readAsText(file);
};

return (
// 使用 h-[100dvh] 代替 min-h-screen，完美适配手机浏览器动态地址栏
<div className="h-[100dvh] w-screen overflow-hidden bg-gray-50 font-sans text-gray-900 flex flex-col">
{isAddingPatient ? (
<AddPatientForm
onSave={handleSaveNewPatient}
onCancel={() => setIsAddingPatient(false)}
/>
) : selectedPatientId && activePatient ? (
<PatientDetail
patient={activePatient}
onBack={handleBack}
onUpdatePatient={handleUpdatePatient}
/>
) : (
<>
<Header
title="乳腺外科患者管理"
onExport={handleExportData}
onImport={handleImportData}
/>
<PatientList
patients={patients}
onSelectPatient={handleSelectPatient}
onAddPatient={handleAddPatientClick}
onDeletePatient={handleDeletePatient}
/>
</>
)}
</div>
);
}

export default App;
