
// 自施工工序定额表（工程）数据结构

export interface SelfConstructionItem {
  id: string;
  category: string;
  name: string;
  unit: string;
  quantity: number;
  price: number;
  remark: string;
}

export interface IntelligentItem {
  id: string;
  serialNumber: number;
  category: string;
  name: string;
  brandModel: string;
  description: string;
  deductibleTaxRate: number;
  unit: string;
  price: number;
  remark: string;
}

// 自施工工序定额数据
export const SELF_CONSTRUCTION_QUOTA: SelfConstructionItem[] = [
  {
    id: "1",
    category: "宽带、专线项目",
    name: "光缆布放",
    unit: "米",
    quantity: 1,
    price: 1.65,
    remark: "施工测量、做拉线、套架空/墙壁/管/暗管/槽道布放光缆、挂牌及光缆绑扎、余线盘留、保护套、GPS定位、引上、防水、封堵"
  },
  {
    id: "2",
    category: "宽带、专线项目",
    name: "埋式光缆布放（含套管，挖土、破路）",
    unit: "米",
    quantity: 1,
    price: 8,
    remark: "含施工测量、套管布放光缆、挂牌及光缆绑扎、余线盘留、保护套、GPS定位、引上、防水、封堵等，挖土、破路（含材料）需上系统走隐蔽流程，未走完流程只计取光缆加套管费用3元"
  },
  {
    id: "3",
    category: "宽带、专线项目",
    name: "埋式光缆布放（含套管，包封）",
    unit: "米",
    quantity: 1,
    price: 10,
    remark: "含施工测量、套管布放光缆、挂牌及光缆绑扎、余线盘留、保护套、GPS定位、引上、防水、封堵等，包封（含材料）需上系统走隐蔽流程，未走完流程只计取光缆加套管费用3元"
  },
  {
    id: "4",
    category: "宽带、专线项目",
    name: "光缆掏纤(4芯以下)",
    unit: "处",
    quantity: 1,
    price: 40,
    remark: "确定掏纤位置、开剥外保护套、分纤通光纤保护、盘留、固定等"
  },
  {
    id: "5",
    category: "宽带、专线项目",
    name: "光缆成端接续",
    unit: "芯",
    quantity: 1,
    price: 10,
    remark: "光纤套管保护、熔接.打印标签、固定、光纤芯分配图、面板占用图"
  },
  {
    id: "6",
    category: "宽带、专线项目",
    name: "安装光分纤箱",
    unit: "个",
    quantity: 1,
    price: 50,
    remark: "分纤箱固定、安装附件、布放接地线、制作标签"
  },
  {
    id: "7",
    category: "宽带、专线项目",
    name: "分光器成端（1:8及以下）",
    unit: "个",
    quantity: 1,
    price: 50,
    remark: "制作标签、尾纤盘留、固定等"
  },
  {
    id: "8",
    category: "宽带、专线项目",
    name: "分光器成端（1:16及以上）",
    unit: "个",
    quantity: 1,
    price: 80,
    remark: "制作标签、尾纤盘留、固定等"
  },
  {
    id: "9",
    category: "宽带、专线项目",
    name: "跳纤",
    unit: "条",
    quantity: 1,
    price: 5,
    remark: "含布放跳纤、盘留、两端标签、占用图更新"
  },
  {
    id: "10",
    category: "宽带、专线项目",
    name: "立杆(8米以下)",
    unit: "根",
    quantity: 1,
    price: 100,
    remark: "立杆、校直、做保护帽等"
  },
  {
    id: "11",
    category: "宽带、专线项目",
    name: "立杆(8米及以上)",
    unit: "根",
    quantity: 1,
    price: 150,
    remark: "立杆、校直、做保护帽等"
  },
  {
    id: "12",
    category: "宽带、专线项目",
    name: "做拉线",
    unit: "条",
    quantity: 1,
    price: 50,
    remark: "含安装地锚、拉线上把、中把、下把、收紧拉线、制作拉线保护等"
  },
  {
    id: "13",
    category: "宽带、专线项目",
    name: "安装架空吊线(7/2.2及以下)",
    unit: "米",
    quantity: 1,
    price: 2,
    remark: "安装挂钩、布放钢绞线、收紧、做终端拉线、中间辅助拉线等"
  },
  {
    id: "14",
    category: "宽带、专线项目",
    name: "安装墙壁吊线",
    unit: "米",
    quantity: 1,
    price: 3,
    remark: "安装支撑物、布放钢绞线、收紧、做终端固定等"
  },
  {
    id: "15",
    category: "宽带、专线项目",
    name: "拆除光缆",
    unit: "米",
    quantity: 1,
    price: 0.5,
    remark: "拆除架空/墙壁/管道光缆、整理现场等"
  },
  {
    id: "16",
    category: "宽带、专线项目",
    name: "拆除电杆",
    unit: "根",
    quantity: 1,
    price: 80,
    remark: "拆除拉线、放倒电杆、清理现场等"
  },
  {
    id: "17",
    category: "宽带、专线项目",
    name: "拆除吊线",
    unit: "米",
    quantity: 1,
    price: 1,
    remark: "拆除挂钩、钢绞线、清理现场等"
  },
  {
    id: "18",
    category: "宽带、专线项目",
    name: "光纤测试(单端)",
    unit: "芯",
    quantity: 1,
    price: 5,
    remark: "光源光功率计测试"
  },
  {
    id: "19",
    category: "宽带、专线项目",
    name: "光纤测试(双端)",
    unit: "芯",
    quantity: 1,
    price: 10,
    remark: "OTDR测试"
  },
  {
    id: "20",
    category: "宽带、专线项目",
    name: "安装光交箱",
    unit: "个",
    quantity: 1,
    price: 200,
    remark: "光交箱固定、安装附件、布放接地线、制作标签、成端等"
  },
  {
    id: "21",
    category: "宽带、专线项目",
    name: "安装ODF架",
    unit: "架",
    quantity: 1,
    price: 150,
    remark: "ODF架固定、安装附件、制作标签等"
  },
  {
    id: "22",
    category: "宽带、专线项目",
    name: "安装综合配线架",
    unit: "架",
    quantity: 1,
    price: 200,
    remark: "综合配线架固定、安装附件、制作标签等"
  },
  {
    id: "23",
    category: "宽带、专线项目",
    name: "安装网络机柜",
    unit: "个",
    quantity: 1,
    price: 100,
    remark: "机柜固定、安装附件、布放接地线、制作标签等"
  },
  {
    id: "24",
    category: "宽带、专线项目",
    name: "安装路由器",
    unit: "台",
    quantity: 1,
    price: 100,
    remark: "路由器固定、安装附件、布放电源线、制作标签、配置等"
  },
  {
    id: "25",
    category: "宽带、专线项目",
    name: "安装交换机",
    unit: "台",
    quantity: 1,
    price: 80,
    remark: "交换机固定、安装附件、布放电源线、制作标签、配置等"
  },
  {
    id: "26",
    category: "宽带、专线项目",
    name: "安装收发器",
    unit: "台",
    quantity: 1,
    price: 50,
    remark: "收发器固定、安装附件、布放电源线、制作标签等"
  },
  {
    id: "27",
    category: "宽带、专线项目",
    name: "安装光端机",
    unit: "台",
    quantity: 1,
    price: 80,
    remark: "光端机固定、安装附件、布放电源线、制作标签、配置等"
  },
  {
    id: "28",
    category: "宽带、专线项目",
    name: "安装协议转换器",
    unit: "台",
    quantity: 1,
    price: 60,
    remark: "协议转换器固定、安装附件、布放电源线、制作标签、配置等"
  },
  {
    id: "29",
    category: "宽带、专线项目",
    name: "安装防火墙",
    unit: "台",
    quantity: 1,
    price: 200,
    remark: "防火墙固定、安装附件、布放电源线、制作标签、配置等"
  },
  {
    id: "30",
    category: "常规内部布线",
    name: "布放网线（五类及以下）",
    unit: "米",
    quantity: 1,
    price: 2,
    remark: "布放网线、穿管、绑扎、做标记等"
  },
  {
    id: "31",
    category: "常规内部布线",
    name: "布放网线（六类及以上）",
    unit: "米",
    quantity: 1,
    price: 3,
    remark: "布放网线、穿管、绑扎、做标记等"
  },
  {
    id: "32",
    category: "常规内部布线",
    name: "制作水晶头",
    unit: "个",
    quantity: 1,
    price: 2,
    remark: "剥线、理线、压接水晶头、测试等"
  },
  {
    id: "33",
    category: "常规内部布线",
    name: "布放光电复合缆",
    unit: "米",
    quantity: 1,
    price: 5,
    remark: "布放光电复合缆、穿管、绑扎、做标记等"
  },
  {
    id: "34",
    category: "常规内部布线",
    name: "敷设PVC管（φ25及以下）",
    unit: "米",
    quantity: 1,
    price: 3,
    remark: "测量、下料、布管、固定、连接等"
  },
  {
    id: "35",
    category: "常规内部布线",
    name: "敷设PVC管（φ32及以上）",
    unit: "米",
    quantity: 1,
    price: 5,
    remark: "测量、下料、布管、固定、连接等"
  },
  {
    id: "36",
    category: "常规内部布线",
    name: "安装信息面板",
    unit: "个",
    quantity: 1,
    price: 10,
    remark: "固定面板、安装模块、制作标签等"
  },
  {
    id: "37",
    category: "常规内部布线",
    name: "安装网络配线架",
    unit: "个",
    quantity: 1,
    price: 50,
    remark: "固定配线架、安装模块、制作标签、理线等"
  },
  {
    id: "38",
    category: "常规内部布线",
    name: "网络测试",
    unit: "点",
    quantity: 1,
    price: 5,
    remark: "使用网络测试仪测试连通性、线序等"
  },
  {
    id: "39",
    category: "常规内部布线",
    name: "安装电源插座",
    unit: "个",
    quantity: 1,
    price: 20,
    remark: "定位、开槽、布管、穿线、安装插座、接线等"
  },
  {
    id: "40",
    category: "常规内部布线",
    name: "布放电源线（2.5mm²及以下）",
    unit: "米",
    quantity: 1,
    price: 3,
    remark: "布放电源线、穿管、绑扎、做标记等"
  },
  {
    id: "41",
    category: "常规内部布线",
    name: "布放电源线（4mm²及以上）",
    unit: "米",
    quantity: 1,
    price: 5,
    remark: "布放电源线、穿管、绑扎、做标记等"
  }
];

// 集成商智能化项目报价数据
export const INTELLIGENT_PROJECT_QUOTA: IntelligentItem[] = [
  {
    id: "I-1",
    serialNumber: 1,
    category: "设备",
    name: "高清网络摄像机（枪机）",
    brandModel: "海康威视DS-2CD3T46WD-I3",
    description: "400万像素，红外夜视，支持POE",
    deductibleTaxRate: 13,
    unit: "台",
    price: 850,
    remark: "含电源、支架"
  },
  {
    id: "I-2",
    serialNumber: 2,
    category: "设备",
    name: "高清网络摄像机（半球）",
    brandModel: "海康威视DS-2CD3346WD-I",
    description: "400万像素，红外夜视，支持POE",
    deductibleTaxRate: 13,
    unit: "台",
    price: 750,
    remark: "含电源、支架"
  },
  {
    id: "I-3",
    serialNumber: 3,
    category: "设备",
    name: "高清网络摄像机（球机）",
    brandModel: "海康威视DS-2DC4423IW-D",
    description: "400万像素，23倍光学变焦，红外夜视",
    deductibleTaxRate: 13,
    unit: "台",
    price: 2800,
    remark: "含电源、支架"
  },
  {
    id: "I-4",
    serialNumber: 4,
    category: "设备",
    name: "视频云存储节点",
    brandModel: "海康威视DS-A71048R",
    description: "48盘位，支持RAID5/6",
    deductibleTaxRate: 13,
    unit: "台",
    price: 35000,
    remark: "含硬盘48块"
  },
  {
    id: "I-5",
    serialNumber: 5,
    category: "设备",
    name: "企业级固态硬盘",
    brandModel: "希捷ST8000NM000A",
    description: "8TB，SATA接口",
    deductibleTaxRate: 13,
    unit: "块",
    price: 1200,
    remark: "3年质保"
  },
  {
    id: "I-6",
    serialNumber: 6,
    category: "设备",
    name: "监控级硬盘",
    brandModel: "希捷ST4000VX007",
    description: "4TB，SATA接口",
    deductibleTaxRate: 13,
    unit: "块",
    price: 650,
    remark: "3年质保"
  },
  {
    id: "I-7",
    serialNumber: 7,
    category: "设备",
    name: "网络交换机（8口）",
    brandModel: "华为S1730S-L8T-A",
    description: "8口千兆，非网管",
    deductibleTaxRate: 13,
    unit: "台",
    price: 350,
    remark: ""
  },
  {
    id: "I-8",
    serialNumber: 8,
    category: "设备",
    name: "网络交换机（24口）",
    brandModel: "华为S1730S-L24T-A",
    description: "24口千兆，非网管",
    deductibleTaxRate: 13,
    unit: "台",
    price: 850,
    remark: ""
  },
  {
    id: "I-9",
    serialNumber: 9,
    category: "设备",
    name: "网络交换机（48口）",
    brandModel: "华为S1730S-L48T-A",
    description: "48口千兆，非网管",
    deductibleTaxRate: 13,
    unit: "台",
    price: 1600,
    remark: ""
  },
  {
    id: "I-10",
    serialNumber: 10,
    category: "设备",
    name: "POE交换机（8口）",
    brandModel: "华为S1730S-L8P-A",
    description: "8口千兆POE，非网管",
    deductibleTaxRate: 13,
    unit: "台",
    price: 550,
    remark: ""
  },
  {
    id: "I-11",
    serialNumber: 11,
    category: "设备",
    name: "POE交换机（24口）",
    brandModel: "华为S1730S-L24P-A",
    description: "24口千兆POE，非网管",
    deductibleTaxRate: 13,
    unit: "台",
    price: 1500,
    remark: ""
  },
  {
    id: "I-12",
    serialNumber: 12,
    category: "设备",
    name: "网络硬盘录像机（8路）",
    brandModel: "海康威视DS-7808N-K2",
    description: "8路，2盘位",
    deductibleTaxRate: 13,
    unit: "台",
    price: 650,
    remark: "含硬盘2块"
  },
  {
    id: "I-13",
    serialNumber: 13,
    category: "设备",
    name: "网络硬盘录像机（16路）",
    brandModel: "海康威视DS-7816N-K2",
    description: "16路，2盘位",
    deductibleTaxRate: 13,
    unit: "台",
    price: 950,
    remark: "含硬盘2块"
  },
  {
    id: "I-14",
    serialNumber: 14,
    category: "设备",
    name: "网络硬盘录像机（32路）",
    brandModel: "海康威视DS-7932N-R4",
    description: "32路，4盘位",
    deductibleTaxRate: 13,
    unit: "台",
    price: 1800,
    remark: "含硬盘4块"
  },
  {
    id: "I-15",
    serialNumber: 15,
    category: "设备",
    name: "监视器（22英寸）",
    brandModel: "海康威视DS-D5022QD",
    description: "22英寸，LED背光",
    deductibleTaxRate: 13,
    unit: "台",
    price: 950,
    remark: "含支架"
  },
  {
    id: "I-16",
    serialNumber: 16,
    category: "设备",
    name: "监视器（42英寸）",
    brandModel: "海康威视DS-D5042U",
    description: "42英寸，LED背光，4K",
    deductibleTaxRate: 13,
    unit: "台",
    price: 3200,
    remark: "含支架"
  },
  {
    id: "I-17",
    serialNumber: 17,
    category: "施工安装",
    name: "摄像机安装（枪机）",
    brandModel: "",
    description: "包括定位、固定、接线、调试",
    deductibleTaxRate: 6,
    unit: "台",
    price: 150,
    remark: "含辅料"
  },
  {
    id: "I-18",
    serialNumber: 18,
    category: "施工安装",
    name: "摄像机安装（半球）",
    brandModel: "",
    description: "包括定位、固定、接线、调试",
    deductibleTaxRate: 6,
    unit: "台",
    price: 120,
    remark: "含辅料"
  },
  {
    id: "I-19",
    serialNumber: 19,
    category: "施工安装",
    name: "摄像机安装（球机）",
    brandModel: "",
    description: "包括定位、固定、接线、调试",
    deductibleTaxRate: 6,
    unit: "台",
    price: 250,
    remark: "含辅料"
  },
  {
    id: "I-20",
    serialNumber: 20,
    category: "施工安装",
    name: "安装L杆",
    brandModel: "",
    description: "包括立杆、基础、接地",
    deductibleTaxRate: 6,
    unit: "根",
    price: 800,
    remark: "含基础材料"
  },
  {
    id: "I-21",
    serialNumber: 21,
    category: "施工安装",
    name: "安装八角杆",
    brandModel: "",
    description: "包括立杆、基础、接地",
    deductibleTaxRate: 6,
    unit: "根",
    price: 1200,
    remark: "含基础材料"
  },
  {
    id: "I-22",
    serialNumber: 22,
    category: "施工安装",
    name: "球机旋转杆",
    brandModel: "",
    description: "包括安装、固定、调试",
    deductibleTaxRate: 6,
    unit: "根",
    price: 500,
    remark: "含辅料"
  },
  {
    id: "I-23",
    serialNumber: 23,
    category: "施工安装",
    name: "设备箱安装",
    brandModel: "",
    description: "包括定位、固定、接线、接地",
    deductibleTaxRate: 6,
    unit: "个",
    price: 200,
    remark: "含辅料"
  },
  {
    id: "I-24",
    serialNumber: 24,
    category: "施工安装",
    name: "网络设备安装",
    brandModel: "",
    description: "包括固定、接线、配置、调试",
    deductibleTaxRate: 6,
    unit: "台",
    price: 100,
    remark: "含辅料"
  },
  {
    id: "I-25",
    serialNumber: 25,
    category: "施工安装",
    name: "存储设备安装",
    brandModel: "",
    description: "包括固定、接线、配置、调试",
    deductibleTaxRate: 6,
    unit: "台",
    price: 300,
    remark: "含辅料"
  },
  {
    id: "I-26",
    serialNumber: 26,
    category: "施工安装",
    name: "监视器安装",
    brandModel: "",
    description: "包括固定、接线、调试",
    deductibleTaxRate: 6,
    unit: "台",
    price: 150,
    remark: "含辅料"
  },
  {
    id: "I-27",
    serialNumber: 27,
    category: "施工安装",
    name: "系统调试",
    brandModel: "",
    description: "包括系统联调、功能测试、培训",
    deductibleTaxRate: 6,
    unit: "项",
    price: 2000,
    remark: "按项目规模"
  },
  {
    id: "I-28",
    serialNumber: 28,
    category: "施工安装",
    name: "布放网线（五类）",
    brandModel: "",
    description: "包括布放、穿管、绑扎、测试",
    deductibleTaxRate: 6,
    unit: "米",
    price: 3,
    remark: "含网线"
  },
  {
    id: "I-29",
    serialNumber: 29,
    category: "施工安装",
    name: "布放网线（六类）",
    brandModel: "",
    description: "包括布放、穿管、绑扎、测试",
    deductibleTaxRate: 6,
    unit: "米",
    price: 5,
    remark: "含网线"
  },
  {
    id: "I-30",
    serialNumber: 30,
    category: "施工安装",
    name: "布放光缆",
    brandModel: "",
    description: "包括布放、穿管、绑扎、测试",
    deductibleTaxRate: 6,
    unit: "米",
    price: 4,
    remark: "含光缆"
  },
  {
    id: "I-31",
    serialNumber: 31,
    category: "施工安装",
    name: "布放电源线",
    brandModel: "",
    description: "包括布放、穿管、绑扎、测试",
    deductibleTaxRate: 6,
    unit: "米",
    price: 4,
    remark: "含电源线"
  },
  {
    id: "I-32",
    serialNumber: 32,
    category: "施工安装",
    name: "敷设PVC管（φ25）",
    brandModel: "",
    description: "包括测量、下料、布管、固定",
    deductibleTaxRate: 6,
    unit: "米",
    price: 5,
    remark: "含管材"
  },
  {
    id: "I-33",
    serialNumber: 33,
    category: "施工安装",
    name: "敷设PVC管（φ32）",
    brandModel: "",
    description: "包括测量、下料、布管、固定",
    deductibleTaxRate: 6,
    unit: "米",
    price: 7,
    remark: "含管材"
  },
  {
    id: "I-34",
    serialNumber: 34,
    category: "施工安装",
    name: "开挖路面（混凝土）",
    brandModel: "",
    description: "包括切割、开挖、回填、恢复",
    deductibleTaxRate: 6,
    unit: "米",
    price: 150,
    remark: "含材料"
  },
  {
    id: "I-35",
    serialNumber: 35,
    category: "施工安装",
    name: "开挖路面（沥青）",
    brandModel: "",
    description: "包括切割、开挖、回填、恢复",
    deductibleTaxRate: 6,
    unit: "米",
    price: 200,
    remark: "含材料"
  },
  {
    id: "I-36",
    serialNumber: 36,
    category: "施工安装",
    name: "光缆熔接",
    brandModel: "",
    description: "包括开剥、熔接、测试、盘留",
    deductibleTaxRate: 6,
    unit: "芯",
    price: 15,
    remark: ""
  },
  {
    id: "I-37",
    serialNumber: 37,
    category: "施工安装",
    name: "光缆测试",
    brandModel: "",
    description: "包括OTDR测试、光功率测试",
    deductibleTaxRate: 6,
    unit: "芯",
    price: 10,
    remark: ""
  }
];

