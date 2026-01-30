
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, MolecularSubtype, RegimenOption } from '../types';

/**
 * 稳健的指标解析辅助函数
 */
const getTumorSize = (sizeStr: string): number => {
  if (!sizeStr || sizeStr === '待查') return 0;
  const size = parseFloat(sizeStr.replace(/[^\d.]/g, ''));
  return isNaN(size) ? 0 : size;
};

const getNodeStage = (nodeStr: string): number => {
  if (!nodeStr || nodeStr === '待查') return 0;
  if (nodeStr.toUpperCase().includes('N3')) return 3;
  if (nodeStr.toUpperCase().includes('N2')) return 2;
  if (nodeStr.toUpperCase().includes('N1')) return 1;
  return 0; 
};

const getGrade = (gradeStr: string): number => {
    if (!gradeStr || gradeStr === '待查') return 0;
    if (gradeStr.includes('G3') || gradeStr.includes('3')) return 3;
    if (gradeStr.includes('G2') || gradeStr.includes('2')) return 2;
    if (gradeStr.includes('G1') || gradeStr.includes('1')) return 1;
    return 0; 
};

const getKi67 = (ki67Str: string): number => {
    if (!ki67Str || ki67Str === '待查') return 0;
    const val = parseFloat(ki67Str.replace(/[^\d.]/g, ''));
    return isNaN(val) ? 0 : val;
};

const getPercentage = (str: string): number => {
    if (!str || str === '0%' || str === '0' || str === '待查' || str === '') return 0;
    if (str === '1%-10%') return 5;
    if (str === '10%-50%') return 30;
    if (str === '>50%') return 75;
    const val = parseFloat(str.replace(/[^\d.]/g, ''));
    return isNaN(val) ? 0 : val;
};

export const generateLocalTreatmentOptions = (patient: Patient, markers: ClinicalMarkers): TreatmentOption[] => {
  const options: TreatmentOption[] = [];
  const tSize = getTumorSize(markers.tumorSize);
  const nStage = getNodeStage(markers.nodeStatus);
  const subtype = patient.subtype;

  const isHER2 = subtype === MolecularSubtype.HER2Positive || (markers.her2Status && markers.her2Status.includes('3+'));
  const erVal = getPercentage(markers.erStatus);
  const isTNBC = subtype === MolecularSubtype.TripleNegative || (!isHER2 && erVal === 0);
  
  const stronglyRecommendNeoadjuvant = (isHER2 || isTNBC) && (tSize >= 2.0 || nStage >= 1);

  options.push({
    id: 'path_neoadjuvant',
    title: '新辅助系统治疗 → 手术 → 辅助强化',
    iconType: 'chemo',
    description: '术前先进行系统全身治疗，通过降期评价体内药敏，指导术后精准强化。',
    reasoning: stronglyRecommendNeoadjuvant 
      ? `[指南依据] 针对${isHER2 ? 'HER2+' : 'TNBC'}患者，cT≥2或cN+是新辅助的绝对指征。`
      : `[临床参考] 虽然分期尚早，但考虑到${isHER2 ? 'HER2+' : isTNBC ? '三阴性' : '生物学行为'}，先行新辅助可获取药敏信息。`,
    duration: '6个月(术前) + 12个月(术后)',
    pros: ['活体药敏评估', '降期保乳', '指导术后Non-pCR强化'],
    cons: ['治疗周期长', '若方案无效可能导致疾病进展'],
    recommended: stronglyRecommendNeoadjuvant
  });

  options.push({
    id: 'path_surgery',
    title: '直接手术 → 辅助治疗 (化疗/放疗/内分泌)',
    iconType: 'surgery',
    description: '先行手术明确病理分期，随后依据淋巴结及脉管侵犯情况制定辅助方案。',
    reasoning: !stronglyRecommendNeoadjuvant 
      ? `[指南依据] 早期(cT1N0)或Luminal型患者，首选手术明确分期。`
      : `[临床参考] 若患者保乳意愿弱且肿瘤易于切除，手术优先。`,
    duration: '1个月(手术) + 4-6个月(化疗) + 5-10年(内分泌)',
    pros: ['病理分期最准确', '迅速切除肿块'],
    cons: ['无法获得药敏反馈'],
    recommended: !stronglyRecommendNeoadjuvant
  });

  return options;
};

export const generateLocalDetailedRegimens = (
  patient: Patient,
  markers: ClinicalMarkers,
  highLevelPlan: TreatmentOption
): DetailedRegimenPlan => {
  const plan: DetailedRegimenPlan = { chemoOptions: [], endocrineOptions: [], targetOptions: [], immuneOptions: [] };
  const subtype = patient.subtype;
  const isHER2 = subtype === MolecularSubtype.HER2Positive || (markers.her2Status && markers.her2Status.includes('3+'));
  const erVal = getPercentage(markers.erStatus);
  const isHRPositive = erVal > 0;
  const nStage = getNodeStage(markers.nodeStatus);
  const isMeno = markers.menopause;
  const ki67Val = getKi67(markers.ki67);
  const grade = getGrade(markers.histologicalGrade);

  // 1. 化疗方案逻辑
  if (isHER2) {
    plan.chemoOptions.push({
      id: 'c_tchp',
      name: 'TCbHP (TCHP) 方案',
      description: '多西他赛+卡铂+曲帕双靶',
      cycle: 'q3w × 6',
      type: 'chemo',
      recommended: true,
      totalCycles: 6,
      frequencyDays: 21,
      reasoning: 'HER2+标准方案。',
      drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }, { name: '卡铂', standardDose: 6, unit: 'AUC' }]
    });
  } else if (isHRPositive) {
    plan.chemoOptions.push({
      id: 'c_act',
      name: 'AC → T 方案',
      description: '蒽环序贯紫杉',
      cycle: 'q3w × 8',
      type: 'chemo',
      recommended: nStage >= 1 || grade === 3 || ki67Val > 30,
      totalCycles: 8,
      frequencyDays: 21,
      reasoning: '高危Luminal型标准辅助化疗。',
      stages: [
        { name: 'AC阶段', cycles: 4, drugs: [{ name: '表柔比星', standardDose: 90, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }] },
        { name: 'T阶段', cycles: 4, drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }] }
      ]
    });
  }

  // 2. 靶向方案逻辑 (Anti-HER2)
  if (isHER2) {
    plan.targetOptions.push({
        id: 't_hp',
        name: '曲帕双靶 (H+P)',
        description: 'Anti-HER2 靶向',
        cycle: 'q3w',
        type: 'target',
        recommended: nStage >= 1,
        totalCycles: 18,
        frequencyDays: 21,
        reasoning: 'N+患者推荐双靶维持。',
        drugs: [{ name: '曲妥珠单抗', standardDose: 6, loadingDose: 8, unit: 'mg/kg' }, { name: '帕妥珠单抗', standardDose: 420, loadingDose: 840, unit: 'mg' }]
    });
  }

  // 3. CDK4/6 抑制剂 (作为独立分类显示，但在数据结构中放入 targetOptions)
  if (isHRPositive) {
    // 阿贝西利 (辅助/晚期均可)
    plan.targetOptions.push({
      id: 't_abe',
      name: '阿贝西利 (Abemaciclib)',
      description: 'CDK4/6 抑制剂 - 连续服用',
      cycle: '150mg bid',
      type: 'target',
      recommended: nStage >= 1 && !isHER2,
      totalCycles: 730,
      frequencyDays: 1,
      reasoning: '基于 monarchE 研究，高危辅助推荐连续服用2年。',
      drugs: [{ name: '阿贝西利', standardDose: 150, unit: 'mg' }]
    });
    
    // 哌柏西利 (常用于晚期或作为备选)
    plan.targetOptions.push({
        id: 't_pal',
        name: '哌柏西利 (Palbociclib)',
        description: 'CDK4/6 抑制剂 - 21/7周期',
        cycle: '125mg qd (服用21天停7天)',
        type: 'target',
        recommended: false,
        totalCycles: 24, // 以周期计
        frequencyDays: 28,
        reasoning: '标准 21/7 方案，主要用于晚期或特定临床研究。',
        drugs: [{ name: '哌柏西利', standardDose: 125, unit: 'mg' }]
    });
  }

  // 4. 内分泌方案逻辑
  if (isHRPositive) {
    const needOFS = !isMeno && (nStage >= 1 || patient.age < 35);
    if (needOFS) {
        plan.endocrineOptions.push({
            id: 'e_ofs_ai',
            name: 'OFS + AI (戈舍瑞林+来曲唑)',
            description: '绝经前高危强化',
            cycle: '28天/针 + 每日口服',
            type: 'endocrine',
            recommended: true,
            totalCycles: 13,
            frequencyDays: 28,
            reasoning: 'SOFT/TEXT研究：绝经前高危OFS强化获益。',
            drugs: [{ name: '戈舍瑞林', standardDose: 3.6, unit: 'mg' }, { name: '来曲唑', standardDose: 2.5, unit: 'mg' }]
        });
    } else {
        plan.endocrineOptions.push({
            id: 'e_ai',
            name: isMeno ? 'AI (来曲唑/阿那曲唑)' : 'TAM (他莫昔芬)',
            description: isMeno ? '绝经后标准' : '绝经前标准',
            cycle: '每日口服',
            type: 'endocrine',
            recommended: true,
            totalCycles: 1825,
            frequencyDays: 1,
            reasoning: '指南标准辅助内分泌。',
            drugs: [{ name: isMeno ? '来曲唑' : '他莫昔芬', standardDose: isMeno ? 2.5 : 20, unit: 'mg' }]
        });
    }
  }

  return plan;
};
