
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
  const [isSuccess, setIsSuccess] = useState(false);

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDoseString = (drug: DrugDetail, isInitial: boolean) => {
      if (isInitial && drug.lockedLoadingDose) return `${drug.name}(首) ${drug.lockedLoadingDose}`;
      if (!isInitial && drug.lockedDose) return `${drug.name} ${drug.lockedDose}`;
      
      const h = Number(patientHeight) || 0;
      const w = Number(patientWeight) || 0;
      const age = Number(patientAge) || 50;
      const bsa = Math.max(0, 0.0061 * h + 0.0128 * w - 0.1529);
      const doseToUse = (isInitial && drug.loadingDose) ? drug.loadingDose : drug.standardDose;
      const unit = drug.unit.toUpperCase();
      
      let val = 0;
      if (unit.includes('M2') || unit.includes('M²')) val = Math.round(doseToUse * bsa);
      else if (unit.includes('KG')) val = Math.round(doseToUse * w);
      else if (unit === 'AUC') {
          const scrVal = parseFloat(scr || '0');
          if (scrVal > 0) {
            const gfr = ((140 - age) * w * 1.04) / scrVal;
            val = Math.round(doseToUse * (gfr + 25));
          }
      } else val = doseToUse;

      return val > 0 ? `${drug.name}${isInitial && drug.loadingDose ? '(首)' : ''} ${val}mg` : `${drug.name} ${drug.standardDose}${drug.unit}`;
  };

  const handleGenerate = () => {
    const events: Omit<TreatmentEvent, 'id'>[] = [];
    
    selectedOptions.forEach(option => {
      const frequency = option.frequencyDays || 21;
      const startDateStr = startDates[option.type] || startDates.chemo;
      const [y, m, d] = startDateStr.split('-').map(Number);
      let rollingDate = new Date(y, m - 1, d);

      // 处理序贯分阶段方案 (如 AC-T)
      if (option.stages && option.stages.length > 0) {
        option.stages.forEach((stage, sIdx) => {
          for (let i = 0; i < stage.cycles; i++) {
            const isFirstOfAll = (sIdx === 0 && i === 0);
            const currentEventDate = new Date(rollingDate.getTime());
            
            events.push({
              title: `${stage.name} (C${i + 1})`,
              description: option.name,
              date: formatDate(currentEventDate),
              type: option.type as any,
              completed: false,
              dosageDetails: stage.drugs.map(drug => getDoseString(drug, isFirstOfAll)).join(' + ')
            });

            // 日期递增
            rollingDate.setDate(rollingDate.getDate() + frequency);
          }
        });
      } 
      // 处理单阶段循环方案
      else {
        for (let i = 0; i < (option.totalCycles || 1); i++) {
          const currentEventDate = new Date(rollingDate.getTime());
          events.push({
            title: frequency === 1 ? `${option.name}` : `${option.name} (C${i + 1})`,
            description: option.cycle,
            date: formatDate(currentEventDate),
            type: option.type as any,
            completed: false,
            dosageDetails: option.drugs?.map(drug => getDoseString(drug, i === 0)).join(' + ')
          });
          rollingDate.setDate(rollingDate.getDate() + frequency);
        }
      }
    });
    
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setGeneratedEvents(events);
    setIsPreviewing(true);
  };

  return (
    <div className={`mt-6 p-4 rounded-xl border ${isLocked ? 'bg-blue-50/10 border-blue-100' : 'bg-white border-medical-100 shadow-sm'}`}>
      <div className="text-sm font-bold text-gray-700 mb-4">日程排定预览</div>
      {isSuccess && <div className="mb-4 p-2 bg-green-100 text-green-700 text-[10px] font-bold rounded text-center">✅ 日程已成功同步至患者日历！</div>}
      <div className="space-y-4 mb-5">
        {Array.from(new Set(selectedOptions.map(o => o.type))).map(type => (
            <div key={type} className="p-2 rounded border bg-gray-50">
                <label className="block text-[10px] font-bold mb-1 uppercase text-gray-400">
                    {type === 'chemo' ? '化疗' : '其他'} 起始日期
                </label>
                <input type="date" className="w-full p-2 text-sm border rounded bg-white" value={startDates[type] || ''} onChange={e => setStartDates({...startDates, [type]: e.target.value})} />
            </div>
        ))}
      </div>
      {!isPreviewing ? (
          <button onClick={handleGenerate} className="w-full py-2.5 bg-medical-50 text-medical-700 border border-medical-100 rounded-lg text-xs font-bold">查看分阶段日程预览</button>
      ) : (
          <div className="space-y-3">
              <div className="max-h-48 overflow-y-auto bg-gray-50 p-2.5 rounded-lg border text-[10px] space-y-1">
                  {generatedEvents.map((e, i) => (
                      <div key={i} className="bg-white p-2 rounded shadow-xs border-l-2 border-medical-500 flex justify-between">
                          <span><b>{e.date}</b> {e.title}</span>
                          <span className="text-gray-400 font-mono truncate ml-2 max-w-[120px]">{e.dosageDetails}</span>
                      </div>
                  ))}
              </div>
              <div className="flex gap-2">
                  <button onClick={() => setIsPreviewing(false)} className="flex-1 py-2 rounded-lg text-xs font-bold bg-gray-100 text-gray-600">返回修改</button>
                  <button onClick={() => { onSaveEvents(generatedEvents); setIsPreviewing(false); setIsSuccess(true); setTimeout(() => setIsSuccess(false), 3000); }} className="flex-1 py-2 bg-medical-600 text-white rounded-lg text-xs font-bold shadow-md">确认并写入日程</button>
              </div>
          </div>
      )}
    </div>
  );
};
