
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

    // 排序日程
    const sortedTimeline = [...patient.timeline].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // 构建 HTML 内容（Excel 可识别带样式的 HTML）
    const bsa = (patient.height && patient.weight) 
      ? (0.0061 * patient.height + 0.0128 * patient.weight - 0.1529).toFixed(2) 
      : '--';

    const getRowStyle = (type: string) => {
        switch(type) {
            case 'chemo': return 'background-color: #fee2e2;'; // 浅红
            case 'endocrine': return 'background-color: #e0f2fe;'; // 浅蓝
            case 'target': return 'background-color: #f0fdf4;'; // 浅绿
            case 'surgery': return 'background-color: #f5f3ff;'; // 浅紫
            default: return '';
        }
    };

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          .title { font-size: 18pt; font-weight: bold; text-align: center; height: 40pt; vertical-align: middle; }
          .section-head { background-color: #f3f4f6; font-weight: bold; border: 1pt solid #000; }
          td { border: 0.5pt solid #ccc; padding: 5pt; font-size: 10pt; }
          .label { color: #666; font-weight: bold; background-color: #fafafa; }
          .val { font-weight: normal; }
          .type-tag { font-size: 8pt; color: #666; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="5" class="title">乳腺癌个体化治疗告知单 (患者手册)</td></tr>
          
          <!-- 患者基本信息表 -->
          <tr><td colspan="5" class="section-head">一、患者基本资料</td></tr>
          <tr>
            <td class="label">姓名</td><td class="val">${patient.name}</td>
            <td class="label">年龄</td><td class="val">${patient.age} 岁</td>
            <td rowspan="3" align="center" valign="middle" style="background-color: #f0f9ff; font-weight: bold;">
                <br/>体表面积(BSA)<br/><span style="font-size: 14pt; color: #0284c7;">${bsa}</span><br/>m²
            </td>
          </tr>
          <tr>
            <td class="label">住院号/MRN</td><td class="val">${patient.mrn}</td>
            <td class="label">入院日期</td><td class="val">${patient.admissionDate}</td>
          </tr>
          <tr>
            <td class="label">临床诊断</td><td colspan="3" class="val">${patient.diagnosis}</td>
          </tr>

          <!-- 病理快照 -->
          <tr><td colspan="5" class="section-head">二、核心病理及分子指标快照</td></tr>
          <tr>
            <td class="label">ER 状态</td><td class="val">${patient.markers.erStatus}</td>
            <td class="label">HER2 状态</td><td class="val">${patient.markers.her2Status}</td>
            <td class="label">分子分型</td>
          </tr>
          <tr>
            <td class="label">Ki-67</td><td class="val">${patient.markers.ki67}</td>
            <td class="label">淋巴结状态</td><td class="val">${patient.markers.nodeStatus}</td>
            <td rowspan="2" align="center" valign="middle" style="color: #0d9488; font-weight: bold;">${patient.subtype}</td>
          </tr>
          <tr>
            <td class="label">肿瘤大小</td><td class="val">${patient.markers.tumorSize}</td>
            <td class="label">组织分级</td><td class="val">${patient.markers.histologicalGrade}</td>
          </tr>

          <!-- 详细日程 -->
          <tr><td colspan="5" class="section-head">三、详细治疗排程表 (Roadmap)</td></tr>
          <tr style="background-color: #4b5563; color: #ffffff; font-weight: bold;">
            <td width="100">预定日期</td>
            <td width="200">项目名称</td>
            <td width="300">具体用药及计算剂量</td>
            <td width="80">类型</td>
            <td width="150">备注/体感记录</td>
          </tr>
    `;

    sortedTimeline.forEach(event => {
      const typeLabel = event.type === 'chemo' ? '化疗' : event.type === 'endocrine' ? '内分泌' : event.type === 'target' ? '靶向' : '其他';
      const dosage = event.dosageDetails || '--';
      
      html += `
          <tr style="${getRowStyle(event.type)}">
            <td align="center"><b>${event.date}</b></td>
            <td>${event.title}</td>
            <td style="font-family: 'Courier New', monospace; font-size: 9pt;">${dosage}</td>
            <td align="center" class="type-tag">${typeLabel}</td>
            <td style="color: #ccc;">[ ] 已完成 / 记录:</td>
          </tr>
      `;
    });

    html += `
          <tr><td colspan="5" style="border: none; padding-top: 20pt; color: #666; font-size: 9pt;">
            <b>注意事项：</b><br/>
            1. 本计划基于当前临床指南制定，具体执行可能根据血常规及肝肾功能化验结果动态调整。<br/>
            2. 治疗期间如出现发热（>38.5℃）、严重腹泻、剧烈呕吐或气促，请务必第一时间联系主管医生。<br/>
            3. 请按时回院，保持心情舒畅，加强营养。<br/>
            <br/>
            <b>主管医生签字：____________________</b> &nbsp;&nbsp;&nbsp;&nbsp; <b>日期：${new Date().toLocaleDateString()}</b>
          </td></tr>
        </table>
      </body>
      </html>
    `;

    // 执行下载
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${patient.name}_治疗手册_${new Date().toISOString().split('T')[0]}.xls`);
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
                  className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  打印治疗告知书 (XLS)
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
