
import React, { useState, useEffect } from 'react';
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, RegimenOption, SelectedRegimens, TreatmentEvent, DrugDetail } from '../types';
import { generateLocalTreatmentOptions, generateLocalDetailedRegimens } from '../services/localMedicalRules';
import { DosageCalculator } from './DosageCalculator';
import { ScheduleGenerator } from './ScheduleGenerator';

interface AITreatmentAssistantProps {
patient: Patient;
onUpdateMarkers: (markers: ClinicalMarkers) => void;
onSaveOptions: (options: TreatmentOption[], selectedId: string | undefined) => void;
onSaveDetailedPlan: (plan: DetailedRegimenPlan, selectedRegimens: SelectedRegimens, isLocked?: boolean, markersToSave?: ClinicalMarkers) => void;
onUpdatePatientStats?: (height: number, weight: number) => void;
onBatchAddEvents?: (events: Omit<TreatmentEvent, 'id'>[]) => void;
}

export const AITreatmentAssistant: React.FC<AITreatmentAssistantProps> = ({
patient,
onUpdateMarkers,
onSaveOptions,
onSaveDetailedPlan,
onUpdatePatientStats,
onBatchAddEvents
}) => {
const [localMarkers, setLocalMarkers] = useState<ClinicalMarkers>(patient.markers);
const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(patient.selectedPlanId);
const [options, setOptions] = useState<TreatmentOption[]>(patient.treatmentOptions || []);
const [detailedPlan, setDetailedPlan] = useState<DetailedRegimenPlan | undefined>(patient.detailedPlan);
const [selectedRegimens, setSelectedRegimens] = useState<SelectedRegimens>(patient.selectedRegimens || {});

const isLocked = patient.isPlanLocked;

// 核心计算函数：确保在锁定和非锁定状态下表现一致
const calculateDoseValue = (drug: DrugDetail, p: Patient, currentMarkers: ClinicalMarkers, isInitial: boolean = false): string | null => {
  // 1. 如果已经有了锁定值，直接返回锁定值（不分是否首剂，因为锁定值本身已包含单位）
  if (isInitial && drug.lockedLoadingDose) return drug.lockedLoadingDose;
  if (!isInitial && drug.lockedDose) return drug.lockedDose;
  
  // 2. 如果没有锁定值，进行实时计算
  const h = p.height;
  const w = p.weight;
  if (!h || !w || h <= 0 || w <= 0) return null;

  const bsa = 0.0061 * h + 0.0128 * w - 0.1529;
  const bsaFixed = bsa > 0 ? bsa : 0;
  
  const doseToUse = (isInitial && drug.loadingDose) ? drug.loadingDose : drug.standardDose;
  let val = 0;
  
  if (drug.unit === 'mg/m²' || drug.unit === 'mg/m2') val = Math.round(doseToUse * bsaFixed);
  else if (drug.unit === 'mg/kg') val = Math.round(doseToUse * w);
  else if (drug.unit === 'mg') val = doseToUse; 
  else if (drug.unit === 'AUC') {
      const scr = parseFloat(currentMarkers.serumCreatinine || '0');
      if (scr > 0) {
          const gfr = ((140 - p.age) * w * 1.04) / scr;
          val = Math.round(doseToUse * (gfr + 25));
      } else return null;
  }
  else return null; 

  return `${val} mg`;
};

const handleGenerateHighLevel = () => {
if (isLocked) return;
onUpdateMarkers(localMarkers);
const generatedOptions = generateLocalTreatmentOptions(patient, localMarkers);
if (generatedOptions.length > 0) {
      setOptions(generatedOptions);
      const recommended = generatedOptions.find(o => o.recommended);
      const newSelectedId = recommended ? recommended.id : generatedOptions[0].id;
      setSelectedPlanId(newSelectedId);
      onSaveOptions(generatedOptions, newSelectedId);
  }
};

const handleGenerateDetailed = () => {
if (isLocked || !selectedPlanId) return;
const selectedOpt = options.find(o => o.id === selectedPlanId);
if (!selectedOpt) return;
const plan = generateLocalDetailedRegimens(patient, localMarkers, selectedOpt);
if (plan) {
    setDetailedPlan(plan);
    const initialSelection: SelectedRegimens = {};
    if (plan.chemoOptions.length > 0) initialSelection.chemoId = plan.chemoOptions.find(o => o.recommended)?.id || plan.chemoOptions[0].id;
    if (plan.endocrineOptions.length > 0) initialSelection.endocrineId = plan.endocrineOptions.find(o => o.recommended)?.id || plan.endocrineOptions[0].id;
    if (plan.targetOptions.length > 0) initialSelection.targetId = plan.targetOptions.find(o => o.recommended)?.id || plan.targetOptions[0].id;
    if (plan.immuneOptions.length > 0) initialSelection.immuneId = plan.immuneOptions.find(o => o.recommended)?.id || plan.immuneOptions[0].id;
    setSelectedRegimens(initialSelection);
}
};

const handleConfirmAndSave = () => {
if (!detailedPlan) return;
if (!patient.height || !patient.weight) {
    alert("请完善身高体重后再锁定方案。");
    return;
}
if (window.confirm("确认锁定方案？锁定后药物剂量将固定为当前数值，临床指标将不可更改。")) {
      // 深度克隆当前方案
      const planToSave: DetailedRegimenPlan = JSON.parse(JSON.stringify(detailedPlan));
      
      const lockDosesInType = (options: RegimenOption[], selectedId?: string) => {
          options.forEach(opt => {
              // 仅锁定当前选中的药物
              if (opt.id === selectedId && opt.drugs) {
                  opt.drugs.forEach(drug => {
                      // 锁定维持剂量
                      const lockedVal = calculateDoseValue(drug, patient, localMarkers, false);
                      if (lockedVal) drug.lockedDose = lockedVal;
                      
                      // 锁定首剂加量 (如有)
                      if (drug.loadingDose) {
                          const lockedLoadingVal = calculateDoseValue(drug, patient, localMarkers, true);
                          if (lockedLoadingVal) drug.lockedLoadingDose = lockedLoadingVal;
                      }
                  });
              }
          });
      };
      
      lockDosesInType(planToSave.chemoOptions, selectedRegimens.chemoId);
      lockDosesInType(planToSave.endocrineOptions, selectedRegimens.endocrineId);
      lockDosesInType(planToSave.targetOptions, selectedRegimens.targetId);
      lockDosesInType(planToSave.immuneOptions, selectedRegimens.immuneId);

      // 同步保存 markers 确保锁定时的病理环境也被记录
      onSaveDetailedPlan(planToSave, selectedRegimens, true, localMarkers);
      setDetailedPlan(planToSave);
  }
};

const handleUnlock = () => {
    if (window.confirm("解锁后，固定的药物剂量将被清除并恢复实时计算。是否确认解锁？")) {
        const unlockedPlan: DetailedRegimenPlan = JSON.parse(JSON.stringify(detailedPlan));
        const unlockDoses = (opts: RegimenOption[]) => opts.forEach(o => o.drugs?.forEach(d => {
            delete d.lockedDose;
            delete d.lockedLoadingDose;
        }));
        unlockDoses(unlockedPlan.chemoOptions);
        unlockDoses(unlockedPlan.endocrineOptions);
        unlockDoses(unlockedPlan.targetOptions);
        unlockDoses(unlockedPlan.immuneOptions);
        
        onSaveDetailedPlan(unlockedPlan, selectedRegimens, false, localMarkers);
        setDetailedPlan(unlockedPlan);
    }
};

const RegimenSection = ({ title, options, typeKey }: { title: string, options: RegimenOption[], typeKey: keyof SelectedRegimens }) => {
if (!options || options.length === 0) return null;
return (
<div className="mb-6">
<h4 className="text-sm font-bold text-gray-500 mb-3 flex items-center">
<span className="w-2 h-2 rounded-full bg-medical-400 mr-2"></span>
{title}
</h4>
<div className="grid grid-cols-1 gap-3">
{options.map(opt => {
const isSelected = selectedRegimens[typeKey] === opt.id;
if (isLocked && !isSelected) return null;
return (
                      <div 
                        key={opt.id}
                        onClick={() => !isLocked && setSelectedRegimens({...selectedRegimens, [typeKey]: opt.id})}
                        className={`p-3 rounded-lg border transition-all ${
                            isSelected ? 'border-medical-500 bg-medical-50 shadow-sm' : 'border-gray-200 bg-white opacity-60'
                        }`}
                      >
                          <div className="flex justify-between items-center">
                              <span className="font-bold text-sm">{opt.name}</span>
                              <div className="flex gap-1">
                                {opt.recommended && !isLocked && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">推荐</span>}
                                {isSelected && isLocked && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center font-bold">已固化</span>}
                              </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">{opt.description}</p>
                          {isSelected && opt.drugs && (
                              <div className="mt-2 space-y-1">
                                  {opt.drugs.map((drug, idx) => {
                                      const currentDose = calculateDoseValue(drug, patient, localMarkers, false);
                                      return (
                                          <div key={idx} className="flex justify-between text-[11px] bg-white/50 p-1.5 rounded">
                                              <span>{drug.name} ({drug.standardDose} {drug.unit})</span>
                                              <span className={`font-bold ${isLocked ? 'text-blue-600' : 'text-medical-600'}`}>
                                                  {currentDose || '--'}
                                              </span>
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                  )
              })}
          </div>
      </div>
  );
  };

const selectedChemo = detailedPlan?.chemoOptions.find(c => c.id === selectedRegimens.chemoId);
const selectedEndocrine = detailedPlan?.endocrineOptions.find(c => c.id === selectedRegimens.endocrineId);
const selectedTarget = detailedPlan?.targetOptions.find(c => c.id === selectedRegimens.targetId);
const selectedImmune = detailedPlan?.immuneOptions.find(c => c.id === selectedRegimens.immuneId);
const optionsToCalculate = [selectedChemo, selectedEndocrine, selectedTarget, selectedImmune].filter(Boolean) as RegimenOption[];

return (
<div className="space-y-6 pb-10">
  <section className={`bg-white p-4 rounded-xl shadow-sm border transition-colors ${isLocked ? 'border-blue-200 bg-blue-50/10' : 'border-gray-100'}`}>
    <div className="flex justify-between items-center mb-4">
        <h3 className="text-md font-bold text-gray-800">临床病理指标</h3>
        {isLocked && (
            <button onClick={handleUnlock} className="text-[10px] bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center font-bold shadow-md active:scale-95 transition-all">
                <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>
                解锁编辑权限
            </button>
        )}
    </div>
    
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">ER 表达</label>
            <select className="w-full p-2 text-sm border rounded focus:ring-1 focus:ring-medical-500 outline-none bg-white" value={localMarkers.erStatus} onChange={e => setLocalMarkers({...localMarkers, erStatus: e.target.value})} disabled={isLocked}>
                <option value="0%">0% (阴性)</option>
                <option value="1%-10%">1%-10% (低表达)</option>
                <option value="10%-50%">10%-50% (中表达)</option>
                <option value=">50%">>50% (强阳性)</option>
            </select>
        </div>
        <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">PR 表达</label>
            <select className="w-full p-2 text-sm border rounded focus:ring-1 focus:ring-medical-500 outline-none bg-white" value={localMarkers.prStatus} onChange={e => setLocalMarkers({...localMarkers, prStatus: e.target.value})} disabled={isLocked}>
                <option value="0%">0% (阴性)</option>
                <option value="1%-10%">1%-10% (低表达)</option>
                <option value="10%-50%">10%-50% (中表达)</option>
                <option value=">50%">>50% (强阳性)</option>
            </select>
        </div>
        <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Ki-67 (%)</label>
            <input type="number" className="w-full p-2 text-sm border rounded focus:ring-1 focus:ring-medical-500 outline-none" value={localMarkers.ki67.replace('%','')} onChange={e => setLocalMarkers({...localMarkers, ki67: e.target.value+'%'})} disabled={isLocked} placeholder="25" />
        </div>
        <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">组织学分级</label>
            <select className="w-full p-2 text-sm border rounded focus:ring-1 focus:ring-medical-500 outline-none bg-white" value={localMarkers.histologicalGrade} onChange={e => setLocalMarkers({...localMarkers, histologicalGrade: e.target.value})} disabled={isLocked}>
                <option value="G1">G1</option><option value="G2">G2</option><option value="G3">G3</option>
            </select>
        </div>
        <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">HER2</label>
            <select className="w-full p-2 text-sm border rounded focus:ring-1 focus:ring-medical-500 outline-none bg-white" value={localMarkers.her2Status} onChange={e => setLocalMarkers({...localMarkers, her2Status: e.target.value})} disabled={isLocked}>
                <option value="0">0</option><option value="1+">1+</option><option value="2+">2+</option><option value="3+">3+</option>
            </select>
        </div>
        <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">绝经状态</label>
            <select className="w-full p-2 text-sm border rounded focus:ring-1 focus:ring-medical-500 outline-none bg-white" value={localMarkers.menopause ? 'yes' : 'no'} onChange={e => setLocalMarkers({...localMarkers, menopause: e.target.value === 'yes'})} disabled={isLocked}>
                <option value="no">未绝经</option><option value="yes">已绝经</option>
            </select>
        </div>
        <div className="col-span-2">
            <label className="block text-[10px] font-bold text-blue-500 mb-1 uppercase">血肌酐 (umol/L)</label>
            <input type="number" className="w-full p-2 text-sm border border-blue-200 rounded focus:ring-1 focus:ring-blue-500 outline-none bg-blue-50/30" value={localMarkers.serumCreatinine || ''} onChange={e => setLocalMarkers({...localMarkers, serumCreatinine: e.target.value})} placeholder="卡铂(AUC)计算必填" disabled={isLocked} />
        </div>
    </div>
    {!isLocked && <button onClick={handleGenerateHighLevel} className="w-full mt-4 bg-medical-600 text-white py-2.5 rounded-lg font-bold shadow-md active:scale-[0.98] transition-transform">1. 更新总体路径</button>}
  </section>

  {options.length > 0 && (
    <section className="animate-fade-in">
       <h3 className="font-bold text-gray-700 mb-3 flex items-center"><span className="mr-2">决策路径</span></h3>
       <div className="space-y-2">
         {options.map(o => {
             const isSelected = selectedPlanId === o.id;
             if (isLocked && !isSelected) return null;
             return (
                <div key={o.id} onClick={() => !isLocked && setSelectedPlanId(o.id)} className={`p-3 border-2 rounded-xl cursor-pointer transition-all ${isSelected ? 'border-medical-600 bg-medical-50 shadow-sm' : 'bg-white border-gray-100 opacity-60'}`}>
                    <div className="flex justify-between items-center">
                        <div className="font-bold text-sm text-gray-800">{o.title}</div>
                        {isSelected && isLocked && <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20"><path d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" /></svg>}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{o.description}</div>
                </div>
             );
         })}
       </div>
       {!isLocked && selectedPlanId && <button onClick={handleGenerateDetailed} className="mt-4 w-full py-2.5 bg-accent-600 text-white rounded-lg text-sm font-bold shadow-md active:scale-[0.98]">2. 生成详细用药方案</button>}
    </section>
  )}

  {detailedPlan && (
      <section className="bg-white p-4 rounded-xl border border-gray-100 animate-fade-in">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center">用药方案详情</h3>
          <RegimenSection title="化疗 (Chemo)" options={detailedPlan.chemoOptions} typeKey="chemoId" />
          <RegimenSection title="内分泌 (Endocrine)" options={detailedPlan.endocrineOptions} typeKey="endocrineId" />
          <RegimenSection title="靶向 (Target)" options={detailedPlan.targetOptions} typeKey="targetId" />
          <RegimenSection title="免疫 (Immune)" options={detailedPlan.immuneOptions} typeKey="immuneId" />

          {optionsToCalculate.length > 0 && (
             <div className="mt-8 pt-6 border-t border-gray-100">
                <DosageCalculator 
                    options={optionsToCalculate} 
                    initialHeight={patient.height} 
                    initialWeight={patient.weight} 
                    onUpdateStats={(h, w) => onUpdatePatientStats?.(h, w)} 
                    patientAge={patient.age}
                    scr={localMarkers.serumCreatinine}
                    isLocked={isLocked}
                />
                <ScheduleGenerator 
                    selectedOptions={optionsToCalculate} 
                    onSaveEvents={onBatchAddEvents || (() => {})} 
                    patientHeight={patient.height} 
                    patientWeight={patient.weight} 
                    patientAge={patient.age} 
                    scr={localMarkers.serumCreatinine}
                    isLocked={isLocked}
                />
                {!isLocked && (
                    <button 
                        onClick={handleConfirmAndSave} 
                        className="w-full mt-6 bg-green-600 text-white py-4 rounded-xl font-bold shadow-lg active:scale-[0.98] transition-all flex items-center justify-center"
                    >
                        确认方案并锁定剂量
                    </button>
                )}
             </div>
          )}
      </section>
  )}
</div>
);
};
