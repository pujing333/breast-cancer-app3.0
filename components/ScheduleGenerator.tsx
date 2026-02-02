
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
    target: new Date().toISOString().split('T')[0],
    cdk46: new Date().toISOString().split('T')[0],
    ofs: new Date().toISOString().split('T')[0],
    oral: new Date().toISOString().split('T')[0]
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
      if (option.id === 'cdk_none' || option.id === 'ofs_none') return;
      
      let startDateKey = 'chemo';
      if (option.id.startsWith('c_')) startDateKey = 'chemo';
      else if (option.id.startsWith('t_')) startDateKey = 'target';
      else if (option.id.startsWith('cdk_')) startDateKey = 'cdk46';
      else if (option.id.startsWith('ofs_')) startDateKey = 'ofs';
      else if (option.id.startsWith('oral_')) startDateKey = 'oral';

      const startDateStr = startDates[startDateKey];
      const [y, m, d] = startDateStr.split('-').map(Number);
      if (isNaN(y)) return;
      let baseRollingDate = new Date(y, m - 1, d);

      // 1. 周期性针剂治疗 (化疗、靶向、OFS)
      if (option.totalCycles && option.totalCycles > 0 && !option.id.startsWith('cdk_') && !option.id.startsWith('oral_')) {
          const cycles = option.totalCycles;
          const freq = option.frequencyDays || 21;
          const isOFS = option.id.startsWith('ofs_');
          
          for (let i = 0; i < cycles; i++) {
              const currentEventDate = new Date(baseRollingDate.getTime());
              currentEventDate.setDate(baseRollingDate.getDate() + (i * freq));
              events.push({ 
                  title: `${option.name} (C${i+1})`, 
                  description: isOFS ? '卵巢功能抑制针剂注射' : `${option.description} - 第 ${i+1} 周期`, 
                  date: formatDate(currentEventDate), 
                  type: isOFS ? 'ofs' : option.type as any, 
                  completed: false, 
                  dosageDetails: option.drugs?.map(dr => `${dr.name} ${dr.lockedDose || (dr.standardDose + dr.unit)}`).join(' + ') 
              });
          }
      } 
      // 2. 口服 CDK4/6 每日排程 (仅标注用药日)
      else if (option.id.startsWith('cdk_') && option.id !== 'cdk_none') {
          const isContinuous = option.id === 'cdk_abe'; 
          const durationDays = 365; 
          
          let cdkRolling = new Date(baseRollingDate.getTime());
          for (let dIdx = 0; dIdx < durationDays; dIdx++) {
              const cycleDay = (dIdx % 28) + 1; 
              const isOnDrug = isContinuous || cycleDay <= 21; 

              if (isOnDrug) {
                  events.push({ 
                      title: `口服 ${option.name}`, 
                      description: `周期 D${cycleDay}`, 
                      date: formatDate(cdkRolling), 
                      type: 'cdk46', 
                      completed: false, 
                      dosageDetails: option.drugs?.map(dr => `${dr.name} ${dr.lockedDose || (dr.standardDose + dr.unit)}`).join(' ')
                  });
              }
              // 移除了停药日(D22-D28)的标注逻辑
              cdkRolling.setDate(cdkRolling.getDate() + 1);
          }
      }
      // 3. 口服内分泌药物 (AI/TAM/EXE)
      else if (option.id.startsWith('oral_')) {
          let oralRolling = new Date(baseRollingDate.getTime());
          for (let i = 0; i < 365; i++) { 
              events.push({ 
                  title: `口服 ${option.name}`, 
                  description: `内分泌维持治疗`, 
                  date: formatDate(oralRolling), 
                  type: 'endocrine', 
                  completed: false, 
                  dosageDetails: option.drugs?.map(dr => `${dr.name} 每日口服`).join(' ') 
              });
              oralRolling.setDate(oralRolling.getDate() + 1);
          }
      }
    });
    
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setGeneratedEvents(events);
    setIsPreviewing(true);
  };

  const categories = [
    { key: 'chemo', label: '化疗起始' },
    { key: 'target', label: '靶向起始' },
    { key: 'cdk46', label: 'CDK4/6 起始' },
    { key: 'ofs', label: 'OFS 起始' },
    { key: 'oral', label: '内分泌起始' }
  ];

  return (
    <div className={`mt-6 p-4 rounded-xl border ${isLocked ? 'bg-gray-50 border-gray-100' : 'bg-white border-medical-100 shadow-sm'}`}>
      <div className="text-sm font-bold text-gray-700 mb-4 uppercase tracking-tight">治疗日程同步设定</div>
      <div className="grid grid-cols-1 gap-2 mb-5">
        {categories.map(cat => (
          <div key={cat.key} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
            <label className="text-[10px] font-bold text-gray-400 uppercase">{cat.label}</label>
            <input 
              type="date" 
              disabled={isLocked} 
              className="p-1 text-xs border rounded bg-white outline-none focus:ring-1 focus:ring-medical-500" 
              value={startDates[cat.key]} 
              onChange={e => setStartDates({...startDates, [cat.key]: e.target.value})} 
            />
          </div>
        ))}
      </div>
      {!isPreviewing ? (
          <button onClick={handleGenerate} className="w-full py-3 bg-medical-50 text-medical-700 border border-medical-200 rounded-lg text-xs font-bold active:scale-[0.98]">生成首年治疗日程</button>
      ) : (
          <div className="space-y-3">
              <div className="max-h-64 overflow-y-auto bg-gray-50 p-2 rounded-lg border text-[10px] space-y-1">
                  <div className="text-gray-400 font-bold mb-2">预览 (前 20 条):</div>
                  {generatedEvents.slice(0, 20).map((e, i) => (
                      <div key={i} className="bg-white p-2 rounded flex justify-between border-l-2 border-medical-400 shadow-sm">
                          <span><b>{e.date}</b>: {e.title}</span>
                      </div>
                  ))}
                  {generatedEvents.length > 20 && <div className="text-center text-gray-300 py-1">... 更多记录已准备就绪 ...</div>}
              </div>
              <div className="flex gap-2">
                  <button onClick={() => setIsPreviewing(false)} className="flex-1 py-2.5 rounded-lg text-xs font-bold bg-gray-100 text-gray-500">修改</button>
                  <button onClick={() => { onSaveEvents(generatedEvents); setIsPreviewing(false); setIsSuccess(true); setTimeout(() => setIsSuccess(false), 3000); }} className="flex-1 py-2.5 bg-medical-600 text-white rounded-lg text-xs font-bold shadow-md">保存并同步</button>
              </div>
          </div>
      )}
      {isSuccess && <div className="mt-2 p-2 bg-green-50 text-green-700 text-xs font-bold rounded text-center animate-fade-in">日程已更新</div>}
    </div>
  );
};
