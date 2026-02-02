
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
    cdk46: new Date().toISOString().split('T')[0],
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
      const type = option.type;
      const dateKey = type; 

      const frequency = option.frequencyDays || 21;
      const startDateStr = startDates[dateKey] || startDates.chemo;
      const [y, m, d] = startDateStr.split('-').map(Number);
      
      if (isNaN(y) || isNaN(m) || isNaN(d)) return;

      let rollingDate = new Date(y, m - 1, d);

      // 特殊逻辑：内分泌（OFS + AI）
      if (type === 'endocrine') {
        const ofsDrug = option.drugs?.find(d => d.name.includes('戈舍瑞林') || d.name.includes('亮丙瑞林'));
        const oralDrug = option.drugs?.find(d => !d.name.includes('戈舍瑞林') && !d.name.includes('亮丙瑞林'));
        
        // 1. 生成 OFS 针剂节点 (根据 frequency 判断 28天 或 84天)
        if (ofsDrug) {
            const cycles = ofsDrug.name.includes('3月') || frequency > 30 ? 4 : 13; // 3月剂型生成一年量约为4-5次
            let ofsDate = new Date(rollingDate.getTime());
            for (let i = 0; i < (option.totalCycles || cycles); i++) {
                events.push({
                    title: `${ofsDrug.name} 注射`,
                    description: `OFS 卵巢功能抑制 (${frequency}天/针)`,
                    date: formatDate(ofsDate),
                    type: 'endocrine',
                    completed: false,
                    dosageDetails: `${ofsDrug.name} ${ofsDrug.standardDose}${ofsDrug.unit}`
                });
                ofsDate.setDate(ofsDate.getDate() + frequency);
            }
        }

        // 2. 生成口服药起始节点
        if (oralDrug) {
            events.push({
                title: `${oralDrug.name} 开始口服`,
                description: '每日口服一次',
                date: startDateStr,
                type: 'endocrine',
                completed: false,
                dosageDetails: `${oralDrug.name} ${oralDrug.standardDose}${oralDrug.unit}`
            });
            // 额外增加每月的维持节点提示
            let oralMonthDate = new Date(rollingDate.getTime());
            for (let i = 1; i <= 12; i++) {
                oralMonthDate.setMonth(oralMonthDate.getMonth() + 1);
                events.push({
                    title: `${oralDrug.name} 维持治疗 (M${i})`,
                    description: '请确认足量服用',
                    date: formatDate(oralMonthDate),
                    type: 'endocrine',
                    completed: false,
                    dosageDetails: `${oralDrug.name} 每日口服`
                });
            }
        }
        return;
      }

      // 3. CDK4/6 抑制剂逻辑
      if (type === 'cdk46') {
        events.push({
            title: `${option.name} 开始口服`,
            description: option.cycle,
            date: startDateStr,
            type: 'cdk46',
            completed: false,
            dosageDetails: option.drugs?.map(d => getDoseString(d, true)).join(' + ')
        });
        // 生成每28天的随访/领药节点
        let cdkDate = new Date(rollingDate.getTime());
        for (let i = 1; i <= 12; i++) {
            cdkDate.setDate(cdkDate.getDate() + 28);
            events.push({
                title: `${option.name} 维持治疗 (周期 ${i + 1})`,
                description: '注意观察骨髓抑制/腹泻等副作用',
                date: formatDate(cdkDate),
                type: 'cdk46',
                completed: false,
                dosageDetails: option.drugs?.map(d => getDoseString(d, false)).join(' + ')
            });
        }
        return;
      }

      // 4. 标准周期性治疗 (化疗/靶向)
      if (option.stages && option.stages.length > 0) {
        option.stages.forEach((stage, sIdx) => {
          for (let i = 0; i < stage.cycles; i++) {
            const isFirstOfAll = (sIdx === 0 && i === 0);
            const currentEventDate = new Date(rollingDate.getTime());
            events.push({
              title: `${stage.name} (C${i + 1})`,
              description: option.name,
              date: formatDate(currentEventDate),
              type: type as any,
              completed: false,
              dosageDetails: stage.drugs.map(drug => getDoseString(drug, isFirstOfAll)).join(' + ')
            });
            rollingDate.setDate(rollingDate.getDate() + frequency);
          }
        });
      } else {
        const cyclesToGenerate = option.totalCycles || 1;
        for (let i = 0; i < cyclesToGenerate; i++) {
          const currentEventDate = new Date(rollingDate.getTime());
          events.push({
              title: `${option.name} (C${i + 1})`,
              description: option.cycle,
              date: formatDate(currentEventDate),
              type: type as any,
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

  const activeTypes = Array.from(new Set(selectedOptions.map(o => o.type)));

  return (
    <div className={`mt-6 p-4 rounded-xl border ${isLocked ? 'bg-blue-50/10 border-blue-100' : 'bg-white border-medical-100 shadow-sm'}`}>
      <div className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
        <svg className="w-4 h-4 text-medical-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        分项起始日期设置
      </div>
      
      <div className="space-y-4 mb-5">
        {activeTypes.map(type => (
            <div key={type} className={`p-2.5 rounded-lg border flex items-center justify-between gap-4 ${type === 'cdk46' ? 'bg-orange-50 border-orange-100' : type === 'endocrine' ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50 border-gray-200'}`}>
                <label className={`text-[10px] font-bold uppercase min-w-[80px] ${type === 'cdk46' ? 'text-orange-600' : type === 'endocrine' ? 'text-indigo-600' : 'text-gray-500'}`}>
                    {type === 'chemo' ? '化疗/新辅助' : 
                     type === 'endocrine' ? '内分泌/OFS' : 
                     type === 'target' ? 'Anti-HER2靶向' : 
                     type === 'cdk46' ? 'CDK4/6i强化' : type}
                </label>
                <input type="date" disabled={isLocked} className="flex-1 p-1.5 text-xs border rounded bg-white outline-none focus:ring-1 focus:ring-medical-500" value={startDates[type] || ''} onChange={e => setStartDates({...startDates, [type]: e.target.value})} />
            </div>
        ))}
      </div>

      {isSuccess && <div className="mb-4 p-2 bg-green-100 text-green-700 text-[10px] font-bold rounded text-center animate-bounce">✅ 治疗日程已成功生成！</div>}

      {!isPreviewing ? (
          <button onClick={handleGenerate} className="w-full py-3 bg-medical-50 text-medical-700 border border-medical-100 rounded-lg text-xs font-bold active:scale-[0.98] transition-all">
            1. 自动计算并预览排程节点
          </button>
      ) : (
          <div className="space-y-3">
              <div className="max-h-56 overflow-y-auto bg-gray-50 p-3 rounded-lg border text-[10px] space-y-1.5 shadow-inner">
                  {generatedEvents.map((e, i) => (
                      <div key={i} className={`bg-white p-2.5 rounded shadow-xs border-l-4 flex justify-between items-center ${e.type === 'cdk46' ? 'border-orange-500' : e.type === 'endocrine' ? 'border-indigo-500' : e.type === 'target' ? 'border-pink-500' : 'border-medical-500'}`}>
                          <div className="flex flex-col">
                              <span className="font-bold">{e.date}</span>
                              <span className="text-gray-600">{e.title}</span>
                          </div>
                          <span className={`font-mono text-[9px] truncate ml-4 max-w-[150px] ${e.type === 'cdk46' ? 'text-orange-600' : e.type === 'endocrine' ? 'text-indigo-600' : 'text-gray-400'}`}>
                              {e.dosageDetails}
                          </span>
                      </div>
                  ))}
              </div>
              <div className="flex gap-2">
                  <button onClick={() => setIsPreviewing(false)} className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-600">返回修改</button>
                  <button onClick={() => { onSaveEvents(generatedEvents); setIsPreviewing(false); setIsSuccess(true); setTimeout(() => setIsSuccess(false), 3000); }} className="flex-1 py-2.5 bg-medical-600 text-white rounded-xl text-xs font-bold shadow-md">2. 确认并写入患者档案</button>
              </div>
          </div>
      )}
    </div>
  );
};
