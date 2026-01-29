
import React, { useState, useEffect } from 'react';
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, RegimenOption, SelectedRegimens, TreatmentEvent, DrugDetail, MolecularSubtype } from '../types';
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
  // 仅保留基础病理指标的局部编辑状态
  const [localMarkers, setLocalMarkers] = useState<ClinicalMarkers>(patient.markers);
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(patient.selectedPlanId);
  
  // 核心：方案数据必须直接从 patient prop 获取，防止状态不同步
  const isLocked = !!patient.isPlanLocked;
  const detailedPlan = patient.detailedPlan;
  const selectedRegimens = patient.selectedRegimens || {};
  const options = patient.treatmentOptions || [];

  // 获取显示剂量
  const getDoseDisplay = (drug: DrugDetail, isInitial: boolean = false): string => {
    if (isInitial && drug.lockedLoadingDose) return drug.lockedLoadingDose;
    if (!isInitial && drug.lockedDose) return drug.lockedDose;

    const h = patient.height || 0;
    const w = patient.weight || 0;
    if (h <= 0 || w <= 0) return "--";

    const bsa = Math.max(0, 0.0061 * h + 0.0128 * w - 0.1529);
    const doseToUse = (isInitial && drug.loadingDose) ? drug.loadingDose : drug.standardDose;
    
    let val = 0;
    const unit = drug.unit.toUpperCase();
    
    if (unit.includes('M2') || unit.includes('M²')) {
      val = Math.round(doseToUse * bsa);
    } else if (unit.includes('KG')) {
      val = Math.round(doseToUse * w);
    } else if (unit === 'AUC') {
      const scrVal = parseFloat(localMarkers.serumCreatinine || '0');
      if (scrVal > 0) {
        const age = patient.age || 50;
        const gfr = ((140 - age) * w * 1.04) / scrVal;
        val = Math.round(doseToUse * (gfr + 25));
      } else return "需肌酐";
    } else {
      val = doseToUse;
    }
    return val > 0 ? `${val} ${unit === 'AUC' ? 'mg' : unit.replace(/\/.*/, '')}` : "--";
  };

  const handleConfirmLock = () => {
    if (!detailedPlan) {
      alert("请先完成第2步：生成具体用药。");
      return;
    }
    if (!patient.height || !patient.weight) {
      alert("锁定方案前，必须录入患者身高和体重，以固化药物剂量。");
      return;
    }
    
    if (window.confirm("确定锁定该治疗方案吗？\n1. 所有病理指标将固化不可改\n2. 药物剂量将根据当前体表面积永久锁定\n3. 日程表将自动生成预览。")) {
      const planToLock: DetailedRegimenPlan = JSON.parse(JSON.stringify(detailedPlan));
      
      const lockRegimen = (opt: RegimenOption) => {
        if (opt.drugs) {
          opt.drugs.forEach(d => {
            d.lockedDose = getDoseDisplay(d, false);
            if (d.loadingDose) d.lockedLoadingDose = getDoseDisplay(d, true);
          });
        }
        if (opt.stages) {
          opt.stages.forEach(s => {
            s.drugs.forEach(d => {
              d.lockedDose = getDoseDisplay(d, false);
              if (d.loadingDose) d.lockedLoadingDose = getDoseDisplay(d, true);
            });
          });
        }
      };

      const categories = ['chemoOptions', 'endocrineOptions', 'targetOptions', 'immuneOptions'] as const;
      categories.forEach(cat => {
        const selId = selectedRegimens[cat.replace('Options', 'Id') as keyof SelectedRegimens];
        planToLock[cat].forEach(opt => { if (opt.id === selId) lockRegimen(opt); });
      });

      onSaveDetailedPlan(planToLock, selectedRegimens, true, localMarkers);
      alert("✅ 方案锁定成功！剂量已固化。");
    }
  };

  const handleUpdateMarkerField = (field: keyof ClinicalMarkers, value: any) => {
    if (isLocked) return;
    const newMarkers = { ...localMarkers, [field]: value };
    setLocalMarkers(newMarkers);
    onUpdateMarkers(newMarkers);
  };

  const handleGenerateOptions = () => {
    let subtype = MolecularSubtype.Unknown;
    const erPos = !localMarkers.erStatus.includes('0%');
    const her2Pos = localMarkers.her2Status.includes('3+');
    if (her2Pos) subtype = MolecularSubtype.HER2Positive;
    else if (!erPos) subtype = MolecularSubtype.TripleNegative;
    else subtype = MolecularSubtype.LuminalB;

    const newOptions = generateLocalTreatmentOptions({ ...patient, subtype, markers: localMarkers }, localMarkers);
    onSaveOptions(newOptions, newOptions.find(o => o.recommended)?.id);
  };

  const RegimenCard = ({ opt, typeKey }: { opt: RegimenOption, typeKey: keyof SelectedRegimens }) => {
    const isSelected = selectedRegimens[typeKey] === opt.id;
    if (isLocked && !isSelected) return null;
    return (
      <div 
        onClick={() => !isLocked && onSaveDetailedPlan(detailedPlan!, { ...selectedRegimens, [typeKey]: opt.id }, false)}
        className={`p-3 rounded-lg border transition-all cursor-pointer ${
          isSelected ? 'border-medical-500 bg-medical-50 shadow-sm' : 'border-gray-100 bg-white opacity-60'
        }`}
      >
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-sm text-gray-800">{opt.name}</span>
          {isSelected && isLocked && <span className="text-[9px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-bold">已固化</span>}
        </div>
        {isSelected && (
          <div className="space-y-1 mt-2">
            {(opt.drugs || opt.stages?.[0]?.drugs)?.map((drug, i) => (
              <div key={i} className="flex justify-between text-[11px] bg-white/60 p-1.5 rounded border border-white">
                <span className="text-gray-600">{drug.name}</span>
                <span className={`font-bold ${isLocked ? 'text-green-600' : 'text-medical-600'}`}>{getDoseDisplay(drug)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const optionsToCalculate = detailedPlan ? [
    detailedPlan.chemoOptions.find(o => o.id === selectedRegimens.chemoId),
    detailedPlan.endocrineOptions.find(o => o.id === selectedRegimens.endocrineId),
    detailedPlan.targetOptions.find(o => o.id === selectedRegimens.targetId),
    detailedPlan.immuneOptions.find(o => o.id === selectedRegimens.immuneId)
  ].filter(Boolean) as RegimenOption[] : [];

  return (
    <div className="space-y-6 pb-20">
      <section className={`p-4 rounded-xl border transition-all ${isLocked ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-100 shadow-sm'}`}>
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex justify-between">
          临床指标
          {isLocked && <span className="text-xs text-gray-400 font-normal">指标已随方案锁定</span>}
        </h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">ER 状态</label>
            <select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white" value={localMarkers.erStatus} onChange={(e) => handleUpdateMarkerField('erStatus', e.target.value)}>
              <option value="0%">0% (阴性)</option><option value="1%-10%">1%-10%</option><option value="10%-50%">10%-50%</option><option value=">50%">&gt;50%</option>
            </select>
          </div>
          <div>
             <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">HER2</label>
             <select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white" value={localMarkers.her2Status} onChange={(e) => handleUpdateMarkerField('her2Status', e.target.value)}>
               <option value="0">0 (阴性)</option><option value="1+">1+ (阴性)</option><option value="2+">2+ (FISH待查)</option><option value="3+">3+ (阳性)</option>
             </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 mb-1 uppercase">Ki-67 (%)</label>
            <input type="number" disabled={isLocked} className="w-full p-2 text-sm border rounded" value={localMarkers.ki67.replace('%', '')} onChange={(e) => handleUpdateMarkerField('ki67', e.target.value + '%')} />
          </div>
          <div className="col-span-1">
             <label className="block text-[10px] font-bold text-blue-700 mb-1 uppercase">血肌酐 (umol/L)</label>
             <input type="number" disabled={isLocked} className="w-full p-2 text-sm border border-blue-200 rounded" value={localMarkers.serumCreatinine || ''} onChange={(e) => handleUpdateMarkerField('serumCreatinine', e.target.value)} />
          </div>
        </div>
        {!isLocked && options.length === 0 && (
          <button onClick={handleGenerateOptions} className="w-full mt-4 py-3 bg-medical-600 text-white rounded-lg text-sm font-bold shadow-md">1. 智能分析推荐路径</button>
        )}
      </section>

      {!isLocked && options.length > 0 && (
        <section className="space-y-2">
          {options.map(o => (
            <div key={o.id} onClick={() => setSelectedPlanId(o.id)} className={`p-3 border-2 rounded-xl cursor-pointer transition-all ${selectedPlanId === o.id ? 'border-medical-600 bg-medical-50' : 'border-transparent bg-white opacity-60'}`}>
              <div className="font-bold text-sm">{o.title}</div>
              <div className="text-[11px] text-gray-500 mt-1">{o.description}</div>
            </div>
          ))}
          <button onClick={() => {
            const sel = options.find(o => o.id === selectedPlanId);
            if (sel) {
              const plan = generateLocalDetailedRegimens(patient, localMarkers, sel);
              onSaveDetailedPlan(plan, { chemoId: plan.chemoOptions[0]?.id, endocrineId: plan.endocrineOptions[0]?.id, targetId: plan.targetOptions[0]?.id, immuneId: plan.immuneOptions[0]?.id }, false, localMarkers);
            }
          }} className="w-full py-2.5 bg-accent-600 text-white rounded-lg text-xs font-bold">2. 生成具体用药方案</button>
        </section>
      )}

      {detailedPlan && (
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-gray-800">方案细节与剂量固化</h3>
          {detailedPlan.chemoOptions.length > 0 && (<div><div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">化疗/新辅助</div><div className="space-y-2">{detailedPlan.chemoOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="chemoId" />)}</div></div>)}
          {detailedPlan.targetOptions.length > 0 && (<div><div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">靶向治疗</div><div className="space-y-2">{detailedPlan.targetOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="targetId" />)}</div></div>)}
          
          {optionsToCalculate.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-6">
              <DosageCalculator options={optionsToCalculate} initialHeight={patient.height} initialWeight={patient.weight} onUpdateStats={(h, w) => onUpdatePatientStats?.(h, w)} patientAge={patient.age} scr={localMarkers.serumCreatinine} isLocked={isLocked} />
              <ScheduleGenerator selectedOptions={optionsToCalculate} onSaveEvents={onBatchAddEvents || (() => {})} patientHeight={patient.height} patientWeight={patient.weight} patientAge={patient.age} scr={localMarkers.serumCreatinine} isLocked={isLocked} />
              {!isLocked && <button onClick={handleConfirmLock} className="w-full py-4 bg-green-600 text-white rounded-xl text-sm font-bold shadow-lg">3. 锁定方案并固化剂量</button>}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
