
// 自施工工序定额表（工程）数据结构

export interface SelfConstructionItem {
  id: string;
  category: string;
  projectName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  remark: string;
}

export interface IntelligentItem {
  id: string;
  serialNumber: number;
  projectName: string;
  brandModel: string;
  description: string;
  taxRate: number;
  unitPrice: number;
  remark: string;
}

// 自施工工序定额数据
export const SELF_CONSTRUCTION_QUOTA: SelfConstructionItem[] = [
  {
    id: "1",
    category: "宽带、专线项目",
    projectName: "光缆布放",
    unit: "米",
    quantity: 1,
    unitPrice: 1.65,
    remark: "施工测量、做拉线、套架空/墙壁/管/暗管/槽道布放光缆、挂牌及光缆绑扎、余线盘留、保护套、GPS定位、引上、防水、封堵"
  },
  {
    id: "2",
    category: "宽带、专线项目",
    projectName: "埋式光缆布放（含套管，挖土、破路）",
    unit: "米",
    quantity: 1,
    unitPrice: 8,
    remark: "含施工测量、套管布放光缆、挂牌及光缆绑扎、余线盘留、保护套、GPS定位、引上、防水、封堵等，挖土、破路（含材料）需上系统走隐蔽流程，未走完流程只计取光缆加套管费用3元"
  },
  {
    id: "3",
    category: "宽带、专线项目",
    projectName: "埋式光缆布放（含套管，包封）",
    unit: "米",
    quantity: 1,
    unitPrice: 10,
    remark: "含施工测量、套管布放光缆、挂牌及光缆绑扎、余线盘留、保护套、GPS定位、引上、防水、封堵等，包封（含材料）需上系统走隐蔽流程，未走完流程只计取光缆加套管费用3元"
  },
  {
    id: "4",
    category: "宽带、专线项目",
    projectName: "光缆掏纤(4芯以下)",
    unit: "处",
    quantity: 1,
    unitPrice: 40,
    remark: "确定掏纤位置、开剥外保护套、分纤通光纤保护、盘留、固定等"
  },
  {
    id: "5",
    category: "宽带、专线项目",
    projectName: "光缆成端接续",
    unit: "芯",
    quantity: 1,
    unitPrice: 10,
    remark: "光纤套管保护、熔接.打印标签、固定、光纤芯分配图、面板占用图"
  },
  {
    id: "6",
    category: "宽带、专线项目",
    projectName: "安装光分纤箱",
    unit: "个",
    quantity: 1,
    unitPrice: 50,
    remark: "分纤箱固定、安装附件、布放接地线、制作标签"
  },
  {
    id: "7",
    category: "宽带、专线项目",
    projectName: "安装机柜、机架、壁挂光交箱、ODF架",
    unit: "架",
    quantity: 1,
    unitPrice: 150,
    remark: "箱体安装固定，安装附件、布放接地线、制作标签"
  },
  {
    id: "8",
    category: "宽带、专线项目",
    projectName: "安装落地式光交箱（含基座）",
    unit: "个",
    quantity: 1,
    unitPrice: 450,
    remark: "挖填土方、制作基座、安装光交、安装接地线、喷号（含材料）"
  },
  {
    id: "9",
    category: "宽带、专线项目",
    projectName: "安装设备（SSAP5U设备）",
    unit: "台",
    quantity: 1,
    unitPrice: 300,
    remark: "安装调测设备、制作标签，每增加1个跳纤路由图增加200元，只本站跳纤的除外。"
  },
  {
    id: "10",
    category: "宽带、专线项目",
    projectName: "安装设备（ITN、IAD、交换机、服务器、路由器等）",
    unit: "台",
    quantity: 1,
    unitPrice: 120,
    remark: "安装调测设备、制作标签"
  },
  {
    id: "11",
    category: "宽带、专线项目",
    projectName: "安装设备（ONU、网关、分光器等）",
    unit: "台",
    quantity: 1,
    unitPrice: 60,
    remark: "安装调测设备、制作标签"
  },
  {
    id: "12",
    category: "宽带、专线项目",
    projectName: "信息插座盒",
    unit: "个",
    quantity: 1,
    unitPrice: 10,
    remark: "绑扎固定光纤、安装光纤连接器及面板、做标记等"
  },
  {
    id: "13",
    category: "宽带、专线项目",
    projectName: "扩装板卡",
    unit: "块",
    quantity: 1,
    unitPrice: 36,
    remark: "扩装板卡、制作标签"
  },
  {
    id: "14",
    category: "宽带、专线项目",
    projectName: "卡接配线架电缆 ",
    unit: "条",
    quantity: 1,
    unitPrice: 1.9,
    remark: "卡线、制作标签"
  },
  {
    id: "15",
    category: "宽带、专线项目",
    projectName: "跳纤（末端跳纤）",
    unit: "条",
    quantity: 1,
    unitPrice: 12,
    remark: "放绑软光纤、固定软光纤连接器（活接头）、网络信息标签"
  },
  {
    id: "16",
    category: "宽带、专线项目",
    projectName: "中间站跳纤",
    unit: "条",
    quantity: 1,
    unitPrice: 70,
    remark: "放绑软光纤、固定软光纤连接器（活接头）、网络信息标签"
  },
  {
    id: "17",
    category: "宽带、专线项目",
    projectName: "跳纤（机房端跳纤）",
    unit: "条",
    quantity: 1,
    unitPrice: 30,
    remark: "放绑软光纤、固定软光纤连接器（活接头）、网络信息标签"
  },
  {
    id: "18",
    category: "宽带、专线项目",
    projectName: "架设钢绞线",
    unit: "米",
    quantity: 1,
    unitPrice: 0.5,
    remark: "布放吊线、紧线、做终结等"
  },
  {
    id: "19",
    category: "宽带、专线项目",
    projectName: "立9米以下水泥杆（专线）",
    unit: "根",
    quantity: 1,
    unitPrice: 250,
    remark: "专线无赔补，不建议立杆"
  },
  {
    id: "20",
    category: "宽带、专线项目",
    projectName: "水泥杆7/2.6拉线（专线）",
    unit: "条",
    quantity: 1,
    unitPrice: 120,
    remark: "专线无赔补，不建议拉线"
  },
  {
    id: "21",
    category: "宽带、专线项目",
    projectName: "立9米以下水泥杆（宽带）",
    unit: "根",
    quantity: 1,
    unitPrice: 400,
    remark: "宽带项目（含搬运赔补，立杆赔补）"
  },
  {
    id: "22",
    category: "宽带、专线项目",
    projectName: "水泥杆7/2.6拉线（宽带）",
    unit: "条",
    quantity: 1,
    unitPrice: 200,
    remark: "宽带项目（含拉线赔补）"
  },
  {
    id: "23",
    category: "宽带、专线项目",
    projectName: "布放电源线",
    unit: "米",
    quantity: 1,
    unitPrice: 1.3,
    remark: "布放电源线"
  },
  {
    id: "24",
    category: "宽带、专线项目",
    projectName: "敷设PVC管、PVC线槽",
    unit: "米",
    quantity: 1,
    unitPrice: 1.5,
    remark: "专线、宽带项目，敷设PVC管线槽"
  },
  {
    id: "25",
    category: "宽带、专线项目",
    projectName: "专线项目赔补费",
    unit: "点",
    quantity: 1,
    unitPrice: 200,
    remark: "专线项目按条计取，不再计取宽带部分赔补"
  },
  {
    id: "26",
    category: "宽带、专线项目",
    projectName: "打穿楼墙洞",
    unit: "个",
    quantity: 1,
    unitPrice: 7,
    remark: "打楼墙洞，需上系统走完隐蔽流程才能计取"
  },
  {
    id: "27",
    category: "宽带、专线项目",
    projectName: "打穿人手孔洞",
    unit: "处",
    quantity: 1,
    unitPrice: 40,
    remark: "打人手孔洞，需上系统走完隐蔽流程才能计取"
  },
  {
    id: "28",
    category: "宽带、专线项目",
    projectName: "安装引上钢管",
    unit: "根",
    quantity: 1,
    unitPrice: 40,
    remark: "安装绑扎钢管、穿放引上光缆、子管保护、孔洞封堵"
  },
  {
    id: "29",
    category: "宽带、专线项目",
    projectName: "调遣费",
    unit: "点",
    quantity: 1,
    unitPrice: 300,
    remark: "单个点位调遣费只记取一次，按各区县铁通驻点至目标施工站点超过35公里"
  },
  {
    id: "30",
    category: "常规内部布线",
    projectName: "布放网线、皮线光缆",
    unit: "米",
    quantity: 1,
    unitPrice: 0.55,
    remark: "管、暗槽内穿放和桥架、线槽、网络地板内明布；制做穿线端头(钩)、穿放引线、穿放光缆出口衬垫、做标记、封堵出口等。（含熔接、量裁缆线、制做跳线连接器、检验测试等。）"
  },
  {
    id: "31",
    category: "常规内部布线",
    projectName: "制作水晶头",
    unit: "个",
    quantity: 1,
    unitPrice: 2.4,
    remark: "制作水晶头、卡线、制作标签等"
  },
  {
    id: "32",
    category: "常规内部布线",
    projectName: "光电复合缆",
    unit: "米",
    quantity: 1,
    unitPrice: 3.2,
    remark: "管、暗槽内穿放和桥架、线槽、网络地板内明布；制做穿线端头(钩)、穿放引线、穿放光缆出口衬垫、做标记、封堵出口等。"
  },
  {
    id: "33",
    category: "常规内部布线",
    projectName: "敷设PVC管、PVC线槽",
    unit: "米",
    quantity: 1,
    unitPrice: 1.5,
    remark: "敷设PVC管线槽"
  }
];

// 集成商智能化项目报价数据
export const INTELLIGENT_PROJECT_QUOTA: IntelligentItem[] = [
  {
    id: "1",
    serialNumber: 1,
    projectName: "高清网络摄像机",
    brandModel: "定制",
    description: "",
    taxRate: 0.09,
    unitPrice: 400,
    remark: ""
  },
  {
    id: "2",
    serialNumber: 2,
    projectName: "视频云存储节点",
    brandModel: "台",
    description: "",
    taxRate: 0.09,
    unitPrice: 500,
    remark: ""
  },
  {
    id: "3",
    serialNumber: 3,
    projectName: "固态硬盘",
    brandModel: "块",
    description: "",
    taxRate: 0.09,
    unitPrice: 10,
    remark: ""
  },
  {
    id: "4",
    serialNumber: 4,
    projectName: "交换机",
    brandModel: "台",
    description: "",
    taxRate: 0.09,
    unitPrice: 300,
    remark: ""
  },
  {
    id: "5",
    serialNumber: 5,
    projectName: "服务器类",
    brandModel: "台",
    description: "",
    taxRate: 0.09,
    unitPrice: 400,
    remark: ""
  },
  {
    id: "6",
    serialNumber: 6,
    projectName: "LED补光灯",
    brandModel: "台",
    description: "",
    taxRate: 0.09,
    unitPrice: 150,
    remark: ""
  },
  {
    id: "7",
    serialNumber: 7,
    projectName: "测速测评",
    brandModel: "项",
    description: "",
    taxRate: 0.09,
    unitPrice: 0,
    remark: "不含"
  },
  {
    id: "8",
    serialNumber: 8,
    projectName: "L杆(施工安装)",
    brandModel: "定制3米",
    description: "",
    taxRate: 0.09,
    unitPrice: 700,
    remark: ""
  },
  {
    id: "9",
    serialNumber: 9,
    projectName: "L杆(施工安装)",
    brandModel: "定制4.5米",
    description: "",
    taxRate: 0.09,
    unitPrice: 1600,
    remark: ""
  },
  {
    id: "10",
    serialNumber: 10,
    projectName: "L杆(施工安装)",
    brandModel: "定制6米",
    description: "",
    taxRate: 0.09,
    unitPrice: 2000,
    remark: ""
  },
  {
    id: "11",
    serialNumber: 11,
    projectName: "八角杆(施工安装）",
    brandModel: "6*8",
    description: "",
    taxRate: 0.09,
    unitPrice: 4000,
    remark: ""
  },
  {
    id: "12",
    serialNumber: 12,
    projectName: "八角杆(施工安装）",
    brandModel: "6*12",
    description: "",
    taxRate: 0.09,
    unitPrice: 5000,
    remark: ""
  },
  {
    id: "13",
    serialNumber: 13,
    projectName: "壁挂与施工",
    brandModel: "0.5-1米",
    description: "",
    taxRate: 0.09,
    unitPrice: 500,
    remark: ""
  },
  {
    id: "14",
    serialNumber: 14,
    projectName: "球机旋转杆与施工",
    brandModel: "",
    description: "",
    taxRate: 0.09,
    unitPrice: 800,
    remark: ""
  },
  {
    id: "15",
    serialNumber: 15,
    projectName: "安装普通箱",
    brandModel: "定制",
    description: "",
    taxRate: 0.09,
    unitPrice: 150,
    remark: ""
  },
  {
    id: "16",
    serialNumber: 16,
    projectName: "验收费",
    brandModel: "定制",
    description: "",
    taxRate: 0.06,
    unitPrice: 0,
    remark: ""
  }
];

