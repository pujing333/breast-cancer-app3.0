
import React, { useState } from 'react';
import { Patient, ClinicalMarkers, TreatmentEvent, TreatmentOption, DetailedRegimenPlan, SelectedRegimens } from '../types';
import { Header } from './Header';
import { Timeline } from './Timeline';
import { AITreatmentAssistant } from './AITreatmentAssistant';

interface PatientDetailProps {
  patient: Patient;
  onBack: () => void;
  onUpdatePatient: (updatedPatient: Patient) => void;
}

type Tab = 'overview' | 'treatment' | 'timeline';

export const PatientDetail: React.FC<PatientDetailProps> = ({ patient, onBack, onUpdatePatient }) => {
  const [activeTab, setActiveTab] = useState<Tab>('treatment');

  const handleBatchAddEvents = (events: Omit<TreatmentEvent, 'id'>[]) => {
    const newEvents = events.map(evt => ({
      ...evt,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    }));
    onUpdatePatient({
      ...patient,
      timeline: [...patient.timeline, ...newEvents]
    });
    setActiveTab('timeline');
  };

  const handleSaveDetailedPlan = (
    plan: DetailedRegimenPlan, 
    selectedRegimens: SelectedRegimens, 
    isLocked: boolean = false, 
    markersToSave?: ClinicalMarkers
  ) => {
    onUpdatePatient({
      ...patient,
      detailedPlan: plan,
      selectedRegimens: selectedRegimens,
      isPlanLocked: isLocked,
      markers: markersToSave || patient.markers
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Header
        title={`${patient.name} (${patient.age}岁)`}
        onBack={onBack}
        rightAction={<div className="text-xs bg-medical-100 text-medical-700 px-2 py-1 rounded">{patient.diagnosis}</div>}
      />
      
      <div className="bg-white shadow-sm flex justify-around border-b border-gray-200 sticky top-14 z-30">
        {[
          { id: 'overview', label: '基本' },
          { id: 'treatment', label: '方案' },
          { id: 'timeline', label: '日程' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-all ${
              activeTab === tab.id ? 'border-medical-600 text-medical-600' : 'border-transparent text-gray-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
             <h3 className="font-bold text-gray-800 border-b pb-2">档案信息</h3>
             <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-400 block">身高</span>{patient.height || '--'} cm</div>
                <div><span className="text-gray-400 block">体重</span>{patient.weight || '--'} kg</div>
                <div className="col-span-2"><span className="text-gray-400 block">诊断</span>{patient.diagnosis}</div>
             </div>
             {patient.isPlanLocked && (
               <div className="bg-green-50 text-green-700 p-3 rounded-lg text-xs border border-green-100 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" /></svg>
                  方案已锁定，剂量已固化
               </div>
             )}
          </div>
        )}

        {activeTab === 'treatment' && (
          <AITreatmentAssistant 
            key={`${patient.id}-${patient.isPlanLocked ? 'locked' : 'unlocked'}`}
            patient={patient}
            onUpdateMarkers={(m) => onUpdatePatient({...patient, markers: m})}
            onSaveOptions={(o, id) => onUpdatePatient({...patient, treatmentOptions: o, selectedPlanId: id})}
            onSaveDetailedPlan={handleSaveDetailedPlan}
            onUpdatePatientStats={(h, w) => onUpdatePatient({...patient, height: h, weight: w})}
            onBatchAddEvents={handleBatchAddEvents}
          />
        )}

        {activeTab === 'timeline' && (
          <Timeline 
            patient={patient}
            onAddEvent={(e) => onUpdatePatient({...patient, timeline: [...patient.timeline, {...e, id: Date.now().toString()}]})}
            onUpdateEvent={(e) => onUpdatePatient({...patient, timeline: patient.timeline.map(t => t.id === e.id ? e : t)})}
          />
        )}
      </div>
    </div>
  );
};
