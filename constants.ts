
import { Patient, MolecularSubtype, TreatmentStage, SideEffectDetail } from './types';

// 使用最稳定的 Flash 版本，配合 v1beta 接口使用
export const AI_MODEL_NAME = 'gemini-1.5-flash';

export const COMMON_SIDE_EFFECTS: Record<string, SideEffectDetail> = {
  '恶心呕吐 (CINV)': {
    strategies: [
      '少量多餐，避免空腹或过饱。',
      '避免油腻、辛辣、气味强烈的食物。',
      '餐后坐立30分钟，避免立即躺下。',
      '尝试含服生姜片或饮用姜茶。',
      '保持环境通风，减少异味刺激。'
    ],
    medications: [
      '5-HT3受体拮抗剂：昂丹司琼 (Ondansetron)、格拉司琼 (Granisetron)',
      'NK-1受体拮抗剂：阿瑞匹坦 (Aprepitant)',
      '皮质类固醇：地塞米松 (Dexamethasone)',
      '多巴胺受体拮抗剂：甲氧氯普胺 (胃复安)',
      '非典型抗精神病药：奥氮平 (Olanzapine)'
    ]
  },
  '骨髓抑制 (白细胞/中性粒减少)': {
    strategies: [
      '严格佩戴口罩，避免前往人群密集场所。',
      '注意个人卫生，勤洗手，每日监测体温。',
      '避免进食生冷、未煮熟的食物 (如生鱼片、沙拉)。',
      '保持口腔清洁，使用软毛牙刷。'
    ],
    medications: [
      '短效升白针：G-CSF (瑞白/惠尔血)',
      '长效升白针：PEG-rhG-CSF (津优力/新瑞白)',
      '抗生素：仅在合并发热或感染风险高时使用 (如头孢类、喹诺酮类)'
    ]
  },
  '贫血': {
    strategies: [
      '增加富含铁质食物摄入 (红肉、菠菜、动物肝脏)。',
      '起身动作缓慢，防止直立性低血压。',
      '保证充足休息，避免剧烈运动。'
    ],
    medications: [
      '促红细胞生成素 (EPO)',
      '铁剂：琥珀酸亚铁、右旋糖酐铁',
      '严重时 (Hb < 60g/L) 考虑输注红细胞悬液'
    ]
  },
  '血小板减少': {
    strategies: [
      '避免磕碰、外伤，使用软毛牙刷。',
      '避免用力擤鼻涕，避免便秘 (用力排便)。',
      '观察有无牙龈出血、皮下瘀斑。'
    ],
    medications: [
      '重组人血小板生成素 (TPO)',
      '白介素-11 (IL-11)',
      '严重出血风险时输注血小板'
    ]
  },
  '脱发': {
    strategies: [
      '化疗期间使用冰帽 (头皮冷却) 可减少脱发。',
      '剪短发以减少牵拉，使用温和洗发水。',
      '外出佩戴帽子或头巾注意防晒保暖。',
      '心理辅导：告知患者停药后头发会重新生长。'
    ],
    medications: [
      '目前无特效药物治疗化疗性脱发，主要依靠物理防护。'
    ]
  },
  '手足综合征 (HFS)': {
    strategies: [
      '避免接触热水，洗手洗脚用温水。',
      '避免手足摩擦 (如长时间走路、做家务)。',
      '穿着宽松舒适的鞋袜。',
      '每日多次涂抹保湿霜/尿素霜。'
    ],
    medications: [
      '外用：尿素霜、维生素E乳膏',
      '严重时：局部皮质类固醇药膏',
      '口服：维生素B6 (部分研究支持)'
    ]
  },
  '腹泻': {
    strategies: [
      '每日饮水 2000ml 以上，防脱水。',
      '进食低纤维、易消化食物 (如米粥、香蕉)。',
      '避免乳制品、咖啡因、酒精。',
      '注意肛周皮肤护理。'
    ],
    medications: [
      '止泻药：洛哌丁胺 (易蒙停)',
      '生长抑素类似物：奥曲肽 (严重腹泻时)',
      '调节肠道菌群：益生菌制剂'
    ]
  },
  '关节肌肉痛': {
    strategies: [
      '适度热敷 (避免烫伤)。',
      '轻度拉伸和按摩。',
      '补充钙剂和维生素D (针对芳香化酶抑制剂引起的疼痛)。'
    ],
    medications: [
      '非甾体抗炎药 (NSAIDs)：布洛芬、塞来昔布',
      '钙片 + 维生素D3',
      '严重时：弱阿片类镇痛药'
    ]
  },
  '皮疹/过敏反应': {
    strategies: [
      '保持皮肤清洁干燥，避免抓挠。',
      '穿着棉质宽松衣物。',
      '避免阳光直射，使用防晒霜。'
    ],
    medications: [
      '外用：炉甘石洗剂、地塞米松软膏',
      '口服抗组胺药：氯雷他定、西替利嗪',
      '严重时：全身性激素治疗'
    ]
  },
  '心脏毒性 (如曲妥珠单抗引起)': {
    strategies: [
      '每3个月监测心脏超声 (LVEF)。',
      '控制血压、血脂、血糖。',
      '若出现心悸、气短、水肿需立即就医。'
    ],
    medications: [
      '心脏保护剂：右雷佐生 (针对蒽环类)',
      'ACEI/ARB类药物 (如依那普利、缬沙坦)',
      'β受体阻滞剂 (如美托洛尔)'
    ]
  }
};

export const INITIAL_PATIENTS: Patient[] = [
  {
    id: '1',
    name: '张晓红',
    age: 45,
    mrn: 'MZ20231001',
    admissionDate: '2023-10-01',
    diagnosis: '左乳浸润性导管癌',
    subtype: MolecularSubtype.LuminalB,
    stage: TreatmentStage.Adjuvant,
    height: 160,
    weight: 58,
    markers: {
      erStatus: '强阳性 (90%)',
      prStatus: '阳性 (20%)',
      her2Status: '阴性 (1+)',
      ki67: '30%',
      tumorSize: '2.5cm',
      nodeStatus: 'N1',
      histologicalGrade: 'G2',
      menopause: false
    },
    timeline: [
      { id: 't1', date: '2023-10-05', title: '穿刺活检', description: '确诊浸润性导管癌', completed: true, type: 'exam' },
      { id: 't2', date: '2023-10-12', title: '改良根治术', description: '手术顺利，出血50ml', completed: true, type: 'surgery' },
      { id: 't3', date: '2023-11-01', title: 'AC方案化疗 (C1)', description: '首次化疗', completed: true, type: 'medication', sideEffects: ['恶心呕吐 (CINV)'] },
      { id: 't4', date: '2023-11-22', title: 'AC方案化疗 (C2)', description: '计划第二次化疗', completed: false, type: 'medication' }
    ],
    treatmentOptions: [],
    selectedPlanId: undefined,
    detailedPlan: undefined,
    selectedRegimens: {}
  },
  {
    id: '2',
    name: '李素芬',
    age: 62,
    mrn: 'MZ20231015',
    admissionDate: '2023-10-15',
    diagnosis: '右乳肿物',
    subtype: MolecularSubtype.Unknown,
    stage: TreatmentStage.Diagnosis,
    markers: {
      erStatus: '待查',
      prStatus: '待查',
      her2Status: '待查',
      ki67: '待查',
      tumorSize: '1.2cm',
      nodeStatus: 'N0',
      histologicalGrade: '待查',
      menopause: true
    },
    timeline: [],
    treatmentOptions: [],
    selectedPlanId: undefined,
    detailedPlan: undefined,
    selectedRegimens: {}
  }
];
