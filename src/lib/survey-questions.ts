
// 查勘问询问题类型
export type QuestionType = 'text' | 'number' | 'select' | 'multiselect' | 'date' | 'boolean' | 'textarea';

// 查勘问询问题选项
export interface QuestionOption {
  label: string;
  value: string;
  description?: string;
}

// 查勘问询问题
export interface SurveyQuestion {
  id: string;
  section: string;      // 所属章节
  subsection?: string;  // 所属小节
  order: number;        // 排序
  question: string;     // 问题文本
  type: QuestionType;   // 问题类型
  required?: boolean;   // 是否必填
  placeholder?: string; // 占位文本
  options?: QuestionOption[]; // 选项（单选/多选）
  hint?: string;        // 提示信息
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

// 查勘问询回答
export interface SurveyAnswer {
  questionId: string;
  value: string | string[] | number | boolean | Date;
  timestamp?: Date;
}

// 完整查勘问询记录
export interface SurveyRecord {
  id: string;
  projectName?: string;
  clientName?: string;
  surveyDate: Date;
  answers: SurveyAnswer[];
  createdAt: Date;
  updatedAt: Date;
}

// 查勘问询章节配置
export const SURVEY_SECTIONS = {
  BASIC_INFO: '一、基础维护信息',
  MAINTENANCE_SCOPE: '二、维保范围',
  MAINTENANCE_REQUIREMENTS: '三、维保具体要求',
  CORE_DEMANDS: '四、甲方核心维保诉求',
  SPECIAL_CASES: '五、特殊情况说明',
};

// 完整的查勘问询问题清单（基于Excel整理）
export const SURVEY_QUESTIONS: SurveyQuestion[] = [
  // ===== 一、基础维护信息 =====
  {
    id: 'basic-001',
    section: SURVEY_SECTIONS.BASIC_INFO,
    order: 1,
    question: '单位名称',
    type: 'text',
    required: true,
    placeholder: '请输入单位全称',
  },
  {
    id: 'basic-002',
    section: SURVEY_SECTIONS.BASIC_INFO,
    order: 2,
    question: '项目地点',
    type: 'text',
    required: true,
    placeholder: '请输入详细地址',
  },
  {
    id: 'basic-003',
    section: SURVEY_SECTIONS.BASIC_INFO,
    order: 3,
    question: '联系人',
    type: 'text',
    required: true,
    placeholder: '请输入联系人姓名',
  },
  {
    id: 'basic-004',
    section: SURVEY_SECTIONS.BASIC_INFO,
    order: 4,
    question: '联系电话',
    type: 'text',
    required: true,
    placeholder: '请输入联系电话',
    validation: {
      pattern: '^1[3-9]\\d{9}$',
    },
  },
  {
    id: 'basic-005',
    section: SURVEY_SECTIONS.BASIC_INFO,
    order: 5,
    question: '查勘日期',
    type: 'date',
    required: true,
  },
  {
    id: 'basic-006',
    section: SURVEY_SECTIONS.BASIC_INFO,
    order: 6,
    question: '服务地区',
    type: 'select',
    required: true,
    options: [
      { label: '城区', value: '城区' },
      { label: '市区县城郊区', value: '市区县城郊区' },
      { label: '乡镇', value: '乡镇' },
      { label: '农村', value: '农村' },
    ],
  },

  // ===== 二、维保范围（基础部分） =====
  {
    id: 'scope-001',
    section: SURVEY_SECTIONS.MAINTENANCE_SCOPE,
    order: 1,
    question: '是否包含计算机终端类设备',
    type: 'boolean',
    required: true,
  },
  {
    id: 'scope-002',
    section: SURVEY_SECTIONS.MAINTENANCE_SCOPE,
    order: 2,
    question: '是否包含办公外设及存储类设备',
    type: 'boolean',
    required: true,
  },
  {
    id: 'scope-003',
    section: SURVEY_SECTIONS.MAINTENANCE_SCOPE,
    order: 3,
    question: '是否包含网络设备类',
    type: 'boolean',
    required: true,
  },

  // ===== 四、甲方核心维保诉求 =====
  {
    id: 'demand-001',
    section: SURVEY_SECTIONS.CORE_DEMANDS,
    order: 1,
    question: '对响应时间的要求',
    type: 'select',
    required: true,
    options: [
      { label: '10分钟内响应', value: '10分钟' },
      { label: '30分钟内响应', value: '30分钟' },
      { label: '1小时内响应', value: '1小时' },
      { label: '2小时内响应', value: '2小时' },
    ],
    hint: '指从接到报修电话到开始处理的时间',
  },
  {
    id: 'demand-002',
    section: SURVEY_SECTIONS.CORE_DEMANDS,
    order: 2,
    question: '对到场时间的要求',
    type: 'select',
    required: true,
    options: [
      { label: '2小时内到场', value: '2小时' },
      { label: '4小时内到场', value: '4小时' },
      { label: '6小时内到场', value: '6小时' },
      { label: '24小时内到场', value: '24小时' },
    ],
  },
  {
    id: 'demand-003',
    section: SURVEY_SECTIONS.CORE_DEMANDS,
    order: 3,
    question: '对故障恢复时间的要求',
    type: 'select',
    required: true,
    options: [
      { label: '4小时内恢复', value: '4小时' },
      { label: '24小时内恢复', value: '24小时' },
      { label: '48小时内恢复', value: '48小时' },
      { label: '72小时内恢复', value: '72小时' },
    ],
  },
  {
    id: 'demand-004',
    section: SURVEY_SECTIONS.CORE_DEMANDS,
    order: 4,
    question: '服务时间要求',
    type: 'select',
    required: true,
    options: [
      { label: '5×8小时（工作日）', value: '5×8' },
      { label: '7×8小时（每天）', value: '7×8' },
      { label: '7×24小时（全天候）', value: '7×24' },
    ],
  },
  {
    id: 'demand-005',
    section: SURVEY_SECTIONS.CORE_DEMANDS,
    order: 5,
    question: '是否有安全等级要求',
    type: 'select',
    required: true,
    options: [
      { label: '第一级（一般）', value: '1' },
      { label: '第二级（较高）', value: '2' },
      { label: '第三级（高）', value: '3' },
      { label: '第四级（很高）', value: '4' },
      { label: '第五级（极高）', value: '5' },
    ],
  },
  {
    id: 'demand-006',
    section: SURVEY_SECTIONS.CORE_DEMANDS,
    order: 6,
    question: '对运维团队经验的要求',
    type: 'select',
    required: true,
    options: [
      { label: '有经验（做过类似项目）', value: '有经验' },
      { label: '类似经验（做过同类项目）', value: '类似经验' },
      { label: '无经验（首次合作）', value: '无经验' },
    ],
  },
  {
    id: 'demand-007',
    section: SURVEY_SECTIONS.CORE_DEMANDS,
    order: 7,
    question: '支持方式偏好',
    type: 'select',
    required: true,
    options: [
      { label: '非现场支持为主', value: '非现场' },
      { label: '现场支持为主', value: '现场' },
      { label: '纯现场支持', value: '纯现场' },
    ],
  },
  {
    id: 'demand-008',
    section: SURVEY_SECTIONS.CORE_DEMANDS,
    order: 8,
    question: '其他特殊说明',
    type: 'textarea',
    placeholder: '请填写其他特殊要求或说明事项',
  },
];

// 按章节分组获取问题
export function getQuestionsBySection(): Record<string, SurveyQuestion[]> {
  const grouped: Record<string, SurveyQuestion[]> = {};
  
  SURVEY_QUESTIONS.forEach(question => {
    if (!grouped[question.section]) {
      grouped[question.section] = [];
    }
    grouped[question.section].push(question);
  });
  
  // 对每个章节内的问题按order排序
  Object.keys(grouped).forEach(section => {
    grouped[section].sort((a, b) => a.order - b.order);
  });
  
  return grouped;
}

// 获取指定章节的问题
export function getQuestionsBySectionName(sectionName: string): SurveyQuestion[] {
  return SURVEY_QUESTIONS
    .filter(q => q.section === sectionName)
    .sort((a, b) => a.order - b.order);
}

// 初始化空的回答记录
export function initializeSurveyAnswers(): SurveyAnswer[] {
  return SURVEY_QUESTIONS.map(question => ({
    questionId: question.id,
    value: question.type === 'multiselect' ? [] : 
           question.type === 'boolean' ? false : 
           question.type === 'number' ? 0 : '',
  }));
}

// 验证回答完整性
export function validateSurveyAnswers(answers: SurveyAnswer[]): {
  valid: boolean;
  missingQuestions: string[];
} {
  const missingQuestions: string[] = [];
  
  SURVEY_QUESTIONS.forEach(question => {
    if (question.required) {
      const answer = answers.find(a => a.questionId === question.id);
      if (!answer) {
        missingQuestions.push(question.question);
      } else {
        const value = answer.value;
        if (value === '' || value === null || value === undefined ||
            (Array.isArray(value) && value.length === 0)) {
          missingQuestions.push(question.question);
        }
      }
    }
  });
  
  return {
    valid: missingQuestions.length === 0,
    missingQuestions,
  };
}

