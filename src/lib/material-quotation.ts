// 设备辅材报价数据
// 来源: 设备辅材报价V1.xlsx

export interface MaterialItem {
  name: string;
  unit: string;
  brand: string;
  model: string;
  specs: string;
  remark: string;
  price: number;
}

export const MATERIAL_QUOTATION: MaterialItem[] = [
  {
    name: "POE枪机",
    unit: "台",
    brand: "海康威视",
    model: "DS-2CD224HY/XJS POE",
    specs: "400万筒型网络摄像机\n最高分辨率可达2560 × 1440 @25 fps\n支持SmartIR，防止夜间红外过曝\n支持背光补偿，强光抑制，3D数字降噪，数字宽动态，适应不同使用环境\n支持开放型网络视频接口，ISAPI，SDK，GB28181协议，支持萤石平台接入\n1个内置麦克风\n智能补光，支持白光/红外双补光，红外光最远可达50 m，白光最远可达30 m\n符合IP67防尘防水设计，可靠性高\n\n传感器类型：1/2.7\" Progressive Scan CMOS\n最低照度：彩色：0.005 Lux \n宽动态：数字宽动态 \n焦距&视场角：4 mm，水平视场角：70°，垂直视场角：35°，对角视场角：85°\n6 mm，水平视场角：46°，垂直视场角：24°，对角视场角：54°\n8 mm，水平视场角：43°，垂直视场角：24°，对角视场角：50°\n12 mm，水平视场角：27°，垂直视场角：15°，对角视场角：31°  \n红外波长范围：850 nm\n防补光过曝：支持\n补光灯类型：智能补光，可切换白光灯、红外灯\n补光距离：红外光最远可达50 m，白光最远可达30 m  \n最大分辨率：2560 × 1440\n视频压缩标准：主码流：H.265/H.264/Smart264/Smart265\n子码流：H.265/H.264 \n音频：1个内置麦克风\n网络：1个RJ45 10 M/100 M自适应以太网口 \n启动及工作温湿度：-30 ℃~60 ℃，湿度小于95%（无凝结）\n存储温湿度：-30 ℃~60 ℃，湿度小于95%（无凝结）\n恢复出厂设置：支持客户端或浏览器恢复\n供电方式：DC：12 V ± 25%，支持防反接保护\nPoE：IEEE 802.3af，Class 3\n电流及功耗：DC：12 V，0.42 A，最大功耗：5 W\nPoE：IEEE 802.3af，CLASS 3，最大功耗：6.5 W\n电源接口类型：Ø5.5 mm圆口\n产品尺寸：87.1 × 83.7 × 171.7 mm\n包装尺寸：216 × 121 × 118 mm\n设备重量：360 g\n带包装重量：540 g \n防护：IP67",
    remark: "海康DS-2CD1245-LA POE 1系列400万白光全彩 枪机",
    price: 204.96
  },
  {
    name: "POE双摄球机",
    unit: "台",
    brand: "海康威视",
    model: "DS-2SC3C144MW-TE",
    specs: "• 3寸双光4倍全景细节枪球\n• 全景路为定焦镜头，支持垂直方向7~17°手动可调\n• 细节路支持4倍光学变倍（2.8-12mm）；16倍数字变倍\n• 全景支持最大2560 × 1440 @30 fps高清画面输出\n• 细节支持最大2560 × 1440 @30 fps高清画面输出\n• 支持高效补光阵列，细节路红外照射距离最远可达40 m；全景路红外照射距离最远可达30 m，白光照射距离最远可达30 m\n• 设备自带麦克风和喇叭，支持双向语音对讲\n• 设备自带支架，支持壁装、吊装两种安装方式，支架支持水平360°旋转方位\n• 支持双路区域入侵、越界侦测、进入区域侦测及离开区域侦测，支持设置布防后联动报警音\n• 支持编码套餐功能：支持画质优先、存储优先、均衡模式、自定义四种编码模式（默认画质优先），存储优先模式采用H265编码，有效降低码流大小\n• 支持点击联动功能，点击全景画面中位置可联动细节镜头得到特写画面\n• 支持联动追踪功能，全景路检测到移动目标（人、车）后，球机路可追踪移动目标（人、车）\n• 支持编码画中画功能：支持全景路+细节路画面画中画形式叠加，可进行预览并按照一路通道输出码流\n• 支持定时任务、一键守望、一键巡航\n• 支持海康SDK、开放型网络视频接口、ISAPI、GB/T28181、ISUP\n• 支持定时抓图与事件抓图功能\n• 支持ROI感兴趣区域增强编码、隐私遮蔽功能\n• 支持OSD颜色自选\n• IP66，抗干扰能力强，适用于严酷的电磁环境\n• 支持SVC自适应编码技术",
    remark: "",
    price: 204.96
  },
  {
    name: "POE半球",
    unit: "台",
    brand: "海康威视",
    model: "DS-2CD234HY/XJS",
    specs: "400万海螺型网络摄像机\n最高分辨率可达2560 × 1440 @25 fps\n支持SmartIR，防止夜间红外过曝\n支持背光补偿，强光抑制，3D数字降噪，数字宽动态，适应不同环境\n支持开放型网络视频接口，ISAPI，SDK，GB28181协议，支持萤石平台接入\n1个内置麦克风\n智能补光，支持白光/红外双补光，红外光最远可达30 m，白光最远可达20 m\n符合IP67防尘防水设计，可靠性高\n\n传感器类型：1/2.7\" Progressive Scan CMOS\n最低照度：彩色：0.005 Lux \n宽动态：数字宽动态\n调节角度：水平：0°~360°，垂直：0°~75°，旋转：0°~360° \n焦距&视场角：2.8 mm：水平视场角：94°，垂直视场角：49°，对角视场角：114°\n4 mm，水平视场角：70°，垂直视场角：35°，对角视场角：85°\n6 mm，水平视场角：46°，垂直视场角：24°，对角视场角：54°\n8 mm，水平视场角：43°，垂直视场角：24°，对角视场角：50°  \n红外波长范围：850 nm\n防补光过曝：支持\n补光灯类型：智能补光，可切换白光灯、红外灯\n补光距离：红外光最远可达30 m，白光最远可达20 m  \n最大分辨率：2560 × 1440\n视频压缩标准：主码流：H.265/H.264/Smart264/Smart265\n子码流：H.265/H.264 \n音频：1个内置麦克风\n网络：1个RJ45 10 M/100 M自适应以太网口 \n存储温湿度：-30 ℃~60 ℃，湿度小于95%（无凝结）\n启动及工作温湿度：-30 ℃~60 ℃，湿度小于95%（无凝结）\n恢复出厂设置：支持客户端或浏览器恢复\n供电方式：DC：12 V ± 25%，支持防反接保护\nPoE：IEEE 802.3af，CLASS 3\n电流及功耗：DC：12 V，0.42 A，最大功耗：5 W\nPoE： IEEE 802.3af，CLASS 3，最大功耗：6.5 W\n电源接口类型：Ø5.5 mm圆口\n产品尺寸：Ø110 × 93 mm\n包装尺寸：145 × 145 × 128 mm\n设备重量：290 g\n带包装重量：460 g \n防护：IP67",
    remark: "海康DS-2CD1345V2-LA  POE 1系列400万白光全彩半球",
    price: 204.96
  },
  {
    name: "普通枪机",
    unit: "台",
    brand: "海康威视",
    model: "DS-2CD224HY/XJS POE",
    specs: "400万筒型网络摄像机\n最高分辨率可达2560 × 1440 @25 fps\n支持SmartIR，防止夜间红外过曝\n支持背光补偿，强光抑制，3D数字降噪，数字宽动态，适应不同使用环境\n支持开放型网络视频接口，ISAPI，SDK，GB28181协议，支持萤石平台接入\n1个内置麦克风\n智能补光，支持白光/红外双补光，红外光最远可达50 m，白光最远可达30 m\n符合IP67防尘防水设计，可靠性高\n\n传感器类型：1/2.7\" Progressive Scan CMOS\n最低照度：彩色：0.005 Lux \n宽动态：数字宽动态 \n焦距&视场角：4 mm，水平视场角：70°，垂直视场角：35°，对角视场角：85°\n6 mm，水平视场角：46°，垂直视场角：24°，对角视场角：54°\n8 mm，水平视场角：43°，垂直视场角：24°，对角视场角：50°\n12 mm，水平视场角：27°，垂直视场角：15°，对角视场角：31°  \n红外波长范围：850 nm\n防补光过曝：支持\n补光灯类型：智能补光，可切换白光灯、红外灯\n补光距离：红外光最远可达50 m，白光最远可达30 m  \n最大分辨率：2560 × 1440\n视频压缩标准：主码流：H.265/H.264/Smart264/Smart265\n子码流：H.265/H.264 \n音频：1个内置麦克风\n网络：1个RJ45 10 M/100 M自适应以太网口 \n启动及工作温湿度：-30 ℃~60 ℃，湿度小于95%（无凝结）\n存储温湿度：-30 ℃~60 ℃，湿度小于95%（无凝结）\n恢复出厂设置：支持客户端或浏览器恢复\n供电方式：DC：12 V ± 25%，支持防反接保护\nPoE：IEEE 802.3af，Class 3\n电流及功耗：DC：12 V，0.42 A，最大功耗：5 W\nPoE：IEEE 802.3af，CLASS 3，最大功耗：6.5 W\n电源接口类型：Ø5.5 mm圆口\n产品尺寸：87.1 × 83.7 × 171.7 mm\n包装尺寸：216 × 121 × 118 mm\n设备重量：360 g\n带包装重量：540 g \n防护：IP67",
    remark: "海康DS-2CD1245-LA POE 1系列400万白光全彩 枪机",
    price: 204.96
  },
  {
    name: "一体化设备箱",
    unit: "个",
    brand: "海康威视",
    model: "400*300*180",
    specs: "内置自动重合闸，浪涌，模块化插座",
    remark: "定制",
    price: 364
  },
  {
    name: "摄像机电源",
    unit: "个",
    brand: "小耳朵",
    model: "XED-MZ2011FS",
    specs: "输出:DC12V/2A，室外防水",
    remark: "",
    price: 16.8
  },
  {
    name: "1光4电收发器",
    unit: "对",
    brand: "锐捷",
    model: "RG-FC14G-3B",
    specs: "4个10/100/1000Mbps自适应RJ45电口，1个1000Mbps SC光口，最大传输距离3kM，非网管型光纤收发器，与RG-FC11G-3A配套使用，不可配合RG-FCR14收发器机架使用。",
    remark: "",
    price: 96.32
  },
  {
    name: "1V1光纤收发器",
    unit: "对",
    brand: "锐捷",
    model: "RG-FC11G-3A",
    specs: "1个10/100/1000Mbps自适应RJ45电口，1个1000Mbps SC光口，最大传输距离3kM，非网管型光纤收发器，与RG-FC11G-3B或者RG-FC14G-3B配套使用，可配合RG-FCR14收发器机架使用。",
    remark: "",
    price: 89.6
  },
  {
    name: "8孔位排插",
    unit: "个",
    brand: "子弹头",
    model: "TS-025W",
    specs: "八位无线插排",
    remark: "国产",
    price: 109.76
  },
  {
    name: "12芯光缆",
    unit: "m",
    brand: "立孚",
    model: "LF-GYXTW-12B1.3",
    specs: "户外 GYXTW 型 12芯单模光缆 9/125室外光缆·线径 8.0",
    remark: "优联速  型号GYXTW12芯",
    price: 1.4336
  },
  {
    name: "4口交换机",
    unit: "台",
    brand: "",
    model: "交换机：海康DS-XS05GD 5口千兆 塑壳",
    specs: "",
    remark: "",
    price: 44.8
  },
  {
    name: "8口交换机",
    unit: "台",
    brand: "",
    model: "交换机：海康DS-XS08GD 8口千兆 塑壳",
    specs: "",
    remark: "",
    price: 80.64
  },
  {
    name: "核心交换机",
    unit: "台",
    brand: "",
    model: "锐捷RG-NBS3200-24SFP/8GT4XS",
    specs: "二层网管交换机，交换容量432Gbps，包转发率108Mpps，24个千兆光口，8个10/100/1000Mbps自适应复用电口，固化4个SFP+万兆光口，支持VLAN、ACL、端口镜像、端口聚合等功能，支持睿易APP和MACC云平台统一管理。",
    remark: "",
    price: 2867.2
  },
  {
    name: "24口交换机",
    unit: "台",
    brand: "锐捷",
    model: "RG-NBS3100-24GT4SFP V2",
    specs: "二层网管交换机，交换容量336Gbps，包转发率42Mpps，24口10/100/1000Mbps自适应电口交换机，固化4个SFP千兆光口，支持VLAN、ACL、端口镜像、端口聚合等功能，支持睿易APP和MACC云平台统一管理。",
    remark: "",
    price: 800.8
  },
  {
    name: "4口POE交换机",
    unit: "台",
    brand: "",
    model: "DS-XS06-P（B)",
    specs: "7W满接|百兆PoE|远距离传输，支持4个百兆PoE电口，2个百兆电口，整机PoE功率35W，支持红口保障",
    remark: "",
    price: 82.88
  },
  {
    name: "8口POE交换机",
    unit: "台",
    brand: "海康威视",
    model: "DS-3E1510P-110W-E",
    specs: "• 8个千兆PoE电口，1个千兆电口，1个千兆光口\n• 交换容量：20Gbps，包转发率：14.88Mpps\n• 符合IEEE802.3af/at供电标准，整机PoE功率110W\n• 支持易调试APP管理，一个APP管理安防和网络\n• APP展示网络拓扑、链路拥塞定位、重启PoE、配置VLAN\n• 支持桌面/壁挂式安装",
    remark: "DS-3E1510P-110W-E(国内标配)V4",
    price: 368.48
  },
  {
    name: "8口POE交换机",
    unit: "台",
    brand: "",
    model: "锐捷RG-ES209MG-P",
    specs: "2.5G云管PoE交换机，8个PoE 2.5G接入口+1个万兆上联光口，整机PoE输出功率130W，支持远程管理。",
    remark: "",
    price: 806.4
  },
  {
    name: "16口POE交换机",
    unit: "台",
    brand: "",
    model: "锐捷RG-ES218GC-P V2",
    specs: "二层弱网管交换机，交换容量36Gbps，包转发率26.78Mpps，16口10/100/1000Mbps自适应电口交换机（支持PoE/PoE+，PoE功率240W），固化2个SFP千兆光口，支持VLAN、端口镜像等功能，支持睿易APP和MACC云平台统一管理。",
    remark: "",
    price: 1152.48
  },
  {
    name: "16口POE交换机",
    unit: "台",
    brand: "",
    model: "DS-3E1518SP-130W-E",
    specs: "提供16个千兆PoE电口，1个千兆电口，1个千兆光口。支持iVMS-4200客户端和海康互联APP管理。整机最大PoE输出功率130W。",
    remark: "",
    price: 683.2
  },
  {
    name: "AP面板（带网口）",
    unit: "台",
    brand: "锐捷",
    model: "RG-EAP162(G)V2 WiFi6",
    specs: "1775M双频千兆面板AP，一个WAN/PoE上联端口，一个LAN下联端口、内置天线，支持2.4GHz/5GHz双频通信，支持802.11a/b/g/n/ac Wave1/Wave2/ax协议。支持AP与路由两种工作模式，支持二层漫游，支持睿易一体化组网，支持睿易APP管理。支持PoE供电（PoE供电设备需单独采购）",
    remark: "",
    price: 272.16
  },
  {
    name: "AP面板（吸顶式）",
    unit: "台",
    brand: "锐捷",
    model: "RG-EAP262(G) 吸顶式 Wi-Fi6",
    specs: "1775M双频千兆吸顶AP，1个千兆LAN口上联，内置天线，支持2.4GHz/5GHz双频通信，支持802.11a/b/g/n/ac Wave1/Wave2/ax协议。支持AP与路由两种工作模式，支持二层漫游，支持睿易一体化组网，支持睿易APP管理。支持PoE供电和本地供电（PoE供电设备和DC适配器需单独采购）",
    remark: "",
    price: 304.64
  },
  {
    name: "AC无线控制器",
    unit: "台",
    brand: "锐捷",
    model: "RG-EG210G-E",
    specs: "10口全千兆路由器，19寸标准机架铁壳设计。终端带机量200台，最大支持1000Mbps带宽。整机带10个千兆以太网口，其中固化2个WAN口，2个LAN/WAN可切换口，固化6个LAN口，最大支持4个WAN口。默认LAN1/LAN2/LAN3属于network1，IP：192.168.110.1。默认LAN4/LAN5/LAN6属于network2，IP：192.168.130.1。默认LAN7/LAN8属于network3，IP：192.168.150.1。集成统一网络控制器功能，最大可管理150台支持智能组网特性的EAP、RAP或网管交换机，以及128台以内的ES2xx系列智能交换机。支持应用识别、流量控制、VPN、PPPoE、认证、行为管理等丰富功能。",
    remark: "",
    price: 689.92
  },
  {
    name: "熔纤盘",
    unit: "个",
    brand: "国产",
    model: "12口SC光纤终端盒（满配）",
    specs: "12口SC光纤终端盒（满配尾纤，耦合器）",
    remark: " 优联速",
    price: 72.8
  },
  {
    name: "42U落地小型机柜",
    unit: "个",
    brand: "华腾",
    model: "图腾款42U",
    specs: "600*600*2000mm宽/深/高 机柜 三层板/一个PDU 加厚款",
    remark: "华腾",
    price: 1288
  },
  {
    name: "30波纹管",
    unit: "米",
    brand: "国产",
    model: "30",
    specs: "",
    remark: "",
    price: 1.232
  },
  {
    name: "PVC",
    unit: "米",
    brand: "国产",
    model: "20",
    specs: "",
    remark: "",
    price: 1.456
  },
  {
    name: "支架",
    unit: "个",
    brand: "国产",
    model: "国产定制",
    specs: "",
    remark: "",
    price: 6.608
  },
  {
    name: "4.5m监控杆",
    unit: "根",
    brand: "国产",
    model: "4.5米直杆",
    specs: "4.5米直杆114变76mm下杆1.5米  活动臂（针球通用款）\n横臂和万向节另购",
    remark: "",
    price: 319.2
  },
  {
    name: "横臂",
    unit: "根",
    brand: "国产",
    model: "50CM三枪机立杆横臂",
    specs: "方管",
    remark: "",
    price: 33.6
  },
  {
    name: "网线",
    unit: "箱",
    brand: "海康",
    model: "六类",
    specs: "海康 六类 DS-1LN6-UE橙色 305米-箱",
    remark: "",
    price: 862.4
  },
  {
    name: "网线",
    unit: "米",
    brand: "桢田",
    model: "六类GNT-5027T-305",
    specs: "六类非屏蔽国标网线（8x0.53) 灰色 0.53线径",
    remark: "集光 六类非屏蔽国标网线（8x0.53) 灰色 0.53线径",
    price: 2.352
  },
  {
    name: "电源线",
    unit: "米",
    brand: "海康威视",
    model: "DS-1RVV-2C250/E",
    specs: "RVV2*2.5 电源线 国标",
    remark: "DS-1RVV2C250/E",
    price: 6.72
  },
  {
    name: "监视器",
    unit: "台",
    brand: "威普森",
    model: "WPS-F5500-EX",
    specs: "55”钢化玻璃防暴高清监视器，自带拼接功能，专业拼接4K主板\n 1. 接入分辨率：4096×2160@30Hz，3840×2160@60Hz，1920×1080@60Hz及以下；\n 2. 屏幕物理分辨率：3840×2160；屏接口：V-by-one；\n 3. 屏幕比例：16:9；可视面积：1209.6×680.4mm；亮度：350cd/m²；\n 4. 接口：2×HDMI、VGA、DVI、BNC、232、USB接口（支持开机自动播放视频）；\n 5. 产品外尺寸：1248.73*725.23*68.2mm 不包括脚高度（脚高59.3mm）；\n 6. 单包尺寸：1310×145×827mm，25Kg；外箱2台/箱：1325×310×857mm，55Kg；\n 7. 标配遥控器、喇叭、HDMI线、八字形底座，支持壁挂和吊装（已配壁挂支架，孔距：400×200mm）",
    remark: "艾威云视AS-LED55-VS专业液晶监视器",
    price: 1993.6
  },
  {
    name: "硬盘",
    unit: "个",
    brand: "西数",
    model: "WUS721010ALE6L4 OEM",
    specs: "容量（GB）：10000 \n接口：SATA3.0\n转速（rpm）：7200",
    remark: "西数10TB 二年保",
    price: 2240
  },
  {
    name: "NVR",
    unit: "个",
    brand: "海康威视",
    model: "DS-8632N-K16-V2",
    specs: "3U机架式16盘位嵌入式网络硬盘录像机，采用短机箱设计，搭载高性能ATX电源\n【硬件规格】\n存储接口：16个SATA接口，可满配12TB硬盘\n视频接口：2×HDMI，2×VGA\n网络接口：2×RJ45 10/100/1000Mbps自适应以太网口\n报警接口：16路报警输入，9路报警输出（其中第9路支持CTRL 12V）\n反向供电：1路DC12V 1A\n串行接口：1路RS-232接口，1路半双工RS-485接口\nUSB接口：2×USB 2.0，2×USB 3.0\n【产品性能】\n输入带宽：256Mbps\n输出带宽：256Mbps\n接入能力：32路H.264、H.265格式高清码流接入\n解码能力：最大支持12×1080P\n显示能力：最大支持4K+1080P异源输出",
    remark: "",
    price: 4480
  },
  {
    name: "理线架",
    unit: "个",
    brand: "",
    model: "24芯",
    specs: "",
    remark: "",
    price: 24.64
  },
  {
    name: "机柜盲板",
    unit: "块",
    brand: "",
    model: "1U",
    specs: "",
    remark: "",
    price: 24.64
  },
  {
    name: "机柜理线槽",
    unit: "条",
    brand: "",
    model: "金属的130",
    specs: "",
    remark: "",
    price: 53.76
  },
  {
    name: "8 位机柜 PDU",
    unit: "条",
    brand: "",
    model: "",
    specs: "",
    remark: "",
    price: 89.6
  },
  {
    name: "机柜",
    unit: "架",
    brand: "",
    model: "22U",
    specs: "普通款",
    remark: "",
    price: 527.52
  },
  {
    name: "机柜风扇",
    unit: "个",
    brand: "",
    model: "",
    specs: "",
    remark: "",
    price: 41.44
  },
  {
    name: "波纹管",
    unit: "米",
    brand: "",
    model: "Φ32",
    specs: "",
    remark: "",
    price: 1.512
  },
  {
    name: "55寸监视器",
    unit: "台",
    brand: "",
    model: "艾威云视AS-LED55-VS 55寸 专业液晶监视器",
    specs: "",
    remark: "",
    price: 2251.2
  },
  {
    name: "静电地板",
    unit: "平方",
    brand: "",
    model: "",
    specs: "",
    remark: "",
    price: 201.6
  },
  {
    name: "摄像机",
    unit: "台",
    brand: "",
    model: "海康DS-2CD3T47SWDV3-LT 4MM POE网络400万2.0臻全彩枪机",
    specs: "视频\n最大图像尺寸：\n2560 × 1440\n主码流帧率分辨率：\n50 Hz：25 fps（2560 × 1440 , 1920 × 1080，1280 × 720）\n子码流帧率分辨率：\n50 Hz：25 fps（1280 × 720，640 × 480，640 × 360）\n视频压缩标准：\n主码流：H.265/H.264，支持超级智能编码 子码流：H.265/H.264/MJPEG\n视频压缩码率：\n32 Kbps~8 Mbps\nH.264编码类型：\nBaseLine Profile/Main Profile/High Profile\nH.265编码类型：\nMain Profile\n码率控制：\n定码率，变码率\nSVC：\n支持\nROI：\n支持主码流设置1个固定区域\n事件\n报警触发：\n移动侦测（支持人形/车形侦测），异常\nSmart事件：\n区域入侵侦测，越界侦测，进入区域侦测，离开区域侦测（支持人形、车形检测）\n音频\n音频压缩标准：\nG.711ulaw/G.711alaw/G.722.1/G.726/MP2L2/PCM/AAC-LC/MP3\n音频压缩码率：\n64 Kbps（G.711ulaw/G.711alaw）/16 Kbps（G.722.1）/16 Kbps（G.726）/32~160 Kbps（MP2L2）/16~64 Kbps（AAC-LC）/8~160 Kbps（MP3）\n音频采样率：\n8 kHz/16 kHz\n音频环境噪声过滤：\n支持\n网络传输\n网络协议：\nTCP/IP，ICMP，HTTP，FTP，DHCP，DNS，RTP，RTSP，RTCP，NTP，SMTP，IGMP，QoS，UDP，Bonjour，HTTPS，IPv6，IPv4\n同时预览路数：\n最多6路\n接口协议（API）：\n开放型网络视频接口，ISAPI，SDK，GB28181\n用户管理：\n最多32个用户 可分3级用户权限管理：管理员，操作员，普通用户\n客户端：\niVMS-4200\n浏览器：\n使用本地服务预览：Chrome 91+，Firefox 88+，Edge 91+\n图像\n图像设置：\n镜像，饱和度，亮度，对比度，锐度，AGC，白平衡通过客户端或者浏览器可调\n日夜转换模式：\n白天，夜晚，自动，定时切换\n图像增强：\n背光补偿，强光抑制，3D数字降噪\n接口\n音频：\n支持1个内置麦克风 支持1个内置扬声器\n网络：\n1个RJ45 10 M/100 M自适应以太网口\n摄像机\n传感器类型：\n1/1.8\" Progressive Scan CMOS\n最低照度：\n彩色：0.0005 Lux\n快门：\n1 s~1/100,000 s\n宽动态：\n120 dB\n镜头\n镜头尺寸接口：\nM16\n光圈类型：\n固定光圈\n最大光圈数：\nF1.0\n景深范围：\n2.8 mm：2.4 m~∞ 4 mm：3.1 m~∞ 6 mm：6.8 m~∞ 8 mm：8.8 m~135 m\n焦距&视场角：\n2.8 mm，水平视场角：105.7°，垂直视场角：57.2°，对角视场角：124.5° 4 mm，水平视场角：88.7°，垂直视场角：44.7°，对角视场角：107.5° 6 mm，水平视场角：55.2°，垂直视场角：29.3°，对角视场角：64.6° 8 mm，水平视场角：41°，垂直视场角：23°，对角视场角：47°\n补光\n补光距离：\n最远可达30 m\n防补光过曝：\n支持\n补光灯类型：\n柔光灯\n认证\n防护：\nIP67\n一般规格\n联动方式：\n上传FTP，上传中心，邮件，抓图，声音报警\n通用功能：\n心跳，密码保护，水印技术，像素计算器，视频遮盖\n恢复出厂设置：\n支持客户端或浏览器恢复\n启动和工作温湿度：\n-30 °C~60 °C，湿度小于95%（无凝结）\n供电方式：\nDC：12 V ± 25%，支持防反接保护 PoE：IEEE 802.3af，CLASS 3 *DWD型号不支持PoE\n电流及功耗：\n3T47SWD型号： DC：12 V，0.75 A，最大功耗：9 W PoE：IEEE 802.3af，CLASS 3，最大功耗：10.5 W 3T47SDWD型号： DC：12 V，0.75 A，最大功耗：9 W\n电源接口类型：\nØ5.5 mm圆口\n产品尺寸：\n2.8 mm焦距段型号： 182.8 × 92.7 × 87.6 mm 其他焦距段型号： 189.4 × 92.7 × 87.6 mm\n包装尺寸：\n235 × 120 × 125 mm\n设备重量：\n540 g\n带包装重量：\n670 g\n产品执行标准(具体版本号以标签为准)：\nQ/BFW 006",
    remark: "",
    price: 372.96
  },
  {
    name: "录像机",
    unit: "台",
    brand: "",
    model: "海康DS-8832N-R8（C）双网口 8盘位 32路",
    specs: "主控单元\n音频参数\n音频解码格式：\nG.711ulaw,G.711alaw,G.722,G.726,AAC,MP2L2,PCM\n音频输出：\n1路，RCA接口\n语音对讲输入：\n1路，RCA接口\n硬盘管理\n盘位：\n8个SATA接口\n单盘容量：\n10TB\n网络管理\n网络协议：\nHTTPS, UPnP, SNMP, NTP, SADP, SMTP, PPPoE\n外部接口\n网络接口：\n2个RJ45 10/100/1000Mbps自适应以太网口\n串行接口：\n1路，RS-485全双工串行接口 1路，标准RS-232串行接口\nUSB接口：\n2个USB2.0（前置），1个USB3.0（后置）\n报警输入：\n16路，开关量（0~5V高低电平）\n报警输出：\n4路，继电器\n一般规范\n机箱类型：\n2U机箱\n装箱清单：\n主机 × 1,快速入门指南 × 1,电源线 × 2,网线 × 1,鼠标 × 1,钥匙 × 2,接线端子 × 若干,螺丝包 × 1\n指示灯：\n1×电源指示灯（蓝）、1×网络指示灯（蓝）、1×硬盘指示灯（蓝+红）\n电源规格：\nAC 220-240V,150W\n功耗（不含硬盘）：\n≤15W\n工作温度：\n-10℃ ～55℃\n工作湿度：\n10％RH～90％RH（无凝露）\n机箱尺寸：\n441mm（宽）×456mm（深）×91mm（高）\n重量（不含硬盘）：\n≤7.1kg\n其他\n系统参数\n视频接入路数：\n32路\n网络输入带宽：\n256Mbps\n网络输出带宽：\n160Mbps\n录像分辨率：\n8MP/7MP/6MP/5MP/4MP/3MP/1080p/UXGA/720p/VGA/4CIF/DCIF/2CIF/CIF/QCIF\n视频参数\n视频输出：\n1路HDMI，1路VGA；最大支持4K输出\nHDMI输出：\nHDMI：4K（3840×2160）/30Hz，2K（2560×1440）/60Hz，1080P（1920×1080）/60Hz，UXGA（1600×1200）/60Hz，SXGA（1280×1024）/60Hz，720P（1280×720）/60Hz\nVGA输出：\n1080P（1920×1080）/60Hz\n主口分屏：\n1/2/4/6/8/9/16/25/36画面\n辅口分屏：\n1/2/4/6/8/9/16画面\n视频解码格式：\nH.265，Smart265，H.264，Smart264\n解码能力：\n12×1080P\n本地同步回放：\n最大16路\n生产认证\n产品执行标准(具体版本号以标签为准)：\nQ/BFW 362",
    remark: "",
    price: 2093.28
  },
  {
    name: "AP面板",
    unit: "个",
    brand: "",
    model: "锐捷RG-EAP172(MG)",
    specs: "双频Wi-Fi 7 3600M墙面AP，一个2.5G LAN/PoE上联电口，一个1G下联电口，内置天线，支持2.4 GHz/5 GHz双频通信，支持IEEE 802.11a/b/g/n/ac Wave1/Wave2/ax/be协议，支持Wi-Fi 160M频宽，整机最大接入速率3570Mbps。超薄设计，高出墙面8.5毫米。支持AP与路由两种工作模式，支持AI智能漫游，支持二层漫游，支持睿易一体化组网，支持睿易APP管理。支持IEEE 802.3 af/at PoE标准供电。（PoE供电设备需单独采购）(特殊说明：)",
    remark: "",
    price: 469.28
  },
  {
    name: "吸顶AP",
    unit: "个",
    brand: "",
    model: "锐捷RG-EAP272(MG）",
    specs: "Wi-Fi 7 3600M双频2.5G吸顶AP，支持一个2.5G LAN/PoE以太网上联接口。内置天线，支持2.4GHz/5GHz双频通信，支持IEEE 802.11a/n/ac/ax/be和IEEE 802.11b/g/n/ax/be Wi-Fi协议，支持Wi-Fi 7 160M频宽，支持4K-QAM，整机最大接入速率3570Mbps。同时支持路由，AP两种工作模式。支持AI智能漫游，k/v漫游，二层漫游和快速漫游。支持睿易一体化组网，支持锐捷睿易App管理。支持PoE供电和本地供电（PoE供电设备和DC电源适配器需单独采购）。",
    remark: "",
    price: 599.2
  },
  {
    name: "监控硬盘",
    unit: "块",
    brand: "",
    model: "希捷 6T NM0115 二年保",
    specs: "",
    remark: "",
    price: 1108.8
  },
  {
    name: "网线",
    unit: "箱",
    brand: "海康",
    model: "海康超五类 0.5 DS-1LN5E-S-E 305M-箱",
    specs: "",
    remark: "",
    price: 651.84
  },
  {
    name: "水晶头",
    unit: "包",
    brand: "",
    model: "海康DS-1M5EUA 超五类 100个-盒",
    specs: "",
    remark: "",
    price: 32.48
  },
  {
    name: "壁挂设备柜",
    unit: "个",
    brand: "",
    model: "机柜：6U黑普通带托300高x530宽x350深",
    specs: "",
    remark: "",
    price: 99.68
  },
  {
    name: "光纤收发器",
    unit: "个",
    brand: "",
    model: "光纤收发器：海康DS-3D501R-3E(SC)千兆单模单纤/海康DS-3D501T-3E(SC)千兆单模单纤",
    specs: "",
    remark: "",
    price: 150.08
  },
  {
    name: "超5类网络线",
    unit: "米",
    brand: "",
    model: "海康超五类 0.5 DS-1LN5E-S/E 305M/箱",
    specs: "",
    remark: "",
    price: 638.4
  },
  {
    name: "超5类网络线",
    unit: "米",
    brand: "",
    model: "DS-1LN5E-S/E",
    specs: "• 支持千兆以太网信号传输\n• 无氧铜芯，直流电阻小，信号衰减小\n• PVC阻燃护套，耐磨、抗拉强度高，安全有保障\n• 均匀双绞结构，产品性能稳定，有效降低干扰，确保信号传输质量\n• 符合RoHS 2.0 和Reach认证",
    remark: "",
    price: 2.1952
  },
  {
    name: "光缆",
    unit: "米",
    brand: "",
    model: "光纤线：4芯单模光纤",
    specs: "",
    remark: "",
    price: 0.896
  },
  {
    name: "枪机",
    unit: "台",
    brand: "",
    model: "DS-2CD1245-LA（POE)",
    specs: "• 最高分辨率可达2560 × 1440 @25 fps\n• 支持SmartIR，防止夜间红外过曝\n• 支持背光补偿，强光抑制，3D数字降噪，数字宽动态，适应不同使用环境\n• 支持开放型网络视频接口，ISAPI，SDK，GB28181协议\n• 1个内置麦克风\n• 智能补光，支持白光/红外双补光\n• 符合IP67防尘防水设计，可靠性高",
    remark: "",
    price: 190.4
  },
  {
    name: "半球",
    unit: "台",
    brand: "",
    model: "DS-2CD1345V2-LA(POE)",
    specs: "• 最高分辨率可达2560 × 1440 @25 fps，在该分辨率下可输出实时图像\n• 支持背光补偿，强光抑制，3D数字降噪，数字宽动态\n• 支持人形检测\n• 支持开放型网络视频接口，ISAPI，SDK，GB28181协议\n• 智能补光，支持白光/红外双补光，红外最远可达30 m，白光最远可达20 m\n• 1个内置麦克风\n• 符合IP67防尘防水设计，可靠性高",
    remark: "",
    price: 190.4
  },
  {
    name: "光纤收发器",
    unit: "对",
    brand: "",
    model: "DS-3D501T/1R-3E(SC)",
    specs: "3公里",
    remark: "",
    price: 138.88
  },
  {
    name: "64路录像机",
    unit: "台",
    brand: "",
    model: "DS-8864N-R8(C)(标配)(V2)",
    specs: "• 可接驳符合ONVIF、RTSP、GB28181标准的网络摄像机\n• 支持H.265、H.264编码前端自适应接入\n• 支持12路1080P解码（开启解码增强，可提升至16路1080P解码）\n• 支持800万像素高清网络视频的预览、存储与回放\n• 支持HDMI与VGA异源输出，HDMI最大支持4K超高清显示输出，VGA支持1080P高清显示输出\n• 自带8个SATA接口，最大支持10TB硬盘\n• 支持IP设备集中管理，包括IP设备一键添加、参数配置、批量升级、导入/导出等\n• 支持16路本地同步回放\n• 针对人、车及事件类型，支持快速回放与检索功能，大幅提升录像回放和检索效率\n• 支持萤石云服务，通过海康互联APP可实现手机远程预览/回放/配置\n• 支持萤石、ISUP以及GB28181协议，轻松实现平台接入",
    remark: "",
    price: 2630.88
  },
  {
    name: "10T硬盘",
    unit: "台",
    brand: "",
    model: "10T",
    specs: "二年保",
    remark: "",
    price: 2520
  }
];

export default MATERIAL_QUOTATION;
