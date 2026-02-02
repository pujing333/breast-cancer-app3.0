
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
  const [localMarkers, setLocalMarkers] = useState<ClinicalMarkers>(patient.markers);
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(patient.selectedPlanId);
  
  useEffect(() => {
    setSelectedPlanId(patient.selectedPlanId);
  }, [patient.selectedPlanId]);

  const isLocked = !!patient.isPlanLocked;
  const detailedPlan = patient.detailedPlan;
  const selectedRegimens = patient.selectedRegimens || {};
  const options = patient.treatmentOptions || [];

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
    if (!detailedPlan) return;
    if (!patient.height || !patient.weight) {
      alert("请先录入患者身高和体重以计算剂量。");
      return;
    }
    if (window.confirm("确定锁定该治疗方案吗？方案一旦锁定，剂量将固化。")) {
      const planToLock: DetailedRegimenPlan = JSON.parse(JSON.stringify(detailedPlan));
      const processRegimen = (opt: RegimenOption) => {
        if (opt.drugs) {
          opt.drugs.forEach(d => {
            d.lockedDose = getDoseDisplay(d, false);
            if (d.loadingDose) d.lockedLoadingDose = getDoseDisplay(d, true);
          });
        }
      };
      ['chemoOptions', 'endocrineOptions', 'targetOptions', 'immuneOptions', 'cdk46Options'].forEach(cat => {
        const selId = (selectedRegimens as any)[cat.replace('Options', 'Id')];
        if (selId) {
          (planToLock as any)[cat].forEach((opt: RegimenOption) => {
            if (opt.id === selId) processRegimen(opt);
          });
        }
      });
      onSaveDetailedPlan(planToLock, selectedRegimens, true, localMarkers);
    }
  };

  const handleUpdateMarkerField = (field: keyof ClinicalMarkers, value: any) => {
    if (isLocked) return;
    const newMarkers = { ...localMarkers, [field]: value };
    setLocalMarkers(newMarkers);
    onUpdateMarkers(newMarkers);
  };

  const RegimenCard = ({ opt, typeKey }: { opt: RegimenOption, typeKey: keyof SelectedRegimens }) => {
    const isSelected = selectedRegimens[typeKey] === opt.id;
    if (isLocked && !isSelected) return null;

    return (
      <div 
        onClick={() => !isLocked && onSaveDetailedPlan(detailedPlan!, { ...selectedRegimens, [typeKey]: opt.id }, false)}
        className={`p-3 rounded-lg border transition-all cursor-pointer ${
            isSelected 
                ? 'border-medical-500 bg-medical-50 shadow-sm ring-1 ring-medical-200' 
                : 'border-gray-200 bg-white hover:border-medical-300'
        }`}
      >
        <div className="flex justify-between items-start mb-1">
          <div className="flex flex-col">
            <span className="font-bold text-sm text-gray-900">{opt.name}</span>
            <span className="text-[10px] text-gray-500">{opt.description}</span>
          </div>
          {isSelected ? (
              <span className="text-medical-600">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
              </span>
          ) : (
              <span className="w-5 h-5 border-2 border-gray-100 rounded-full"></span>
          )}
        </div>
        
        {isSelected && (
          <div className="mt-2 pt-2 border-t border-medical-100 space-y-1">
            {(opt.drugs || opt.stages?.[0]?.drugs)?.map((drug, i) => (
              <div key={i} className="flex justify-between text-[11px] items-center">
                <span className="text-gray-600 font-medium">{drug.name} <span className="text-gray-400 font-normal">({opt.cycle})</span></span>
                <span className={`font-bold ${isLocked ? 'text-green-600' : 'text-medical-600'}`}>{getDoseDisplay(drug, false)}</span>
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
    detailedPlan.cdk46Options.find(o => o.id === selectedRegimens.cdk46Id),
    detailedPlan.immuneOptions.find(o => o.id === selectedRegimens.immuneId)
  ].filter(Boolean) as RegimenOption[] : [];

  return (
    <div className="space-y-6 pb-20">
      <section className={`p-4 rounded-xl border transition-all ${isLocked ? 'bg-gray-50' : 'bg-white shadow-sm border-gray-100'}`}>
        <h3 className="text-sm font-bold text-gray-700 mb-4 flex justify-between items-center">
            临床依据 (TNM/分型/绝经/肾功)
            {isLocked && <span className="text-xs text-gray-400 font-normal">状态已锁定</span>}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-[10px] text-gray-400 font-bold uppercase">ER 状态</label><select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white" value={localMarkers.erStatus} onChange={(e) => handleUpdateMarkerField('erStatus', e.target.value)}><option value="">待录入</option><option value="0%">0%</option><option value="1%-10%">1%-10%</option><option value="10%-50%">10%-50%</option><option value=">50%">&gt;50%</option></select></div>
          <div><label className="text-[10px] text-gray-400 font-bold uppercase">绝经状态</label><select disabled={isLocked} className="w-full p-2 text-sm border border-medical-200 rounded bg-medical-50/30" value={localMarkers.menopause ? 'yes' : 'no'} onChange={(e) => handleUpdateMarkerField('menopause', e.target.value === 'yes')}><option value="no">绝经前</option><option value="yes">绝经后</option></select></div>
          <div><label className="text-[10px] text-gray-400 font-bold uppercase">HER2 状态</label><select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white" value={localMarkers.her2Status} onChange={(e) => handleUpdateMarkerField('her2Status', e.target.value)}><option value="">待录入</option><option value="0">0</option><option value="1+">1+</option><option value="2+">2+</option><option value="3+">3+</option></select></div>
          <div><label className="text-[10px] text-gray-400 font-bold uppercase">Ki-67 (%)</label><input type="number" disabled={isLocked} className="w-full p-2 text-sm border rounded" value={localMarkers.ki67.replace('%', '')} onChange={(e) => handleUpdateMarkerField('ki67', e.target.value + '%')} placeholder="20" /></div>
          <div><label className="text-[10px] text-gray-400 font-bold uppercase">cT (分期)</label><select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white" value={localMarkers.tumorSize} onChange={(e) => handleUpdateMarkerField('tumorSize', e.target.value)}><option value="">待选</option><option value="T1(≤2cm)">T1 (≤2cm)</option><option value="T2(2-5cm)">T2 (2-5cm)</option><option value="T3(>5cm)">T3 (>5cm)</option></select></div>
          <div><label className="text-[10px] text-gray-400 font-bold uppercase">cN (淋巴结)</label><select disabled={isLocked} className="w-full p-2 text-sm border rounded bg-white" value={localMarkers.nodeStatus} onChange={(e) => handleUpdateMarkerField('nodeStatus', e.target.value)}><option value="">待选</option><option value="N0(阴性)">N0 (阴性)</option><option value="N1(1-3个)">N1 (1-3个)</option><option value="N2(4-9个)">N2 (4-9个)</option></select></div>
          <div className="col-span-2">
            <label className="text-[10px] text-gray-400 font-bold uppercase">血肌酐 Scr (umol/L) - 用于AUC计算</label>
            <input type="number" disabled={isLocked} className="w-full p-2 text-sm border rounded" value={localMarkers.serumCreatinine || ''} onChange={(e) => handleUpdateMarkerField('serumCreatinine', e.target.value)} placeholder="如: 75" />
          </div>
        </div>
        {!isLocked && (
          <button onClick={() => {
            let subtype = MolecularSubtype.Unknown;
            const erStatus = localMarkers.erStatus || '';
            const her2Status = localMarkers.her2Status || '';
            const erPos = erStatus !== '' && erStatus !== '0%';
            const her2Pos = her2Status.includes('3+');
            
            if (her2Pos) subtype = MolecularSubtype.HER2Positive;
            else if (!erPos && erStatus !== '') subtype = MolecularSubtype.TripleNegative;
            else if (erPos) subtype = MolecularSubtype.LuminalB;

            const newOptions = generateLocalTreatmentOptions({ ...patient, subtype, markers: localMarkers }, localMarkers);
            onSaveOptions(newOptions, newOptions.find(o => o.recommended)?.id || newOptions[0]?.id);
          }} className="w-full mt-4 py-3 bg-medical-600 text-white rounded-lg text-sm font-bold shadow-md active:scale-95 transition-all">1. 开启智能路径分析</button>
        )}
      </section>

      {!isLocked && options.length > 0 && (
        <section className="space-y-3 animate-fade-in">
          <div className="text-xs font-bold text-gray-500 px-1 flex items-center gap-1">
             <span className="w-1.5 h-1.5 bg-medical-500 rounded-full"></span>
             请确认路径以生成具体处方：
          </div>
          {options.map(o => (
            <div key={o.id} onClick={() => setSelectedPlanId(o.id)} className={`p-4 border-2 rounded-xl cursor-pointer transition-all ${selectedPlanId === o.id ? 'border-medical-600 bg-medical-50 ring-2 ring-medical-100' : 'border-transparent bg-white shadow-sm'}`}>
              <div className="flex justify-between items-start mb-2">
                <div className="font-bold text-sm text-gray-900">{o.title}</div>
                {o.recommended && <span className="text-[9px] bg-medical-600 text-white px-2 py-0.5 rounded-full font-bold">优先推荐</span>}
              </div>
              <div className="text-[11px] text-gray-500 leading-relaxed">{o.description}</div>
            </div>
          ))}
          <button onClick={() => {
            const sel = options.find(o => o.id === selectedPlanId);
            if (sel) {
              const plan = generateLocalDetailedRegimens(patient, localMarkers, sel);
              onSaveDetailedPlan(plan, { chemoId: plan.chemoOptions[0]?.id, endocrineId: plan.endocrineOptions[0]?.id, targetId: plan.targetOptions[0]?.id, cdk46Id: plan.cdk46Options[0]?.id, immuneId: plan.immuneOptions[0]?.id }, false, localMarkers);
            } else {
              alert("请先从上方列表中选择一个治疗路径。");
            }
          }} className="w-full py-3 bg-accent-600 text-white rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-all">2. 生成具体用药及分段排程</button>
        </section>
      )}

      {detailedPlan && (
        <section className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-6 animate-fade-in">
          <h3 className="text-sm font-bold text-gray-800 border-b pb-2">用药方案库</h3>
          
          {detailedPlan.chemoOptions.length > 0 && (<div><div className="text-[10px] font-bold text-gray-400 mb-2 uppercase">化疗/新辅助方案</div><div className="grid grid-cols-1 gap-2">{detailedPlan.chemoOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="chemoId" />)}</div></div>)}
          
          {detailedPlan.targetOptions.length > 0 && (<div><div className="text-[10px] font-bold text-pink-500 mb-2 uppercase">Anti-HER2 靶向治疗</div><div className="grid grid-cols-1 gap-2">{detailedPlan.targetOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="targetId" />)}</div></div>)}
          
          {detailedPlan.cdk46Options.length > 0 && (<div><div className="text-[10px] font-bold text-orange-500 mb-2 uppercase">CDK4/6 抑制剂强化 (可选)</div><div className="grid grid-cols-1 gap-2">{detailedPlan.cdk46Options.map(o => <RegimenCard key={o.id} opt={o} typeKey="cdk46Id" />)}</div></div>)}
          
          {detailedPlan.endocrineOptions.length > 0 && (<div><div className="text-[10px] font-bold text-indigo-500 mb-2 uppercase">内分泌治疗 (OFS / AI / TAM)</div><div className="grid grid-cols-1 gap-2 h-64 overflow-y-auto pr-1">{detailedPlan.endocrineOptions.map(o => <RegimenCard key={o.id} opt={o} typeKey="endocrineId" />)}</div></div>)}
          
          {optionsToCalculate.length > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-100 space-y-6">
              <DosageCalculator options={optionsToCalculate} initialHeight={patient.height} initialWeight={patient.weight} onUpdateStats={(h, w) => onUpdatePatientStats?.(h, w)} patientAge={patient.age} scr={localMarkers.serumCreatinine} isLocked={isLocked} />
              <ScheduleGenerator selectedOptions={optionsToCalculate} onSaveEvents={onBatchAddEvents || (() => {})} patientHeight={patient.height} patientWeight={patient.weight} patientAge={patient.age} scr={localMarkers.serumCreatinine} isLocked={isLocked} />
              {!isLocked && <button onClick={handleConfirmLock} className="w-full py-4 bg-green-600 text-white rounded-xl text-sm font-bold shadow-lg active:scale-95 transition-all">3. 锁定方案并固化最终剂量</button>}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
