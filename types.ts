
export enum MolecularSubtype {
LuminalA = 'Luminal A',
LuminalB = 'Luminal B',
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
erStatus: string; 
prStatus: string; 
her2Status: string; 
ki67: string; 
tumorSize: string; 
nodeStatus: string; 
histologicalGrade: string; 
menopause: boolean; 
geneticTestResult?: string; 
serumCreatinine?: string; 
vascularInvasion?: '阴性' | '阳性' | '待查'; 
geneScore21?: string; 
}

export interface TreatmentEvent {
id: string;
date: string;
title: string;
description: string;
completed: boolean;
type: 'chemo' | 'endocrine' | 'target' | 'immune' | 'surgery' | 'exam' | 'other' | 'cdk46' | 'ofs';
sideEffects?: string[]; 
dosageDetails?: string; 
}

export interface TreatmentOption {
id: string;
title: string;
iconType: 'surgery' | 'chemo' | 'drug' | 'observation';
description: string;
reasoning?: string; 
duration: string;
pros: string[];
cons: string[];
recommended: boolean;
}

export interface DrugDetail {
name: string;
standardDose: number; 
loadingDose?: number; 
unit: string; 
lockedDose?: string; 
lockedLoadingDose?: string; 
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
type: 'chemo' | 'endocrine' | 'target' | 'immune' | 'cdk46';
recommended: boolean;
reasoning?: string; 
drugs?: DrugDetail[]; 
stages?: RegimenStage[]; 
totalCycles?: number; 
frequencyDays?: number; 
}

export interface DetailedRegimenPlan {
chemoOptions: RegimenOption[];
ofsOptions: RegimenOption[]; 
oralEndocrineOptions: RegimenOption[]; 
targetOptions: RegimenOption[];
immuneOptions: RegimenOption[];
cdk46Options: RegimenOption[]; 
}

export interface SelectedRegimens {
chemoId?: string;
ofsId?: string; 
oralEndocrineId?: string; 
targetId?: string;
immuneId?: string;
cdk46Id?: string; 
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
