
export enum MolecularSubtype {
LuminalA = 'Luminal A',
LuminalB = 'Luminal B',
LuminalBLike = 'Luminal B-like',
HER2Positive = 'HER2 Positive',
HER2Enriched = 'HER2 Enriched',
TripleNegative = 'Triple Negative',
Unknown = '待定'
}

export enum TreatmentStage {
Diagnosis = '初步诊断',
Neoadjuvant = '新辅助治疗',
Surgery = '手术',
Adjuvant = '辅助治疗',
FollowUp = '随访'
}

export interface ClinicalMarkers {
erStatus: string; // Estrogen Receptor
prStatus: string; // Progesterone Receptor
her2Status: string; // HER2
ki67: string; // Proliferation index
tumorSize: string; // cT
nodeStatus: string; // cN
histologicalGrade: string; // Histological Grade (G1, G2, G3)
menopause: boolean; // Menopause status
geneticTestResult?: string; // 21-gene recurrence score (RS)
serumCreatinine?: string; // 血肌酐 (umol/L) for Calvert Formula
}

export interface TreatmentEvent {
id: string;
date: string;
title: string;
description: string;
completed: boolean;
type: 'chemo' | 'endocrine' | 'target' | 'immune' | 'surgery' | 'exam' | 'other';
sideEffects?: string[]; // List of side effects keys e.g. ['Nausea']
dosageDetails?: string; // 用于在日程中显示锁定的剂量详情
}

export interface TreatmentOption {
id: string;
title: string;
iconType: 'surgery' | 'chemo' | 'drug' | 'observation';
description: string;
duration: string;
pros: string[];
cons: string[];
recommended: boolean;
}

export interface DrugDetail {
name: string;
standardDose: number; // mg/m2 or AUC
loadingDose?: number; // 针对靶向药物的首剂加量
unit: string; // 'mg/m²', 'mg/kg', 'mg', 'AUC'
lockedDose?: string; // 保存时计算出的具体剂量 (维持剂量)
lockedLoadingDose?: string; // 保存时计算出的具体剂量 (首剂剂量)
}

export interface RegimenStage {
name: string;
cycles: number;
drugs: DrugDetail[];
}

export interface RegimenOption {
id: string;
name: string; 
description: string; 
cycle: string; 
type: 'chemo' | 'endocrine' | 'target' | 'immune';
recommended: boolean;
reasoning?: string; 
drugs?: DrugDetail[]; 
stages?: RegimenStage[]; // 支持序贯治疗
totalCycles?: number; 
frequencyDays?: number; 
pros?: string[]; 
cons?: string[]; 
}

export interface DetailedRegimenPlan {
chemoOptions: RegimenOption[];
endocrineOptions: RegimenOption[];
targetOptions: RegimenOption[];
immuneOptions: RegimenOption[];
}

export interface SelectedRegimens {
chemoId?: string;
endocrineId?: string;
targetId?: string;
immuneId?: string;
}

export interface SideEffectDetail {
strategies: string[]; 
medications: string[]; 
}

export interface Patient {
id: string;
name: string;
age: number;
mrn: string; 
admissionDate: string;
diagnosis: string;
subtype: MolecularSubtype;
stage: TreatmentStage;
markers: ClinicalMarkers;

height?: number; 
weight?: number; 

phone?: string;
address?: string;
occupation?: string;

treatmentOptions?: TreatmentOption[]; 
selectedPlanId?: string; 

detailedPlan?: DetailedRegimenPlan; 
selectedRegimens?: SelectedRegimens; 

isPlanLocked?: boolean; 
timeline: TreatmentEvent[];
}
