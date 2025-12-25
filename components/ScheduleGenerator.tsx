
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
    immune: new Date().toISOString().split('T')[0]
  });
  const [generatedEvents, setGeneratedEvents] = useState<Omit<TreatmentEvent, 'id'>[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const getDoseString = (drug: DrugDetail, isInitial: boolean) => {
      // 锁定状态下的排程生成必须使用固化的剂量快照
      if (isInitial && drug.lockedLoadingDose) return `${drug.name}(首剂) ${drug.lockedLoadingDose}`;
      if (!isInitial && drug.lockedDose) return `${drug.name} ${drug.lockedDose}`;
      
      // 非锁定状态实时计算
      if (patientHeight && patientWeight) {
          const bsa = Math.max(0, 0.0061 * patientHeight + 0.0128 * patientWeight - 0.1529);
          const doseToUse = (isInitial && drug.loadingDose) ? drug.loadingDose : drug.standardDose;
          const label = (isInitial && drug.loadingDose) ? '(首剂)' : '';
          
          let val = 0;
          if (drug.unit === 'mg/m²' || drug.unit === 'mg/m2') val = Math.round(doseToUse * bsa);
          else if (drug.unit === 'mg/kg') val = Math.round(doseToUse * patientWeight);
          else if (drug.unit === 'AUC' && scr && patientAge) {
              const scrVal = parseFloat(scr);
              const gfr = ((140 - patientAge) * patientWeight * 1.04) / scrVal;
              val = Math.round(doseToUse * (gfr + 25));
          } else if (drug.unit === 'mg') val = doseToUse;

          return `${drug.name}${label} ${val}mg`;
      }
      return `${drug.name} ${drug.standardDose}${drug.unit}`;
  };

  const handleGenerate = () => {
    const events: Omit<TreatmentEvent, 'id'>[] = [];
    selectedOptions.forEach(option => {
      const cycles = option.totalCycles || 1;
      const frequency = option.frequencyDays || 0;
      const startDateStr = startDates[option.type] || startDates.chemo;
      const start = new Date(startDateStr);

      for (let i = 0; i < cycles; i++) {
        const isInitial = (i === 0);
        const eventDate = new Date(start);
        eventDate.setDate(start.getDate() + (i * frequency));
        
        const dosageInfo = option.drugs?.map(d => getDoseString(d, isInitial)).join(' + ');

        events.push({
          title: `${option.name} (第${i + 1}周期)`,
          description: `${option.cycle}`,
          date: eventDate.toISOString().split('T')[0],
          type: 'medication',
          completed: false,
          dosageDetails: dosageInfo
        });
      }
    });
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setGeneratedEvents(events);
    setIsPreviewing(true);
  };

  const typesPresent = Array.from(new Set(selectedOptions.map(o => o.type)));

  return (
    <div className={`mt-6 p-4 rounded-xl border transition-all ${isLocked ? 'bg-gray-50 border-gray-100 opacity-80' : 'bg-white border-medical-100 shadow-sm'}`}>
      <h3 className="text-sm font-bold mb-4 flex items-center text-gray-700">自动排程生成器</h3>
      
      <div className="space-y-4 mb-5">
        {typesPresent.map(type => (
            <div key={type}>
                <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">
                    {type === 'chemo' ? '化疗' : type === 'endocrine' ? '内分泌' : '靶向/免疫'} 开始日期
                </label>
                <input 
                  type="date" 
                  className="w-full p-2 text-sm border rounded bg-white" 
                  value={startDates[type] || ''} 
                  onChange={e => !isLocked && setStartDates({...startDates, [type]: e.target.value})} 
                  disabled={isLocked} 
                />
            </div>
        ))}
      </div>

      {!isPreviewing ? (
          <button 
            onClick={handleGenerate} 
            className="w-full py-2.5 bg-medical-50 text-medical-700 rounded-lg text-xs font-bold border border-medical-100 active:scale-95 transition-transform"
          >
              预览治疗日历 ({isLocked ? '读取固化剂量' : '实时计算剂量'})
          </button>
      ) : (
          <div className="space-y-3">
              <div className="max-h-48 overflow-y-auto bg-gray-50 p-2.5 rounded-lg text-[10px] space-y-1.5 border border-gray-100">
                  {generatedEvents.map((e, i) => (
                      <div key={i} className="bg-white p-2 rounded shadow-xs border-l-2 border-medical-500">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-gray-400 font-mono">{e.date}</span>
                            <span className="font-bold text-gray-700">{e.title}</span>
                          </div>
                          <div className="text-[9px] text-medical-600 truncate bg-medical-50/50 p-1 rounded italic">{e.dosageDetails}</div>
                      </div>
                  ))}
              </div>
              {!isLocked && (
                <div className="flex gap-2">
                    <button onClick={() => setIsPreviewing(false)} className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-xs font-bold">修改</button>
                    <button onClick={() => {onSaveEvents(generatedEvents); setIsPreviewing(false);}} className="flex-1 py-2 bg-medical-600 text-white rounded-lg text-xs font-bold">写入患者日程</button>
                </div>
              )}
          </div>
      )}
    </div>
  );
};
