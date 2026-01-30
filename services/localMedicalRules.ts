
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, MolecularSubtype, RegimenOption } from '../types';

/**
 * 本地专家系统规则库 (2024/2025 CSCO/NCCN 指南深度适配版)
 */

const getTumorSize = (sizeStr: string): number => {
  if (!sizeStr) return 0;
  const size = parseFloat(sizeStr.replace(/[^\d.]/g, ''));
  return isNaN(size) ? 0 : size;
};

const getNodeStage = (nodeStr: string): number => {
  if (!nodeStr) return 0;
  if (nodeStr.includes('N3')) return 3;
  if (nodeStr.includes('N2')) return 2;
  if (nodeStr.includes('N1')) return 1;
  return 0; 
};

const getGrade = (gradeStr: string): number => {
    if (!gradeStr) return 0;
    if (gradeStr.includes('G3') || gradeStr.includes('3')) return 3;
    if (gradeStr.includes('G2') || gradeStr.includes('2')) return 2;
    if (gradeStr.includes('G1') || gradeStr.includes('1')) return 1;
    return 0; 
};

const getKi67 = (ki67Str: string): number => {
    if (!ki67Str) return 0;
    const val = parseFloat(ki67Str.replace(/[^\d.]/g, ''));
    return isNaN(val) ? 0 : val;
};

const getPercentage = (str: string): number => {
    if (!str || str === '0%' || str === '0') return 0;
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
  const isTNBC = subtype === MolecularSubtype.TripleNegative;
  const erVal = getPercentage(markers.erStatus);
  const isHRPositive = erVal > 0;

  const stronglyRecommendNeoadjuvant = (isHER2 || isTNBC) && (tSize >= 2.0 || nStage >= 1);

  options.push({
    id: 'path_neoadjuvant',
    title: '新辅助系统治疗 → 手术 → 辅助强化',
    iconType: 'chemo',
    description: '术前先进行系统全身治疗，通过降期评价体内药敏。',
    reasoning: stronglyRecommendNeoadjuvant 
      ? `[指南依据] 针对${isHER2 ? 'HER2+' : 'TNBC'}患者，若cT≥2或cN+，指南强烈推荐首选新辅助。`
      : `[临床参考] 肿瘤负荷较大，先行新辅助可评估化疗敏感性。`,
    duration: '6个月(术前) + 12个月(术后)',
    pros: ['活体药敏评估', '降期保乳', '指导术后强化'],
    cons: ['治疗周期长', '若进展则丧失早期手术机会'],
    recommended: stronglyRecommendNeoadjuvant
  });

  options.push({
    id: 'path_surgery',
    title: '直接手术 → 辅助治疗 (化疗/放疗/内分泌)',
    iconType: 'surgery',
    description: '先行手术明确病理分期，随后依据风险制定辅助方案。',
    reasoning: !stronglyRecommendNeoadjuvant 
      ? `[指南依据] 患者分期较早(cT1N0)或属于Luminal型，建议首选手术明确病理。`
      : `[临床参考] 若患者保乳意愿弱且肿瘤易于切除，手术优先可快速去除病灶。`,
    duration: '1个月(手术) + 4-6个月(化疗) + 5年(内分泌)',
    pros: ['病理分期准确', '迅速切除肿块'],
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
  const isTNBC = subtype === MolecularSubtype.TripleNegative;
  const erVal = getPercentage(markers.erStatus);
  const isHRPositive = erVal > 0;
  const nStage = getNodeStage(markers.nodeStatus);
  const isMeno = markers.menopause;
  const ki67Val = getKi67(markers.ki67);
  const grade = getGrade(markers.histologicalGrade);

  // 1. 化疗方案
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
      reasoning: 'CSCO I级推荐：HER2+新辅助标准方案。',
      drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }, { name: '卡铂', standardDose: 6, unit: 'AUC' }]
    });
  } else if (isTNBC) {
    plan.chemoOptions.push({
      id: 'c_tp_ac',
      name: 'TP → AC 序贯',
      description: '紫杉+卡铂 序贯 蒽环+环磷酰胺',
      cycle: 'q3w × 8',
      type: 'chemo',
      recommended: true,
      totalCycles: 8,
      frequencyDays: 21,
      reasoning: 'KEYNOTE-522模式：TNBC标准含铂方案。',
      stages: [
        { name: 'TP阶段', cycles: 4, drugs: [{ name: '紫杉醇', standardDose: 80, unit: 'mg/m²' }, { name: '卡铂', standardDose: 5, unit: 'AUC' }] },
        { name: 'AC阶段', cycles: 4, drugs: [{ name: '表柔比星', standardDose: 90, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }] }
      ]
    });
  } else if (isHRPositive) {
    plan.chemoOptions.push({
      id: 'c_act',
      name: 'AC → T 方案',
      description: '蒽环 序贯 紫杉',
      cycle: 'q3w × 8',
      type: 'chemo',
      recommended: nStage >= 1 || grade === 3,
      totalCycles: 8,
      frequencyDays: 21,
      reasoning: '经典辅助化疗，适用于高危Luminal型。',
      stages: [
        { name: 'AC阶段', cycles: 4, drugs: [{ name: '表柔比星', standardDose: 90, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }] },
        { name: 'T阶段', cycles: 4, drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }] }
      ]
    });
  }

  // 2. 靶向方案 (区分 Anti-HER2 与 CDK4/6i)
  if (isHER2) {
    plan.targetOptions.push({
        id: 't_hp',
        name: '曲帕双靶 (H+P)',
        description: 'Anti-HER2 靶向',
        cycle: 'q3w (维持1年)',
        type: 'target',
        recommended: nStage >= 1,
        totalCycles: 18,
        frequencyDays: 21,
        reasoning: '基于 APHINITY 研究，高危 N+ 推荐双靶。',
        drugs: [{ name: '曲妥珠单抗', standardDose: 6, loadingDose: 8, unit: 'mg/kg' }, { name: '帕妥珠单抗', standardDose: 420, loadingDose: 840, unit: 'mg' }]
    });
  }

  if (isHRPositive) {
    const isHighRiskHR = nStage >= 1 || (ki67Val >= 20 && grade === 3);
    plan.targetOptions.push({
      id: 't_abe',
      name: '阿贝西利 (Abemaciclib)',
      description: 'CDK4/6 抑制剂',
      cycle: '150mg bid (连续2年)',
      type: 'target',
      recommended: isHighRiskHR && !isHER2,
      totalCycles: 730,
      frequencyDays: 1,
      reasoning: '基于 monarchE 研究，淋巴结阳性高危辅助强化推荐。',
      drugs: [{ name: '阿贝西利', standardDose: 150, unit: 'mg' }]
    });

    if (patient.diagnosis.includes('晚期') || patient.diagnosis.includes('转移')) {
        plan.targetOptions.push({
            id: 't_pal',
            name: '哌柏西利 (Palbociclib)',
            description: 'CDK4/6 抑制剂',
            cycle: '125mg qd (21/7)',
            type: 'target',
            recommended: true,
            totalCycles: 12,
            frequencyDays: 28,
            reasoning: '晚期一线标准。',
            drugs: [{ name: '哌柏西利', standardDose: 125, unit: 'mg' }]
        });
    }
  }

  // 3. 内分泌方案 (绝经联动)
  if (isHRPositive) {
    const needOFS = !isMeno && (nStage >= 1 || patient.age < 35);
    
    if (needOFS) {
        plan.endocrineOptions.push({
            id: 'e_ofs_ai',
            name: 'OFS + AI (戈舍瑞林+来曲唑)',
            description: '绝经前高危内分泌',
            cycle: '28天/针 + 每日口服',
            type: 'endocrine',
            recommended: true,
            totalCycles: 13,
            frequencyDays: 28,
            reasoning: 'SOFT/TEXT研究证明：高危绝经前患者 OFS+AI 优于单药。',
            drugs: [{ name: '戈舍瑞林', standardDose: 3.6, unit: 'mg' }, { name: '来曲唑', standardDose: 2.5, unit: 'mg' }]
        });
    } else if (isMeno) {
        plan.endocrineOptions.push({
            id: 'e_ai',
            name: 'AI (来曲唑/阿那曲唑)',
            description: '绝经后标准内分泌',
            cycle: '每日口服',
            type: 'endocrine',
            recommended: true,
            totalCycles: 1825,
            frequencyDays: 1,
            reasoning: '绝经后患者首选芳香化酶抑制剂。',
            drugs: [{ name: '来曲唑', standardDose: 2.5, unit: 'mg' }]
        });
    } else {
        plan.endocrineOptions.push({
            id: 'e_tam',
            name: '他莫昔芬 (TAM)',
            description: '绝经前中低危标准',
            cycle: '每日口服',
            type: 'endocrine',
            recommended: true,
            totalCycles: 1825,
            frequencyDays: 1,
            reasoning: '绝经前中低危患者标准方案。',
            drugs: [{ name: '他莫昔芬', standardDose: 20, unit: 'mg' }]
        });
    }
  }

  return plan;
};
