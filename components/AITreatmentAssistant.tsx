
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

const InputField = ({
label,
value,
onChange,
placeholder,
disabled
}: {
label: string,
value: string,
onChange: (val: string) => void,
placeholder?: string,
disabled?: boolean
}) => (
<div className="mb-3">
<label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
<input
type="text"
className={`w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none transition-all ${disabled ? 'bg-gray-100 text-gray-500' : ''}`}
value={value}
onChange={(e) => onChange(e.target.value)}
placeholder={placeholder}
disabled={disabled}
/>
</div>
);

export const AITreatmentAssistant: React.FC<AITreatmentAssistantProps> = ({
patient,
onUpdateMarkers,
onSaveOptions,
onSaveDetailedPlan,
onUpdatePatientStats,
onBatchAddEvents
}) => {
const [localMarkers, setLocalMarkers] = useState<ClinicalMarkers>(patient.markers);
const [error, setError] = useState<string | null>(null);

// Step 1 State
const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(patient.selectedPlanId);
const [options, setOptions] = useState<TreatmentOption[]>(patient.treatmentOptions || []);

// Step 2 State
const [detailedPlan, setDetailedPlan] = useState<DetailedRegimenPlan | undefined>(patient.detailedPlan);
const [selectedRegimens, setSelectedRegimens] = useState<SelectedRegimens>(patient.selectedRegimens || {});

const isLocked = patient.isPlanLocked;

// Initialize selected regimens if plan exists but selection is empty (rare case fix)
useEffect(() => {
if (detailedPlan && Object.keys(selectedRegimens).length === 0) {
// ... (Optional: logic to auto-select if needed on load)
}
}, []);

// --- Logic Helpers ---

// Calculate dose utility (reused for locking)
const calculateDoseValue = (drug: DrugDetail, height: number, weight: number): string | null => {
  if (!height || !weight || height <= 0 || weight <= 0) return null;
  const bsa = 0.0061 * height + 0.0128 * weight - 0.1529;
  const bsaFixed = bsa > 0 ? bsa : 0;
  let val = 0;
  
  if (drug.unit === 'mg/m²' || drug.unit === 'mg/m2') val = Math.round(drug.standardDose * bsaFixed);
  else if (drug.unit === 'mg/kg') val = Math.round(drug.standardDose * weight);
  else if (drug.unit === 'mg') val = drug.standardDose; // Fixed dose support
  else return null; 

  return `${val} mg`;
};

// --- Handlers ---

const handleGenerateHighLevel = () => {
if (isLocked) return;
setError(null);
setDetailedPlan(undefined);
try {
onUpdateMarkers(localMarkers);
const generatedOptions = generateLocalTreatmentOptions(patient, localMarkers);
if (generatedOptions.length > 0) {
      setOptions(generatedOptions);
      const recommended = generatedOptions.find(o => o.recommended);
      const newSelectedId = recommended ? recommended.id : generatedOptions[0].id;
      setSelectedPlanId(newSelectedId);
      onSaveOptions(generatedOptions, newSelectedId);
  } else {
      setError("无法根据当前指标匹配到标准方案，请检查输入。");
  }
} catch (e: any) {
    setError(e.message || "生成失败");
}
};

const handleSelectPlan = (id: string) => {
if (isLocked) return;
setSelectedPlanId(id);
onSaveOptions(options, id);
};

const handleGenerateDetailed = () => {
if (isLocked) return;
if (!selectedPlanId) return;
const selectedOpt = options.find(o => o.id === selectedPlanId);
if (!selectedOpt) return;
setError(null);
try {
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
} catch (e: any) {
    setError(e.message || "生成详细方案失败");
}
};

const handleSelectRegimen = (type: keyof SelectedRegimens, id: string) => {
if (isLocked) return;
const newSelection = { ...selectedRegimens, [type]: id };
setSelectedRegimens(newSelection);
};

const handleConfirmAndSave = () => {
if (!detailedPlan) return;
if (!patient.height || !patient.weight) {
alert("请先完善患者身高体重信息，以便计算并锁定药物剂量。");
return;
}
if (window.confirm("确认锁定当前治疗方案吗？\n\n1. 药物剂量将根据当前体重固定。\n2. 输入的病理指标将被保存。\n3. 方案不可随意更改。")) {
      // Deep copy the plan to modify it without affecting state immediately
      const planToSave: DetailedRegimenPlan = JSON.parse(JSON.stringify(detailedPlan));
      
      // Iterate and lock doses for selected regimens
      const lockDoses = (options: RegimenOption[], selectedId?: string) => {
          const opt = options.find(o => o.id === selectedId);
          if (opt && opt.drugs) {
              opt.drugs.forEach(drug => {
                  const lockedVal = calculateDoseValue(drug, patient.height!, patient.weight!);
                  if (lockedVal) {
                      drug.lockedDose = lockedVal;
                  }
              });
          }
      };

      lockDoses(planToSave.chemoOptions, selectedRegimens.chemoId);
      lockDoses(planToSave.endocrineOptions, selectedRegimens.endocrineId);
      lockDoses(planToSave.targetOptions, selectedRegimens.targetId);
      lockDoses(planToSave.immuneOptions, selectedRegimens.immuneId);

      // Deep copy markers to ensure input values are saved
      const markersToSave = { ...localMarkers };

      // Save plan, selection, AND localMarkers
      onSaveDetailedPlan(planToSave, selectedRegimens, true, markersToSave);
      
      // Update local state to reflect the locked version
      setDetailedPlan(planToSave);
  }
};

const handleUnlock = () => {
if (window.confirm("确定要解锁方案吗？\n\n解锁后，您需要重新确认药物剂量。")) {
// Save with isLocked = false
if (detailedPlan) {
onSaveDetailedPlan(detailedPlan, selectedRegimens, false);
}
}
};

// --- UI Helpers ---
const getIcon = (type: string) => {
switch(type) {
case 'surgery':
return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758L4.879 4.879" />;
case 'chemo':
return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />;
case 'drug':
return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />;
default:
return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 00-2-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />;
}
};

const calculateDrugDose = (drug: DrugDetail, height?: number, weight?: number) => {
// If locked dose exists, use it immediately
if (isLocked && drug.lockedDose) return parseInt(drug.lockedDose);

if (!height || !weight || height <= 0 || weight <= 0) return null;
  const bsa = 0.0061 * height + 0.0128 * weight - 0.1529;
  const bsaFixed = bsa > 0 ? bsa : 0;
  if (drug.unit === 'mg/m²' || drug.unit === 'mg/m2') return Math.round(drug.standardDose * bsaFixed);
  if (drug.unit === 'mg/kg') return Math.round(drug.standardDose * weight);
  if (drug.unit === 'mg') return drug.standardDose; // Fixed dose support
  return null;
  };

const RegimenSection = ({ title, options, typeKey }: { title: string, options: RegimenOption[], typeKey: keyof SelectedRegimens }) => {
if (!options || options.length === 0) return null;
return (
<div className="mb-6 animate-fade-in">
<h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center">
<span className="w-2 h-2 rounded-full bg-medical-400 mr-2"></span>
{title}
</h4>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
{options.map(opt => {
const isSelected = selectedRegimens[typeKey] === opt.id;
// 如果已锁定，且未选中，则变灰/隐藏
if (isLocked && !isSelected) return null;
return (
                      <div 
                        key={opt.id}
                        onClick={() => handleSelectRegimen(typeKey, opt.id)}
                        className={`p-3 rounded-lg border transition-all relative ${
                            isSelected 
                            ? 'border-medical-500 bg-medical-50 ring-1 ring-medical-500 shadow-md' 
                            : 'border-gray-200 bg-white hover:border-gray-300 cursor-pointer'
                        } ${isLocked ? 'cursor-default' : ''}`}
                      >
                          <div className="flex justify-between items-start">
                              <span className={`font-bold text-sm ${isSelected ? 'text-medical-900' : 'text-gray-800'}`}>{opt.name}</span>
                              {opt.recommended && !isLocked && <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-700 rounded">指南推荐</span>}
                          </div>
                          <p className="text-xs text-gray-500 mt-1 pr-6">{opt.description}</p>
                          
                          {opt.reasoning && (
                              <div className="mt-2 text-xs text-medical-800 bg-medical-50 p-2 rounded border border-medical-200 flex items-start">
                                  <svg className="w-3 h-3 mr-1.5 flex-shrink-0 mt-0.5 text-medical-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  <div><span className="font-bold mr-1">匹配依据:</span>{opt.reasoning}</div>
                              </div>
                          )}
                          
                          {/* Pros & Cons Display */}
                          {isSelected && !isLocked && (opt.pros || opt.cons) && (
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                  {opt.pros && opt.pros.length > 0 && (
                                      <div className="bg-green-50 p-1.5 rounded border border-green-100">
                                          <div className="text-[10px] font-bold text-green-800 mb-0.5">优点</div>
                                          <ul className="list-disc list-inside text-[9px] text-green-700">
                                              {opt.pros.map((p, i) => <li key={i}>{p}</li>)}
                                          </ul>
                                      </div>
                                  )}
                                  {opt.cons && opt.cons.length > 0 && (
                                      <div className="bg-red-50 p-1.5 rounded border border-red-100">
                                          <div className="text-[10px] font-bold text-red-800 mb-0.5">缺点/副作用</div>
                                          <ul className="list-disc list-inside text-[9px] text-red-700">
                                              {opt.cons.map((c, i) => <li key={i}>{c}</li>)}
                                          </ul>
                                      </div>
                                  )}
                              </div>
                          )}

                          <div className="flex items-center mt-2 gap-2 mb-2">
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{opt.cycle}</span>
                            {(opt.totalCycles || 0) > 0 && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">共{opt.totalCycles}周期</span>}
                          </div>

                          {isSelected && opt.drugs && opt.drugs.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-medical-200 bg-white/60 -mx-1 px-2 rounded-b">
                                  <div className="flex justify-between items-center mb-2">
                                      <span className="text-xs font-bold text-medical-800">药物剂量 {isLocked ? '(已锁定)' : '(预估)'}</span>
                                      {!isLocked && patient.height && patient.weight && (
                                          <span className="text-[10px] text-gray-500">BSA: {(0.0061 * patient.height + 0.0128 * patient.weight - 0.1529).toFixed(2)}m²</span>
                                      )}
                                  </div>
                                  <div className="space-y-1.5">
                                      {opt.drugs.map((drug, idx) => {
                                          const doseVal = isLocked && drug.lockedDose 
                                              ? parseInt(drug.lockedDose) 
                                              : calculateDrugDose(drug, patient.height, patient.weight);
                                          
                                          return (
                                              <div key={idx} className="flex justify-between items-center text-xs bg-white p-1.5 rounded border border-gray-100">
                                                  <div>
                                                      <div className="font-medium text-gray-700">{drug.name}</div>
                                                      <div className="text-[10px] text-gray-400">标准: {drug.standardDose} {drug.unit}</div>
                                                  </div>
                                                  <div className="text-right">
                                                      {doseVal ? (
                                                          <div className="font-bold text-medical-600">
                                                              {doseVal} <span className="text-[10px] font-normal">mg</span>
                                                              {isLocked && <span className="ml-1 text-gray-400 text-[9px] icon-lock">🔒</span>}
                                                          </div>
                                                      ) : (
                                                          <div className="text-gray-400">--</div>
                                                      )}
                                                  </div>
                                              </div>
                                          )
                                      })}
                                  </div>
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

const isLuminal = patient.subtype === 'Luminal A' || patient.subtype === 'Luminal B';
const showGeneticTest = isLuminal && localMarkers.nodeStatus.includes('N0');

return (
<div className="space-y-8 pb-10 relative">
{/* 锁定提示条 */}
{isLocked && (
<div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 rounded-r shadow-sm">
<div className="flex justify-between items-center">
<div className="flex items-center">
<svg className="h-5 w-5 text-yellow-600 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
<div>
<p className="text-sm font-bold text-yellow-800">方案已锁定</p>
<p className="text-xs text-yellow-700">药物剂量已根据确定时的体重固定，不会随信息修改而改变。</p>
</div>
</div>
<button onClick={handleUnlock} className="text-xs bg-white border border-yellow-300 text-yellow-700 px-3 py-1.5 rounded hover:bg-yellow-50 transition-colors">
解锁编辑
</button>
</div>
</div>
)}
{/* Input Section - Disabled when locked */}
  <section className={`bg-white p-5 rounded-xl shadow-sm border border-gray-100 ${isLocked ? 'opacity-80 pointer-events-none' : ''}`}>
    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-medical-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        临床病理指标输入
    </h3>
    <div className="grid grid-cols-2 gap-4">
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">ER (雌激素受体)</label>
            <div className="relative">
                <input 
                    type="number" min="0" max="100"
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none pr-6"
                    value={localMarkers.erStatus.replace('%', '')}
                    onChange={(e) => setLocalMarkers(prev => ({...prev, erStatus: e.target.value + '%'}))}
                    placeholder="0-100"
                    disabled={isLocked}
                />
                <span className="absolute right-2 top-2 text-xs text-gray-400">%</span>
            </div>
        </div>
        
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">PR (孕激素受体)</label>
            <div className="relative">
                <input type="number" min="0" max="100" className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none pr-6" value={localMarkers.prStatus.replace('%', '')} onChange={(e) => setLocalMarkers(prev => ({...prev, prStatus: e.target.value + '%'}))} placeholder="0-100" />
                <span className="absolute right-2 top-2 text-xs text-gray-400">%</span>
            </div>
        </div>

        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">HER2 状态</label>
            <select className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none bg-white" value={localMarkers.her2Status} onChange={(e) => setLocalMarkers(prev => ({...prev, her2Status: e.target.value}))}>
                <option value="">请选择</option>
                <option value="0">0 (阴性)</option>
                <option value="1+">1+ (阴性)</option>
                <option value="2+">2+ (不确定)</option>
                <option value="3+">3+ (阳性)</option>
            </select>
        </div>

        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Ki-67 指数</label>
            <div className="relative">
                <input type="number" min="0" max="100" className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none pr-6" value={localMarkers.ki67.replace('%', '')} onChange={(e) => setLocalMarkers(prev => ({...prev, ki67: e.target.value + '%'}))} placeholder="0-100" />
                <span className="absolute right-2 top-2 text-xs text-gray-400">%</span>
            </div>
        </div>
        
        {/* 新增：组织学分级 */}
        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">组织学分级 (Grade)</label>
            <select className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none bg-white" value={localMarkers.histologicalGrade || ''} onChange={(e) => setLocalMarkers(prev => ({...prev, histologicalGrade: e.target.value}))}>
                <option value="">请选择</option>
                <option value="GX">GX (无法评估)</option>
                <option value="G1">G1 (高分化/低危)</option>
                <option value="G2">G2 (中分化/中危)</option>
                <option value="G3">G3 (低分化/高危)</option>
            </select>
        </div>

        <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">肿瘤大小 (T)</label>
            <div className="relative">
                <input type="number" step="0.1" min="0" className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none pr-8" value={localMarkers.tumorSize.replace('cm', '')} onChange={(e) => setLocalMarkers(prev => ({...prev, tumorSize: e.target.value}))} placeholder="2.5" />
                <span className="absolute right-2 top-2 text-xs text-gray-400">cm</span>
            </div>
        </div>

        <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-600 mb-1">淋巴结状态 (N)</label>
            <select className="w-full p-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none bg-white" value={localMarkers.nodeStatus} onChange={(e) => setLocalMarkers(prev => ({...prev, nodeStatus: e.target.value}))}>
                <option value="">请选择</option>
                <option value="N0">N0 (无转移)</option>
                <option value="N1">N1 (1-3枚转移)</option>
                <option value="N2">N2 (4-9枚转移)</option>
                <option value="N3">N3 (≥10枚转移)</option>
            </select>
        </div>

        {showGeneticTest && (
            <div className="col-span-2 bg-blue-50 p-2 rounded border border-blue-100">
                <label className="block text-xs font-bold text-blue-700 mb-1">21基因检测评分 (RS)</label>
                <input type="number" min="0" max="100" className="w-full p-2 text-sm border border-blue-200 rounded focus:ring-2 focus:ring-blue-500 outline-none" value={localMarkers.geneticTestResult ? localMarkers.geneticTestResult.replace('RS ', '') : ''} onChange={(e) => setLocalMarkers(prev => ({...prev, geneticTestResult: e.target.value ? `RS ${e.target.value}` : ''}))} placeholder="输入 RS 评分" />
            </div>
        )}
    </div>
    
    <div className="mt-3 flex items-center">
        <input type="checkbox" id="meno" checked={localMarkers.menopause} onChange={(e) => setLocalMarkers({...localMarkers, menopause: e.target.checked})} className="h-4 w-4 text-medical-600 focus:ring-medical-500 border-gray-300 rounded" />
        <label htmlFor="meno" className="ml-2 block text-sm text-gray-900">患者已绝经</label>
    </div>
    
    {!isLocked && (
        <div className="mt-6">
            <button 
                onClick={handleGenerateHighLevel}
                className="w-full flex items-center justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-gradient-to-r from-medical-600 to-accent-500 hover:from-medical-700 hover:to-accent-600 focus:outline-none transition-all active:scale-[0.98]"
            >
                {options.length > 0 ? '重新匹配路径' : '匹配标准治疗路径'}
            </button>
        </div>
    )}
  </section>

  {error && <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm border border-red-100 flex items-start animate-fade-in"><span>{error}</span></div>}

  {options.length > 0 && (
    <section className={`animate-fade-in ${isLocked ? 'pointer-events-none' : ''}`}>
       <div className="flex items-center mb-4">
           <div className="w-8 h-8 rounded-full bg-medical-600 text-white flex items-center justify-center font-bold mr-3">1</div>
           <h3 className="text-lg font-bold text-gray-800">选择总体治疗路径</h3>
       </div>
       <div className="grid grid-cols-1 gap-4 mb-6">
         {options.map((option) => {
           const isSelected = selectedPlanId === option.id;
           const isRecommended = option.recommended;
           if (isLocked && !isSelected) return null; // 锁定时只显示选中的
           return (
             <div key={option.id} onClick={() => handleSelectPlan(option.id)} className={`relative rounded-xl p-5 border-2 cursor-pointer transition-all duration-200 group ${isSelected ? 'border-medical-600 bg-medical-50 shadow-md ring-1 ring-medical-600' : isRecommended ? 'border-accent-300 bg-accent-50/40' : 'border-gray-100 bg-white'}`}>
                {isRecommended && <div className="absolute -top-3 left-4 bg-accent-600 text-white text-xs px-3 py-1 rounded-full font-bold shadow-sm z-10 border-2 border-white">指南推荐方案</div>}
                <div className="flex items-start gap-4 pt-1">
                    <div className={`p-3 rounded-full flex-shrink-0 ${isSelected ? 'bg-medical-200 text-medical-700' : isRecommended ? 'bg-accent-100 text-accent-700' : 'bg-gray-100 text-gray-500'}`}><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">{getIcon(option.iconType)}</svg></div>
                    <div className="flex-1"><h4 className={`font-bold text-lg ${isSelected ? 'text-medical-900' : 'text-gray-800'}`}>{option.title}</h4><p className="text-sm text-gray-600 mt-1">{option.description}</p></div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${isSelected ? 'border-medical-500 bg-medical-500' : 'border-gray-300'}`}>{isSelected && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                </div>
             </div>
           );
         })}
       </div>
       
       {!isLocked && selectedPlanId && (
           <div className="flex justify-end">
                {!detailedPlan && (
                    <button onClick={handleGenerateDetailed} className="bg-medical-600 text-white px-6 py-2 rounded-full shadow-lg font-medium hover:bg-medical-700 transition-colors flex items-center">
                        下一步：制定详细用药
                    </button>
                )}
           </div>
       )}
    </section>
  )}

  {detailedPlan && (
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 animate-fade-in">
          <div className="flex items-center mb-6 border-b border-gray-100 pb-4">
            <div className="w-8 h-8 rounded-full bg-medical-600 text-white flex items-center justify-center font-bold mr-3">2</div>
            <div>
                <h3 className="text-lg font-bold text-gray-800">详细药物/治疗方案</h3>
                <p className="text-xs text-gray-500">{isLocked ? '方案已确认' : '请在以下类别中勾选具体的执行方案'}</p>
            </div>
            {!isLocked && <button onClick={handleGenerateDetailed} className="ml-auto text-xs text-medical-600 underline">刷新方案</button>}
          </div>

          <RegimenSection title="化疗方案 (Chemotherapy)" options={detailedPlan.chemoOptions} typeKey="chemoId" />
          <RegimenSection title="内分泌治疗 (Endocrine Therapy)" options={detailedPlan.endocrineOptions} typeKey="endocrineId" />
          <RegimenSection title="靶向治疗 (Targeted Therapy)" options={detailedPlan.targetOptions} typeKey="targetId" />
          <RegimenSection title="免疫治疗 (Immunotherapy)" options={detailedPlan.immuneOptions} typeKey="immuneId" />

          {optionsToCalculate.length > 0 && (
             <>
                {/* Dosage Calculator: 只在未锁定时显示输入，锁定时只显示结果 */}
                <DosageCalculator 
                    options={optionsToCalculate}
                    initialHeight={patient.height}
                    initialWeight={patient.weight}
                    onUpdateStats={(h, w) => { if(!isLocked && onUpdatePatientStats) onUpdatePatientStats(h, w) }}
                />
                
                {/* Step 3: Schedule Generator */}
                {onBatchAddEvents && (
                    <ScheduleGenerator 
                        selectedOptions={optionsToCalculate}
                        onSaveEvents={onBatchAddEvents}
                        patientHeight={patient.height}
                        patientWeight={patient.weight}
                    />
                )}

                {/* Step 4: Confirm and Save */}
                {!isLocked && (
                    <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
                        <button 
                            onClick={handleConfirmAndSave}
                            className="bg-green-600 text-white px-8 py-3 rounded-xl shadow-lg font-bold hover:bg-green-700 active:scale-[0.98] transition-all flex items-center"
                        >
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            确认并锁定方案
                        </button>
                    </div>
                )}
             </>
          )}
      </section>
  )}
</div>
);
};
