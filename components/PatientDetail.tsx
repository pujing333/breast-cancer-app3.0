
import React, { useState, useCallback } from 'react';
import { Patient, ClinicalMarkers, TreatmentEvent, DetailedRegimenPlan, SelectedRegimens, RegimenOption } from '../types';
import { Header } from './Header';
import { Timeline } from './Timeline';
import { AITreatmentAssistant } from './AITreatmentAssistant';
import { inferMolecularSubtype, inferClinicalStage } from '../services/localMedicalRules';

interface PatientDetailProps {
  patient: Patient;
  onBack: () => void;
  onUpdatePatient: (updatedPatient: Patient) => void;
}

type Tab = 'overview' | 'treatment' | 'timeline';

export const PatientDetail: React.FC<PatientDetailProps> = ({ patient, onBack, onUpdatePatient }) => {
  const [activeTab, setActiveTab] = useState<Tab>('treatment');

  const calculateBSAValue = (h?: number, w?: number) => {
    if (h && w) return (0.0061 * h + 0.0128 * w - 0.1529).toFixed(2);
    return '--';
  };

  const handleBatchAddEvents = useCallback((events: Omit<TreatmentEvent, 'id'>[]) => {
    const newEvents = events.map(evt => ({
      ...evt,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
    }));
    
    const treatmentTypes = ['chemo', 'endocrine', 'target', 'immune', 'cdk46', 'ofs'];
    const filteredTimeline = patient.timeline.filter(e => !treatmentTypes.includes(e.type));

    onUpdatePatient({
      ...patient,
      timeline: [...filteredTimeline, ...newEvents]
    });
    setActiveTab('timeline');
  }, [patient, onUpdatePatient]);

  const handleUpdateEvent = useCallback((updatedEvent: TreatmentEvent) => {
    const newTimeline = patient.timeline.map(e => e.id === updatedEvent.id ? updatedEvent : e);
    onUpdatePatient({ ...patient, timeline: newTimeline });
  }, [patient, onUpdatePatient]);

  const handleSaveDetailedPlan = useCallback((
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
  }, [patient, onUpdatePatient]);

  const handleUpdateMarkers = useCallback((m: ClinicalMarkers) => {
    onUpdatePatient({...patient, markers: m});
  }, [patient, onUpdatePatient]);

  const handleUpdateStats = useCallback((h: number, w: number) => {
    onUpdatePatient({...patient, height: h, weight: w});
  }, [patient, onUpdatePatient]);

  const getSymbol = (type: string) => {
    switch(type) {
        case 'chemo': return '★'; 
        case 'endocrine': return '●'; 
        case 'ofs': return '✡'; 
        case 'target': return '□'; 
        case 'cdk46': return '▲'; 
        default: return '○';
    }
  };

  const getRegimenInfo = (category: keyof DetailedRegimenPlan, id?: string) => {
    if (!id || !patient.detailedPlan) return { name: '未设定', freq: '' };
    const options = (patient.detailedPlan[category] as RegimenOption[]);
    const selected = options.find(o => o.id === id);
    if (!selected) return { name: '未设定', freq: '' };
    
    const drugName = selected.drugs && selected.drugs.length > 0 
      ? selected.drugs.map(d => d.name).join('+') 
      : '未设定';
    
    let freq = '';
    if (selected.type === 'chemo' || selected.type === 'target') freq = '每21天';
    if (selected.type === 'endocrine' && category === 'oralEndocrineOptions') freq = '每日一次';
    if (selected.type === 'cdk46') freq = selected.id === 'cdk_abe' ? '每日两次' : '每日一次 (用21停7)';
    if (category === 'ofsOptions') freq = selected.frequencyDays ? `每${selected.frequencyDays}天` : '按医嘱';

    return { name: drugName, freq };
  };

  const drugLegends = [
    { s: '★', t: '化疗', info: getRegimenInfo('chemoOptions', patient.selectedRegimens?.chemoId) },
    { s: '●', t: '口服', info: getRegimenInfo('oralEndocrineOptions', patient.selectedRegimens?.oralEndocrineId) },
    { s: '✡', t: 'OFS针', info: getRegimenInfo('ofsOptions', patient.selectedRegimens?.ofsId) },
    { s: '□', t: '靶向', info: getRegimenInfo('targetOptions', patient.selectedRegimens?.targetId) },
    { s: '▲', t: '强化', info: getRegimenInfo('cdk46Options', patient.selectedRegimens?.cdk46Id) },
    { s: '○', t: '检查', info: { name: '随访复查', freq: '按计划' } }
  ];

  const handleExportGuide = () => {
    const inferredSubtype = inferMolecularSubtype(patient.markers);
    const inferredStage = inferClinicalStage(patient.markers);
    const bsa = calculateBSAValue(patient.height, patient.weight);

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          body { font-family: "Microsoft YaHei", sans-serif; }
          table { width: 320pt; border-collapse: collapse; margin-bottom: 8pt; table-layout: fixed; margin-left: auto; margin-right: auto; }
          .title { font-size: 16pt; font-weight: bold; text-align: center; height: 35pt; border-bottom: 2pt solid #000; }
          .section-head { background-color: #333; color: #fff; font-weight: bold; border: 1pt solid #000; font-size: 11pt; padding: 5pt; text-align: left; }
          td { border: 0.5pt solid #000; padding: 4pt; font-size: 9pt; vertical-align: middle; line-height: 1.2; }
          .label { font-weight: bold; width: 70pt; text-align: right; background-color: #f5f5f5; }
          .val { text-align: left; padding-left: 6pt; }
          .check-box { font-family: "DejaVu Sans", "Arial Unicode MS"; font-size: 14pt; text-align: center; width: 30pt; }
          .page-break { page-break-before: always; }
          .item-list { font-size: 8pt; text-align: left; line-height: 1.1; }
          .center { text-align: center; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="4" class="title">乳腺癌康复随访手册</td></tr>
          <tr><td colspan="4" class="section-head">【档案】 基本资料</td></tr>
          <tr><td class="label">姓名</td><td class="val">${patient.name}</td><td class="label">住院号</td><td class="val">${patient.mrn}</td></tr>
          <tr><td class="label">年龄/性别</td><td class="val">${patient.age}岁/女</td><td class="label">体表面积</td><td class="val">${bsa} m²</td></tr>
          <tr><td class="label">分型/分期</td><td class="val" colspan="3">${inferredSubtype} / ${inferredStage}</td></tr>
        </table>
        <table>
          <tr><td colspan="3" class="section-head">【复查】 术后序贯核查 (1-2年)</td></tr>
          <tr style="background-color: #eee; font-weight: bold; text-align: center;">
            <td width="55">时间</td><td>重点项目</td><td width="30">完成</td>
          </tr>
          <tr><td class="center"><b>3月</b></td><td class="item-list">血常规/生化/标志物、双乳/腋下/腹部彩超</td><td class="check-box">□</td></tr>
          <tr><td class="center"><b>6月</b></td><td class="item-list">基础化验及彩超、<b>胸部CT (平扫)</b></td><td class="check-box">□</td></tr>
          <tr><td class="center"><b>12月</b></td><td class="item-list">大复查：CT + <b>乳腺钼靶</b> + 腹部彩超</td><td class="check-box">□</td></tr>
          <tr><td class="center"><b>24月</b></td><td class="item-list">年度复查：CT/钼靶/腹部彩超/骨扫描(选)</td><td class="check-box">□</td></tr>
        </table>
        <div class="page-break"></div>
        <table>
          <tr><td colspan="3" class="section-head">【日程】 治疗计划图例</td></tr>
          <tr style="background-color: #eee; font-weight: bold; text-align: center;">
            <td width="35">符号</td><td>药物名称</td><td width="60">频率</td>
          </tr>
          ${drugLegends.map(l => `
            <tr>
              <td class="center" style="font-size:16pt;">${l.s}</td>
              <td class="val"><b>${l.t}</b>: ${l.info.name}</td>
              <td class="center">${l.info.freq}</td>
            </tr>
          `).join('')}
        </table>
      </body>
      </html>
    `;
    downloadFile(html, `${patient.name}_随访手册.xls`);
  };

  const handleExportCalendar = () => {
    const sortedTimeline = [...patient.timeline].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const monthsMap: Record<string, TreatmentEvent[]> = {};
    sortedTimeline.forEach(event => {
        const monthKey = event.date.substring(0, 7); 
        if (!monthsMap[monthKey]) monthsMap[monthKey] = [];
        monthsMap[monthKey].push(event);
    });
    const sortedMonthKeys = Object.keys(monthsMap).sort();

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          body { font-family: "Microsoft YaHei", sans-serif; }
          .cal-table { width: 340pt; border-collapse: collapse; table-layout: fixed; margin-left: auto; margin-right: auto; }
          .cal-header { background-color: #333; color: #fff; font-size: 10pt; height: 25pt; text-align: center; font-weight: bold; }
          .month-title { font-size: 16pt; font-weight: bold; text-align: center; height: 45pt; border-bottom: 2pt solid #000; }
          .cal-day { width: 48.5pt; height: 55pt; border: 0.5pt solid #000; vertical-align: top; text-align: left; padding: 2pt; }
          .day-num { font-size: 8pt; font-weight: bold; color: #444; display: block; height: 12pt; }
          .day-sym { font-size: 20pt; text-align: center; display: block; line-height: 35pt; font-weight: normal; }
          .page-break { page-break-before: always; }
        </style>
      </head>
      <body>
        ${sortedMonthKeys.map((monthKey, index) => {
            const [year, month] = monthKey.split('-').map(Number);
            const firstDay = new Date(year, month - 1, 1).getDay();
            const daysInMonth = new Date(year, month, 0).getDate();
            const eventsByDay: Record<number, TreatmentEvent[]> = {};
            (monthsMap[monthKey] || []).forEach(e => {
                const d = parseInt(e.date.split('-')[2]);
                if (!eventsByDay[d]) eventsByDay[d] = [];
                eventsByDay[d].push(e);
            });

            let calHtml = `<div class="${index > 0 ? 'page-break' : ''}"></div><table class="cal-table"><tr><td colspan="7" class="month-title">${year}年 ${month}月</td></tr><tr class="cal-header"><td>日</td><td>一</td><td>二</td><td>三</td><td>四</td><td>五</td><td>六</td></tr>`;
            let dayCount = 1;
            for (let i = 0; i < 6; i++) {
                calHtml += '<tr>';
                for (let j = 0; j < 7; j++) {
                    if ((i === 0 && j < firstDay) || dayCount > daysInMonth) {
                        calHtml += '<td class="cal-day" style="background-color:#f5f5f5;"></td>';
                    } else {
                        const dayEvts = eventsByDay[dayCount] || [];
                        const syms = dayEvts.map(e => getSymbol(e.type)).join('');
                        calHtml += `<td class="cal-day"><span class="day-num">${dayCount}</span><span class="day-sym">${syms}</span></td>`;
                        dayCount++;
                    }
                }
                calHtml += '</tr>';
                if (dayCount > daysInMonth) break;
            }
            calHtml += `</table>`;
            return calHtml;
        }).join('')}
      </body>
      </html>
    `;
    downloadFile(html, `${patient.name}_治疗月历.xls`);
  };

  const downloadFile = (html: string, filename: string) => {
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Header title={`${patient.name} (${patient.age}岁)`} onBack={onBack} />
      <div className="bg-white shadow-sm flex justify-around border-b border-gray-200">
        {['overview', 'treatment', 'timeline'].map(t => (
          <button key={t} onClick={() => setActiveTab(t as Tab)} className={`px-6 py-3 text-sm font-medium border-b-2 ${activeTab === t ? 'border-medical-600 text-medical-600' : 'border-transparent text-gray-500'}`}>
            {t === 'overview' ? '基本' : t === 'treatment' ? '方案' : '日程'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="bg-white p-4 rounded-xl shadow-sm space-y-4">
             <h3 className="font-bold border-b pb-2">档案信息</h3>
             <div className="grid grid-cols-2 gap-4 text-sm">
                <div>身高: {patient.height || '--'} cm</div>
                <div>体重: {patient.weight || '--'} kg</div>
                <div>BSA: {calculateBSAValue(patient.height, patient.weight)} m²</div>
                <div className="col-span-2">诊断: {patient.diagnosis}</div>
             </div>
          </div>
        )}
        {activeTab === 'treatment' && (
          <AITreatmentAssistant 
            patient={patient}
            onUpdateMarkers={handleUpdateMarkers}
            onSaveOptions={(o, id) => onUpdatePatient({...patient, treatmentOptions: o, selectedPlanId: id})}
            onSaveDetailedPlan={handleSaveDetailedPlan}
            onUpdatePatientStats={handleUpdateStats}
            onBatchAddEvents={handleBatchAddEvents}
          />
        )}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            {patient.timeline.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleExportGuide} className="py-3 bg-gray-800 text-white rounded-xl text-xs font-bold shadow">导出随访手册</button>
                <button onClick={handleExportCalendar} className="py-3 bg-medical-600 text-white rounded-xl text-xs font-bold shadow">导出治疗月历</button>
              </div>
            )}
            <Timeline 
              patient={patient} 
              onAddEvent={(e) => onUpdatePatient({...patient, timeline: [...patient.timeline, {...e, id: Date.now().toString()}]})} 
              onUpdateEvent={handleUpdateEvent}
            />
          </div>
        )}
      </div>
    </div>
  );
};
