
import React, { useState } from 'react';
import { RegimenOption, TreatmentEvent, DrugDetail } from '../types';

interface ScheduleGeneratorProps {
  selectedOptions: RegimenOption[];
  onSaveEvents: (events: Omit<TreatmentEvent, 'id'>[]) => void;
  patientHeight?: number;
  patientWeight?: number;
  patientAge?: number;
  scr?: string;
  isLocked?: boolean;
}

export const ScheduleGenerator: React.FC<ScheduleGeneratorProps> = ({ 
  selectedOptions, 
  onSaveEvents,
  patientHeight,
  patientWeight,
  patientAge,
  scr,
  isLocked
}) => {
  const [startDates, setStartDates] = useState<Record<string, string>>({
    chemo: new Date().toISOString().split('T')[0],
    endocrine: new Date().toISOString().split('T')[0],
    target: new Date().toISOString().split('T')[0],
    cdk46: new Date().toISOString().split('T')[0]
  });
  
  const [generatedEvents, setGeneratedEvents] = useState<Omit<TreatmentEvent, 'id'>[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleGenerate = () => {
    const events: Omit<TreatmentEvent, 'id'>[] = [];
    
    selectedOptions.forEach(option => {
      const type = option.type;
      const startDateStr = startDates[type] || startDates.chemo;
      const [y, m, d] = startDateStr.split('-').map(Number);
      if (isNaN(y)) return;
      let rollingDate = new Date(y, m - 1, d);

      // 处理内分泌 (口服药 + 针剂)
      if (type === 'endocrine') {
        const ofsDrug = option.drugs?.find(d => d.name.includes('戈舍瑞林') || d.name.includes('亮丙瑞林'));
        const oralDrug = option.drugs?.find(d => !d.name.includes('戈舍瑞林') && !d.name.includes('亮丙瑞林'));
        
        if (ofsDrug) {
            const frequency = option.frequencyDays || 28;
            const cycles = frequency > 50 ? 5 : 13;
            let ofsDate = new Date(rollingDate.getTime());
            for (let i = 0; i < cycles; i++) {
                events.push({ title: `${ofsDrug.name} 注射`, description: `第 ${i+1} 周期 (${frequency}天间隔)`, date: formatDate(ofsDate), type: 'endocrine', completed: false, dosageDetails: `${ofsDrug.name} ${ofsDrug.standardDose}mg` });
                ofsDate.setDate(ofsDate.getDate() + frequency);
            }
        }
        if (oralDrug) {
            let oralDate = new Date(rollingDate.getTime());
            for (let i = 0; i < 12; i++) { // 为首年每月生成一个服药节点
                events.push({ title: `${oralDrug.name} 口服 (M${i+1})`, description: '请确认每日按时服用', date: formatDate(oralDate), type: 'endocrine', completed: false, dosageDetails: `${oralDrug.name} 每日口服` });
                oralDate.setMonth(oralDate.getMonth() + 1);
            }
        }
        return;
      }

      // 处理 CDK4/6 (口服)
      if (type === 'cdk46') {
        let cdkDate = new Date(rollingDate.getTime());
        for (let i = 0; i < 24; i++) { // 生成2年随访节点
            events.push({ title: `${option.name} (第 ${i+1} 月)`, description: `每日口服: ${option.cycle}`, date: formatDate(cdkDate), type: 'cdk46', completed: false, dosageDetails: `${option.name} 维持服用` });
            cdkDate.setDate(cdkDate.getDate() + 28);
        }
        return;
      }

      // 处理化疗/靶向 (周期性)
      const cycles = option.totalCycles || 1;
      const freq = option.frequencyDays || 21;
      for (let i = 0; i < cycles; i++) {
          const currentEventDate = new Date(rollingDate.getTime());
          events.push({ title: `${option.name} (C${i+1})`, description: option.cycle, date: formatDate(currentEventDate), type: type as any, completed: false, dosageDetails: option.drugs?.map(d => `${d.name} ${d.lockedDose || (d.standardDose + d.unit)}`).join(' + ') });
          rollingDate.setDate(rollingDate.getDate() + freq);
      }
    });
    
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setGeneratedEvents(events);
    setIsPreviewing(true);
  };

  const activeTypes = Array.from(new Set(selectedOptions.map(o => o.type)));

  return (
    <div className={`mt-6 p-4 rounded-xl border ${isLocked ? 'bg-gray-50 border-gray-100' : 'bg-white border-medical-100 shadow-sm'}`}>
      <div className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-medical-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        分项起始日期设置 (口服药将自动生成月度节点)
      </div>
      <div className="space-y-3 mb-5">
        {activeTypes.map(type => (
            <div key={type} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border">
                <label className="text-[10px] font-bold uppercase text-gray-500 min-w-[100px]">{type === 'chemo' ? '化疗' : type === 'endocrine' ? '内分泌/OFS' : type === 'target' ? '靶向' : 'CDK4/6'}</label>
                <input type="date" disabled={isLocked} className="p-1.5 text-xs border rounded bg-white" value={startDates[type]} onChange={e => setStartDates({...startDates, [type]: e.target.value})} />
            </div>
        ))}
      </div>
      {!isPreviewing ? (
          <button onClick={handleGenerate} className="w-full py-3 bg-medical-50 text-medical-700 border border-medical-200 rounded-lg text-xs font-bold active:scale-[0.98]">1. 自动计算全周期排程 (含口服)</button>
      ) : (
          <div className="space-y-3">
              <div className="max-h-56 overflow-y-auto bg-gray-50 p-2 rounded-lg border text-[10px] space-y-1">
                  {generatedEvents.map((e, i) => (
                      <div key={i} className={`bg-white p-2 rounded flex justify-between border-l-4 ${e.type === 'cdk46' ? 'border-orange-400' : e.type === 'endocrine' ? 'border-indigo-400' : 'border-medical-400'}`}>
                          <span><b>{e.date}</b>: {e.title}</span>
                          <span className="text-gray-400">{e.dosageDetails}</span>
                      </div>
                  ))}
              </div>
              <div className="flex gap-2">
                  <button onClick={() => setIsPreviewing(false)} className="flex-1 py-2 rounded-lg text-xs font-bold bg-gray-100">返回修改</button>
                  <button onClick={() => { onSaveEvents(generatedEvents); setIsPreviewing(false); setIsSuccess(true); setTimeout(() => setIsSuccess(false), 3000); }} className="flex-1 py-2 bg-medical-600 text-white rounded-lg text-xs font-bold">2. 写入患者时间轴</button>
              </div>
          </div>
      )}
      {isSuccess && <div className="mt-2 p-2 bg-green-50 text-green-700 text-xs font-bold rounded text-center">日程已同步至患者档案！</div>}
    </div>
  );
};
