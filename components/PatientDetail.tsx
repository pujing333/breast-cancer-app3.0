
import React, { useState } from 'react';
import { Patient, ClinicalMarkers, TreatmentEvent, TreatmentOption, DetailedRegimenPlan, SelectedRegimens } from '../types';
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

  const handleBatchAddEvents = (events: Omit<TreatmentEvent, 'id'>[]) => {
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

    const sortedTimeline = [...patient.timeline].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const bsa = (patient.height && patient.weight) 
      ? (0.0061 * patient.height + 0.0128 * patient.weight - 0.1529).toFixed(2) 
      : '--';

    const inferredSubtype = inferMolecularSubtype(patient.markers);
    const inferredStage = inferClinicalStage(patient.markers);

    // 符号定义
    const getSymbol = (type: string) => {
        switch(type) {
            case 'chemo': return '★'; // 化疗
            case 'endocrine': return '●'; // 口服内分泌
            case 'ofs': return '✡'; // OFS
            case 'target': return '□'; // 靶向
            case 'cdk46': return '▲'; // CDK4/6
            default: return '○';
        }
    };

    // 分月逻辑
    const monthsMap: Record<string, TreatmentEvent[]> = {};
    sortedTimeline.forEach(event => {
        const monthKey = event.date.substring(0, 7); // "YYYY-MM"
        if (!monthsMap[monthKey]) monthsMap[monthKey] = [];
        monthsMap[monthKey].push(event);
    });
    const sortedMonthKeys = Object.keys(monthsMap).sort();

    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta http-equiv="content-type" content="application/vnd.ms-excel; charset=UTF-8">
        <style>
          body { font-family: "Microsoft YaHei", "SimSun", sans-serif; background-color: #ffffff; color: #000; }
          /* 增大全局标题和正文 */
          .title { font-size: 32pt; font-weight: bold; text-align: center; height: 80pt; vertical-align: middle; border-bottom: 4pt solid #000; }
          .section-head { background-color: #000000; color: #ffffff; font-weight: bold; border: 3pt solid #000; font-size: 22pt; padding: 20px; text-align: left; }
          
          /* 核心单元格字体极大化，适应老年人 */
          td { border: 1.5pt solid #000; padding: 15pt; font-size: 18pt; vertical-align: middle; line-height: 1.4; }
          .label { font-weight: bold; background-color: #f0f0f0; width: 160pt; text-align: right; font-size: 18pt; }
          .val { font-weight: normal; font-size: 20pt; }
          
          /* 复选框增大 */
          .check-box { font-family: "DejaVu Sans", "Arial Unicode MS"; font-size: 36pt; text-align: center; width: 60pt; font-weight: normal; }
          
          /* 日历样式极大化 */
          .cal-day { width: 100pt; height: 110pt; vertical-align: top; border: 1.5pt solid #333; }
          .cal-date { font-size: 16pt; font-weight: bold; color: #000; margin-bottom: 5pt; }
          .cal-symbol { font-size: 32pt; text-align: center; display: block; padding-top: 10pt; }
          
          .page-break { page-break-before: always; }
          .footer-note { font-size: 16pt; color: #000; line-height: 2.0; padding: 20pt; }
          
          /* 图例增大 */
          .legend-table td { font-size: 16pt; border: none; padding: 10pt; font-weight: bold; }
          .cal-header { background-color: #333; color: #fff; font-size: 18pt; font-weight: bold; }
        </style>
      </head>
      <body>
        <table>
          <tr><td colspan="7" class="title">乳腺癌康复随访告知手册 (大字版)</td></tr>
          
          <tr><td colspan="7" class="section-head">【第一部分】 患者档案及诊断摘要</td></tr>
          <tr>
            <td class="label">患者姓名</td><td class="val" colspan="2">${patient.name}</td>
            <td class="label">年龄/性别</td><td class="val" colspan="3">${patient.age} 岁 / 女</td>
          </tr>
          <tr>
            <td class="label">住院号/MRN</td><td class="val" colspan="2">${patient.mrn}</td>
            <td class="label">体表面积</td><td class="val" colspan="3" style="font-weight: bold; color: #c026d3;">${bsa} m²</td>
          </tr>
          <tr style="background-color: #fefce8;">
            <td class="label" style="background-color: #fef08a;">分析结果</td>
            <td colspan="3" class="val"><b>分型：</b> ${inferredSubtype}</td>
            <td colspan="3" class="val"><b>分期：</b> ${inferredStage}</td>
          </tr>

          <tr><td colspan="7" class="section-head">【第二部分】 术后随访复查指引 (执行核查)</td></tr>
          <tr style="background-color: #000; color: #fff; font-weight: bold;">
            <td colspan="2" align="center">随访阶段</td>
            <td colspan="4" align="center">复查核心项目 (请确保按期执行)</td>
            <td align="center">完成</td>
          </tr>
          <tr>
            <td colspan="2" rowspan="3" align="center"><b>术后 1 - 2 年</b><br/>(每3个月复诊)</td>
            <td colspan="4">1. 血常规、肝肾功能、肿瘤标志物、电解质</td>
            <td class="check-box">□</td>
          </tr>
          <tr>
            <td colspan="4">2. 乳腺及引流区彩超、腹部(肝胆胰脾)彩超</td>
            <td class="check-box">□</td>
          </tr>
          <tr>
            <td colspan="4">3. 胸部CT (每半年一次)</td>
            <td class="check-box">□</td>
          </tr>
          <tr>
            <td colspan="2" rowspan="2" align="center"><b>术后 3 - 5 年</b><br/>(每半年复诊)</td>
            <td colspan="4">1. 基础生化及影像学复查 (频率改为半年)</td>
            <td class="check-box">□</td>
          </tr>
          <tr>
            <td colspan="4">2. 每年加做：钼靶检查、骨扫描(必要时)</td>
            <td class="check-box">□</td>
          </tr>
          <tr>
            <td colspan="2" align="center"><b>术后 5 年以上</b></td>
            <td colspan="4">每年全面体检一次，重点监测长期药物安全性</td>
            <td class="check-box">□</td>
          </tr>
        </table>

        <div class="page-break"></div>

        <table>
          <tr><td colspan="7" class="section-head">【第三部分】 治疗日程月历 (Treatment Calendar)</td></tr>
          <tr>
            <td colspan="7">
              <table class="legend-table" style="width: 100%;">
                <tr>
                  <td><b>★</b> 化疗方案</td><td><b>●</b> 口服药物</td><td><b>✡</b> 抑制针剂</td>
                </tr>
                <tr>
                  <td><b>□</b> 靶向治疗</td><td><b>▲</b> CDK4/6强化</td><td><b>○</b> 其他检查</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- 月度日历生成逻辑 -->
        ${sortedMonthKeys.map(monthKey => {
            const [year, month] = monthKey.split('-').map(Number);
            const firstDay = new Date(year, month - 1, 1).getDay();
            const daysInMonth = new Date(year, month, 0).getDate();
            const monthEvents = monthsMap[monthKey];
            
            const eventsByDay: Record<number, TreatmentEvent[]> = {};
            monthEvents.forEach(e => {
                const day = parseInt(e.date.split('-')[2]);
                if (!eventsByDay[day]) eventsByDay[day] = [];
                eventsByDay[day].push(e);
            });

            let calendarHtml = `
                <div class="page-break"></div>
                <table style="width: 100%; border-collapse: collapse; border: 2pt solid #000;">
                    <tr><td colspan="7" style="background-color: #000; color: #fff; text-align: center; font-size: 28pt; font-weight: bold; padding: 25pt;">
                        ${year} 年 ${month} 月 治疗日程
                    </td></tr>
                    <tr class="cal-header" style="text-align: center;">
                        <td>日</td><td>一</td><td>二</td><td>三</td><td>四</td><td>五</td><td>六</td>
                    </tr>
            `;

            let dayCount = 1;
            for (let i = 0; i < 6; i++) { // 最多6行
                calendarHtml += '<tr>';
                for (let j = 0; j < 7; j++) {
                    if ((i === 0 && j < firstDay) || dayCount > daysInMonth) {
                        calendarHtml += '<td class="cal-day" style="background-color: #f9fafb;"></td>';
                    } else {
                        const dayEvts = eventsByDay[dayCount] || [];
                        const symbols = dayEvts.map(e => getSymbol(e.type)).join(' ');
                        calendarHtml += `
                            <td class="cal-day">
                                <div class="cal-date">${dayCount}</div>
                                <div class="cal-symbol">${symbols}</div>
                            </td>
                        `;
                        dayCount++;
                    }
                }
                calendarHtml += '</tr>';
                if (dayCount > daysInMonth) break;
            }

            calendarHtml += `
                </table>
                <div style="margin-top: 20pt; padding: 20pt; border: 2pt dashed #000; font-size: 16pt; line-height: 1.8;">
                    <b>本月治疗提醒：</b><br/>
                    ${monthEvents.slice(0, 5).map(e => `· ${e.date.split('-')[2]}日: ${e.title}`).join('<br/>')}
                    ${monthEvents.length > 5 ? '<br/>· ... 更多详见正文' : ''}
                </div>
            `;
            return calendarHtml;
        }).join('')}

        <div class="page-break"></div>
        <table>
          <tr><td colspan="7" class="section-head">【第四部分】 康复指南与应急须知</td></tr>
          <tr>
            <td colspan="7" class="footer-note">
              1. <b>严格依从：</b> 内分泌及靶向药物需每日固定时间服用，若漏服时间过长请勿双倍补服。<br/>
              2. <b>骨骼健康：</b> 治疗期间建议每日补充钙剂 (如钙尔奇D) 及维生素D3，保持骨量。<br/>
              3. <b>肢体保护：</b> 患侧上肢避免抽血、输液及测量血压，防止淋巴水肿发生。<br/>
              4. <b>生活方式：</b> 饮食清淡，忌烟酒，保持心情舒畅，建议每日散步30分钟。<br/>
              5. <b>紧急情况：</b> 出现突发胸闷、呼吸困难或患肢剧烈肿痛，请立即联系主管医生。<br/><br/><br/>
              <span style="font-size: 24pt;"><b>主管医生签字：____________________</b></span><br/><br/>
              <span style="font-size: 16pt; color: #666;">打印日期：${new Date().toLocaleDateString()} &nbsp;&nbsp; 软件系统生成</span>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${patient.name}_大字告知手册_${new Date().toISOString().split('T')[0]}.xls`);
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
            patient={patient}
            onUpdateMarkers={(m) => onUpdatePatient({...patient, markers: m})}
            onSaveOptions={(o, id) => onUpdatePatient({...patient, treatmentOptions: o, selectedPlanId: id})}
            onSaveDetailedPlan={handleSaveDetailedPlan}
            onUpdatePatientStats={(h, w) => onUpdatePatient({...patient, height: h, weight: w})}
            onBatchAddEvents={handleBatchAddEvents}
          />
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-4 h-full flex flex-col">
            {patient.timeline.length > 0 && (
              <div className="flex justify-end">
                <button 
                  onClick={handleExportToExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-xs font-bold shadow-md active:scale-95 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  导出大字告知手册
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
