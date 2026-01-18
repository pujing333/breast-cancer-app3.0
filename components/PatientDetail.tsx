
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
    
    const treatmentTypes = ['chemo', 'endocrine', 'target', 'immune'];
    const filteredTimeline = patient.timeline.filter(e => !treatmentTypes.includes(e.type));

    onUpdatePatient({
      ...patient,
      timeline: [...filteredTimeline, ...newEvents]
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

  const handleExportToExcel = () => {
    if (patient.timeline.length === 0) {
      alert("当前没有日程数据可供导出。");
      return;
    }

    // 构建 CSV 内容
    // 添加 BOM 确保 Excel 打开不乱码 (UTF-8)
    let csvContent = "\ufeff";
    
    // 1. 患者概况部分
    csvContent += `个体化治疗告知单 (患者手册)\n`;
    csvContent += `姓名,${patient.name},年龄,${patient.age},住院号,${patient.mrn}\n`;
    csvContent += `临床诊断,${patient.diagnosis},,,\n`;
    csvContent += `身高(cm),${patient.height || '--'},体重(kg),${patient.weight || '--'},BSA(m2),${patient.height && patient.weight ? (0.0061 * patient.height + 0.0128 * patient.weight - 0.1529).toFixed(2) : '--'}\n`;
    csvContent += `\n`;

    // 2. 核心病理快照
    csvContent += `核心临床指标快照\n`;
    csvContent += `ER,${patient.markers.erStatus},HER2,${patient.markers.her2Status},Ki-67,${patient.markers.ki67}\n`;
    csvContent += `T分期,${patient.markers.tumorSize},N分期,${patient.markers.nodeStatus},分级,${patient.markers.histologicalGrade}\n`;
    csvContent += `\n`;

    // 3. 详细排程表
    csvContent += `详细治疗日程计划\n`;
    csvContent += `预定日期,项目名称,具体用药/剂量,类型,执行情况(患者填写)\n`;

    // 排序日程
    const sortedTimeline = [...patient.timeline].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    sortedTimeline.forEach(event => {
      const typeLabel = event.type === 'chemo' ? '化疗' : event.type === 'endocrine' ? '内分泌' : event.type === 'target' ? '靶向' : '其他';
      const dosage = event.dosageDetails ? event.dosageDetails.replace(/,/g, ' ') : ''; // 移除逗号防止CSV断行
      csvContent += `${event.date},${event.title},${dosage},${typeLabel},[ ] 已执行\n`;
    });

    csvContent += `\n注意：本排程基于指南推荐制定，如遇身体不适（发热、严重腹泻、剧烈呕吐等）请及时联系主管医生调整治疗日期。\n`;

    // 执行下载
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${patient.name}_治疗告知单_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          <div className="space-y-4">
            {patient.timeline.length > 0 && (
              <div className="flex justify-end">
                <button 
                  onClick={handleExportToExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                  </svg>
                  导出治疗告知书 (Excel)
                </button>
              </div>
            )}
            <Timeline 
              patient={patient}
              onAddEvent={(e) => onUpdatePatient({...patient, timeline: [...patient.timeline, {...e, id: Date.now().toString()}]})}
              onUpdateEvent={(e) => onUpdatePatient({...patient, timeline: patient.timeline.map(t => t.id === e.id ? e : t)})}
            />
          </div>
        )}
      </div>
    </div>
  );
};
