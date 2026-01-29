
import { Patient, ClinicalMarkers, TreatmentOption, DetailedRegimenPlan, MolecularSubtype, RegimenOption } from '../types';

/**
 * 本地专家系统规则库 (2024/2025 CSCO/NCCN 指南深度适配版)
 */

const getTumorSize = (sizeStr: string): number => {
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
  const grade = getGrade(markers.histologicalGrade);
  const ki67 = getKi67(markers.ki67);
  const subtype = patient.subtype;

  const isHER2 = subtype === MolecularSubtype.HER2Positive || (markers.her2Status && markers.her2Status.includes('3+'));
  const isTNBC = subtype === MolecularSubtype.TripleNegative;
  const erVal = getPercentage(markers.erStatus);
  const isHRPositive = erVal > 0;

  // 1. 核心判断：新辅助治疗的适用性 (基于 CSCO 指南)
  // 指南：HER2+ 或 TNBC 且 (T>=2 或 N+) 推荐新辅助
  const stronglyRecommendNeoadjuvant = (isHER2 || isTNBC) && (tSize >= 2.0 || nStage >= 1);
  const luminalNeoadjuvant = isHRPositive && !isHER2 && (nStage >= 2 || (nStage >= 1 && grade === 3));

  // --- 路径 1: 新辅助路径 ---
  options.push({
    id: 'path_neoadjuvant',
    title: '新辅助系统治疗 → 手术 → 辅助强化',
    iconType: 'chemo',
    description: '术前先进行系统全身治疗，通过降期评价体内药敏。',
    reasoning: stronglyRecommendNeoadjuvant 
      ? `[指南依据] 针对${isHER2 ? 'HER2+' : 'TNBC'}患者，若cT≥2或cN+，指南强烈推荐首选新辅助。目的：1.评估药敏以指导术后强化(如T-DM1或卡培他滨)；2.提高保乳率。`
      : `[指南依据] 当前分期可手术，但由于${isHRPositive ? '肿瘤负荷较大' : '生物学行为活跃'}，先行新辅助可评估化疗敏感性。`,
    duration: '6个月(术前) + 12个月(术后)',
    pros: ['活体药敏评估', '降期保乳', '指导术后Non-pCR强化治疗'],
    cons: ['治疗周期长', '若进展则丧失早期手术机会'],
    recommended: stronglyRecommendNeoadjuvant
  });

  // --- 路径 2: 手术优先路径 ---
  options.push({
    id: 'path_surgery',
    title: '直接手术 → 辅助治疗 (化疗/放疗/内分泌)',
    iconType: 'surgery',
    description: '先行手术明确病理分期，随后依据风险制定辅助方案。',
    reasoning: !stronglyRecommendNeoadjuvant 
      ? `[指南依据] 患者分期较早(cT1N0)或属于Luminal型，指南建议首选手术明确病理分期。根据术后病理及21基因检测结果决定是否豁免化疗。`
      : `[临床参考] 虽然指南推荐新辅助，但若患者保乳意愿弱且肿瘤易于切除，手术优先可快速去除病灶。`,
    duration: '1个月(手术) + 4-6个月(化疗) + 5年(内分泌)',
    pros: ['病理分期最准确', '迅速切除肿块缓解焦虑'],
    cons: ['无法获得体内药敏反馈', '对较大肿块保乳率低'],
    recommended: !stronglyRecommendNeoadjuvant && !luminalNeoadjuvant
  });

  // --- 路径 3: 化疗豁免路径 ---
  if (isHRPositive && !isHER2 && nStage === 0 && tSize <= 2.0) {
    options.push({
      id: 'path_conservative',
      title: '手术 → 辅助内分泌治疗 (豁免化疗)',
      iconType: 'drug',
      description: '针对极低危或基因检测低复发风险患者，跳过化疗直接内分泌治疗。',
      reasoning: `[指南依据] 患者为Luminal A样特征(T1N0, G1/2)，若21基因RS评分<25，辅助化疗获益极低。建议通过精准分型规避化疗毒性。`,
      duration: '5-10年(内分泌)',
      pros: ['避免化疗副作用', '生活质量高'],
      cons: ['需极其严密的风险评估', '存在隐匿性高危漏治风险'],
      recommended: ki67 < 20 && grade === 1
    });
  }

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
  const isHRPositive = !markers.erStatus.includes('0%');
  const nStage = getNodeStage(markers.nodeStatus);
  const isMeno = markers.menopause;

  // 1. 化疗细化 (区分序贯与常规)
  if (highLevelPlan.id !== 'path_conservative') {
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
        reasoning: 'CSCO指南新辅助I级推荐：双靶联合化疗可获得最高的pCR率(约60-70%)。',
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
        reasoning: 'KEYNOTE-522模式：TNBC新辅助标准方案，含铂序贯化疗可最大程度清除微小病灶。',
        stages: [
          { name: 'TP 阶段', cycles: 4, drugs: [{ name: '紫杉醇', standardDose: 80, unit: 'mg/m²' }, { name: '卡铂', standardDose: 5, unit: 'AUC' }] },
          { name: 'AC 阶段', cycles: 4, drugs: [{ name: '多柔比星', standardDose: 60, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }] }
        ]
      });
    } else {
      plan.chemoOptions.push({
        id: 'c_act',
        name: 'AC → T 方案',
        description: '蒽环序贯紫杉 (经典AC-T)',
        cycle: 'q3w × 8',
        type: 'chemo',
        recommended: nStage >= 1,
        totalCycles: 8,
        frequencyDays: 21,
        reasoning: '经典辅助化疗方案，适用于存在腋窝淋巴结阳性或G3分级的Luminal型高危患者。',
        stages: [
          { name: 'AC 阶段', cycles: 4, drugs: [{ name: '表柔比星', standardDose: 90, unit: 'mg/m²' }, { name: '环磷酰胺', standardDose: 600, unit: 'mg/m²' }] },
          { name: 'T 阶段', cycles: 4, drugs: [{ name: '多西他赛', standardDose: 75, unit: 'mg/m²' }] }
        ]
      });
    }
  }

  // 2. 靶向方案
  if (isHER2) {
    plan.targetOptions.push({
        id: 't_hp',
        name: 'HP 双靶向治疗',
        description: '曲妥珠单抗+帕妥珠单抗',
        cycle: 'q3w (与化疗同步并维持1年)',
        type: 'target',
        recommended: true,
        totalCycles: 18,
        frequencyDays: 21,
        reasoning: 'APHINITY研究证明：双靶向治疗能显著降低高危HER2+患者的复发风险。',
        drugs: [{ name: '曲妥珠单抗', standardDose: 6, loadingDose: 8, unit: 'mg/kg' }, { name: '帕妥珠单抗', standardDose: 420, loadingDose: 840, unit: 'mg' }]
    });
  }

  // 3. 内分泌方案 (OFS 特别处理)
  if (isHRPositive) {
    const needOFS = !isMeno && (nStage >= 1 || patient.age < 35);
    if (needOFS) {
        plan.endocrineOptions.push({
            id: 'e_ofs_ai',
            name: 'OFS + AI (戈舍瑞林 + 来曲唑)',
            description: '卵巢抑制 + 芳香化酶抑制剂',
            cycle: '28天/针 + 每日口服',
            type: 'endocrine',
            recommended: true,
            totalCycles: 13, // 1年13针
            frequencyDays: 28,
            reasoning: 'SOFT/TEXT研究证明：对于高危绝经前患者，OFS+AI优于单纯他莫昔芬。',
            drugs: [
                { name: '戈舍瑞林 (OFS)', standardDose: 3.6, unit: 'mg' }, 
                { name: '来曲唑', standardDose: 2.5, unit: 'mg' }
            ]
        });
    } else {
        plan.endocrineOptions.push({
            id: 'e_tam',
            name: '他莫昔芬 (TAM)',
            description: '每日20mg',
            cycle: '每日口服',
            type: 'endocrine',
            recommended: !needOFS,
            totalCycles: 1825,
            frequencyDays: 1,
            reasoning: '早期绝经后或极低危患者的标准辅助方案。',
            drugs: [{ name: '他莫昔芬', standardDose: 20, unit: 'mg' }]
        });
    }
  }

  return plan;
};
