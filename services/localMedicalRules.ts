
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, MolecularSubtype, RegimenOption } from '../types';

export const getTumorSizeVal = (sizeStr: string): number => {
  if (!sizeStr || sizeStr === '待查') return 0;
  if (sizeStr.includes('T1')) return 1;
  if (sizeStr.includes('T2')) return 2;
  if (sizeStr.includes('T3')) return 3;
  return 0;
};

export const getNodeStageVal = (nodeStr: string): number => {
  if (!nodeStr || nodeStr === '待查') return 0;
  if (nodeStr.includes('N3')) return 3;
  if (nodeStr.includes('N2')) return 2;
  if (nodeStr.includes('N1')) return 1;
  if (nodeStr.includes('N0')) return 0;
  return 0; 
};

const getKi67Val = (ki67Str: string): number => {
  if (!ki67Str || ki67Str === '待查') return 0;
  const val = parseFloat(ki67Str.replace(/[^\d.]/g, ''));
  return isNaN(val) ? 0 : val;
};

const getERVal = (str: string): number => {
    if (!str || str === '0%' || str === '0' || str === '待查' || str === '') return 0;
    const val = parseFloat(str.replace(/[^\d.]/g, ''));
    return isNaN(val) ? 0 : val;
};

const getPRVal = (str: string): number => {
    if (!str || str === '0%' || str === '0' || str === '待查' || str === '') return 0;
    const val = parseFloat(str.replace(/[^\d.]/g, ''));
    return isNaN(val) ? 0 : val;
};

/**
 * 推断分子分型
 */
export const inferMolecularSubtype = (markers: ClinicalMarkers): MolecularSubtype => {
    const her2 = markers.her2Status;
    const er = getERVal(markers.erStatus);
    const pr = getPRVal(markers.prStatus);
    const ki67 = getKi67Val(markers.ki67);

    // HER2 阳性型 (不论 ER)
    if (her2 === '3+') return MolecularSubtype.HER2Positive;
    
    // 三阴性
    if (er === 0 && (her2 === '0' || her2 === '1+')) return MolecularSubtype.TripleNegative;

    // Luminal 型
    if (er > 0) {
        // Luminal B (HER2+, 或 Ki67高, 或 PR低)
        if (her2 === '2+' || ki67 >= 30 || pr < 20) return MolecularSubtype.LuminalB;
        return MolecularSubtype.LuminalA;
    }

    return MolecularSubtype.Unknown;
};

/**
 * 推断临床分期 (基于 TNM 简化)
 */
export const inferClinicalStage = (markers: ClinicalMarkers): string => {
    const T = getTumorSizeVal(markers.tumorSize);
    const N = getNodeStageVal(markers.nodeStatus);

    if (N === 3) return "IIIC 期";
    if (N === 2) return "IIIA 期";
    
    if (T === 3) {
        return N >= 1 ? "IIIA 期" : "IIB 期";
    }
    if (T === 2) {
        return N >= 1 ? "IIB 期" : "IIA 期";
    }
    if (T === 1) {
        return N >= 1 ? "IIA 期" : "I 期";
    }
    
    return "分期需进一步检查";
};

export const generateLocalTreatmentOptions = (patient: Patient, markers: ClinicalMarkers): TreatmentOption[] => {
  const options: TreatmentOption[] = [];
  const tSize = getTumorSizeVal(markers.tumorSize);
  const nStage = getNodeStageVal(markers.nodeStatus);
  const subtype = inferMolecularSubtype(markers);

  const isHER2 = subtype === MolecularSubtype.HER2Positive;
  const erVal = getERVal(markers.erStatus);
  const isTNBC = subtype === MolecularSubtype.TripleNegative;
  
  const stronglyRecommendNeoadjuvant = (isHER2 || isTNBC) && (tSize >= 2 || nStage >= 1);

  options.push({
    id: 'path_neoadjuvant',
    title: '新辅助系统治疗 → 手术 → 辅助强化',
    iconType: 'chemo',
    description: '术前先进行系统全身治疗，根据疗效(pCR情况)指导术后精准强化方案。',
    duration: '6个月(术前) + 12个月(术后)',
    pros: ['早期活体药敏', '增加降期保乳机会', '精准评估预后'],
    cons: ['治疗周期较长', '需严密监测病情变化'],
    recommended: stronglyRecommendNeoadjuvant
  });

  options.push({
    id: 'path_surgery',
    title: '直接手术 → 辅助治疗 (化疗/放疗/内分泌)',
    iconType: 'surgery',
    description: '先行手术切除病灶明确完整病理，随后根据病理结果制定后续辅助方案。',
    duration: '1个月(手术) + 辅助周期',
    pros: ['病理最准确', '迅速切除肿块缓解焦虑'],
    cons: ['无术前药敏反馈', '对较大肿块保乳率低'],
    recommended: !stronglyRecommendNeoadjuvant
  });

  return options;
};

export const generateLocalDetailedRegimens = (
  patient: Patient,
  markers: ClinicalMarkers,
  highLevelPlan: TreatmentOption
): DetailedRegimenPlan => {
  const plan: DetailedRegimenPlan = { chemoOptions: [], ofsOptions: [], oralEndocrineOptions: [], targetOptions: [], immuneOptions: [], cdk46Options: [] };
  const subtype = inferMolecularSubtype(markers);
  const isHER2 = subtype === MolecularSubtype.HER2Positive;
  const erVal = getERVal(markers.erStatus);
  const isHRPositive = erVal > 0;
  const isMeno = markers.menopause;
  const ki67Val = getKi67Val(markers.ki67);
  const grade = markers.histologicalGrade;

  const highRisk = ki67Val > 30 || grade === 'G3' || getNodeStageVal(markers.nodeStatus) >= 1;

  // 1. 化疗
  if (isHER2) {
    plan.chemoOptions.push({ id: 'c_tchp', name: 'TCbHP (TCHP)', description: '多西他赛+卡铂+曲帕双靶', cycle: 'q3w × 6', type: 'chemo', recommended: true, totalCycles: 6, frequencyDays: 21, drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }, { name: '卡铂', standardDose: 6, unit: 'AUC' }] });
  } else if (isHRPositive) {
    plan.chemoOptions.push({ id: 'c_act', name: 'AC-T 方案', description: '蒽环序贯紫杉', cycle: 'q3w × 8', type: 'chemo', recommended: highRisk, totalCycles: 8, frequencyDays: 21, stages: [{ name: 'AC阶段', cycles: 4, drugs: [{ name: '表柔比星', standardDose: 90, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }] }, { name: 'T阶段', cycles: 4, drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }] }] });
    plan.chemoOptions.push({ id: 'c_tc', name: 'TC 方案', description: '多西他赛+环磷酰胺', cycle: 'q3w × 4', type: 'chemo', recommended: !highRisk, totalCycles: 4, frequencyDays: 21, drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }] });
  }

  // 2. 靶向
  if (isHER2) {
    plan.targetOptions.push({ id: 't_hp_iv', name: '曲帕双靶 (静脉)', description: '曲妥珠+帕妥珠 静脉', cycle: 'q3w', type: 'target', recommended: true, totalCycles: 18, frequencyDays: 21, drugs: [{ name: '曲妥珠单抗', standardDose: 6, loadingDose: 8, unit: 'mg/kg' }, { name: '帕妥珠单抗', standardDose: 420, loadingDose: 840, unit: 'mg' }] });
    plan.targetOptions.push({ id: 't_phesgo', name: 'PHESGO (皮下)', description: '固定剂量复方皮下', cycle: 'q3w', type: 'target', recommended: false, totalCycles: 18, frequencyDays: 21, drugs: [{ name: 'PHESGO', standardDose: 600, loadingDose: 1200, unit: 'mg' }] });
  }

  // 3. CDK4/6
  if (isHRPositive) {
    plan.cdk46Options.push({ id: 'cdk_none', name: '不使用', description: '无强化', cycle: '无', type: 'cdk46', recommended: false, totalCycles: 0, frequencyDays: 1 });
    plan.cdk46Options.push({ id: 'cdk_abe', name: '阿贝西利 (唯择)', description: '连续服用 2年', cycle: '150mg bid', type: 'cdk46', recommended: highRisk, totalCycles: 730, frequencyDays: 1, drugs: [{ name: '阿贝西利', standardDose: 150, unit: 'mg' }] });
    plan.cdk46Options.push({ id: 'cdk_rib', name: '瑞博西利 (凯丽隆)', description: '21/7 周期', cycle: '600mg qd (21/7)', type: 'cdk46', recommended: false, totalCycles: 24, frequencyDays: 28, drugs: [{ name: '瑞博西利', standardDose: 600, unit: 'mg' }] });
    plan.cdk46Options.push({ id: 'cdk_dal', name: '达尔西利 (艾瑞康)', description: '150mg 21/7 周期', cycle: '150mg qd (21/7)', type: 'cdk46', recommended: false, totalCycles: 24, frequencyDays: 28, drugs: [{ name: '达尔西利', standardDose: 150, unit: 'mg' }] });
  }

  // 4. 内分泌
  if (isHRPositive) {
    // OFS 部分
    if (!isMeno) {
        plan.ofsOptions.push({ id: 'ofs_none', name: '不使用 OFS', description: '仅口服', cycle: '无', type: 'endocrine', recommended: !highRisk, totalCycles: 0, frequencyDays: 1 });
        plan.ofsOptions.push({ id: 'ofs_gos_1m', name: '戈舍瑞林 (1月)', description: '28天/针', cycle: '28d/cycle', type: 'endocrine', recommended: highRisk, totalCycles: 13, frequencyDays: 28, drugs: [{ name: '戈舍瑞林', standardDose: 3.6, unit: 'mg' }] });
        plan.ofsOptions.push({ id: 'ofs_gos_3m', name: '戈舍瑞林 (3月)', description: '84天/针', cycle: '84d/cycle', type: 'endocrine', recommended: false, totalCycles: 5, frequencyDays: 84, drugs: [{ name: '戈舍瑞林', standardDose: 10.8, unit: 'mg' }] });
        plan.ofsOptions.push({ id: 'ofs_leu_1m', name: '亮丙瑞林 (1月)', description: '28天/针', cycle: '28d/cycle', type: 'endocrine', recommended: false, totalCycles: 13, frequencyDays: 28, drugs: [{ name: '亮丙瑞林', standardDose: 3.75, unit: 'mg' }] });
        plan.ofsOptions.push({ id: 'ofs_leu_3m', name: '亮丙瑞林 (3月)', description: '84天/针', cycle: '84d/cycle', type: 'endocrine', recommended: false, totalCycles: 5, frequencyDays: 84, drugs: [{ name: '亮丙瑞林', standardDose: 11.25, unit: 'mg' }] });
    }

    // 口服部分
    plan.oralEndocrineOptions.push({ id: 'oral_let', name: '来曲唑 (AI)', description: '口服', cycle: '2.5mg qd', type: 'endocrine', recommended: isMeno || highRisk, totalCycles: 1825, frequencyDays: 1, drugs: [{ name: '来曲唑', standardDose: 2.5, unit: 'mg' }] });
    plan.oralEndocrineOptions.push({ id: 'oral_ana', name: '阿那曲唑 (AI)', description: '口服', cycle: '1mg qd', type: 'endocrine', recommended: false, totalCycles: 1825, frequencyDays: 1, drugs: [{ name: '阿那曲唑', standardDose: 1, unit: 'mg' }] });
    plan.oralEndocrineOptions.push({ id: 'oral_exe', name: '依西美坦 (AI)', description: '口服', cycle: '25mg qd', type: 'endocrine', recommended: false, totalCycles: 1825, frequencyDays: 1, drugs: [{ name: '依西美坦', standardDose: 25, unit: 'mg' }] });
    plan.oralEndocrineOptions.push({ id: 'oral_tam', name: '他莫昔芬 (TAM)', description: '口服', cycle: '20mg qd', type: 'endocrine', recommended: !isMeno && !highRisk, totalCycles: 1825, frequencyDays: 1, drugs: [{ name: '他莫昔芬', standardDose: 20, unit: 'mg' }] });
  }
  
  return plan;
};
