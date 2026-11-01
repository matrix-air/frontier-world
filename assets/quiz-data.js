/* MicroDuck 造物世界 · 段位测试题库（问卷全文 v1.1.0 · 33 题逐字转录）
 * 源文件：/Users/start-h/Documents/Aurora/microduck-survey/docs/问卷全文-v1.1.0.docx
 * 结构：单选 20 · 多选 4 · 多选限 3 项 4 · 开放填空 3 · 分值题 1 · 价格四格 1
 * 分支：按身份自动分支（显示条件函数），实际作答 14–27 题（问卷自述 16–26，见 tools/quiz-branch-test.js 实测）。
 * 说明：题号与「显示条件」为后台逻辑标注，不向填答者展示；题目顺序即呈现顺序。
 *
 * answers 结构：{ A1:'stu_eng', B2:['watch','hands'], C2:{cheap:999,fair:2999,pricey:3999,tooexp:5999}, ... }
 */
(function () {
  'use strict';

  /* ---------- 分支判定辅助 ---------- */
  var STUDENT_A1 = ['stu_eng', 'stu_lib', 'fresh'];       // D 段人群：在校生 + 应届
  function isStudent(a) { return STUDENT_A1.indexOf(a.A1) >= 0; }
  function handsOn(a) {                                    // 动手信号：B2 勾「动手做项目」或 B3 选 C/D
    return (a.B2 && a.B2.indexOf('hands') >= 0) ||
           a.B3 === 'hands_fun' || a.B3 === 'sys_learn';
  }
  function dOpen(a) { return isStudent(a) && !!a.D2 && a.D2 !== 'none'; }   // D3–D6：D2≠暂无
  function eBase(a) { return handsOn(a) && !!a.E1; }                        // E2–E6：动手信号且 E1≠都没有
  function eContent(a) { return !!a.E1 && a.E1.indexOf('none') < 0; }

  /* ---------- 段落过渡页文案 ---------- */
  var SECTIONS = {
    A: { no: 'A', name: '人群画像', line: '先认识一下你——你是谁，决定我们从哪里开始。' },
    B: { no: 'B', name: '认知与热情', line: '你和具身智能之间，现在隔着几步？' },
    C: { no: 'C', name: '付费与决策', line: '认真聊聊价格——你的判断直接进入定价依据。' },
    D: { no: 'D', name: '留学与深造', line: '这一段只给正在规划升学路线的人。' },
    E: { no: 'E', name: '共创与二创', line: '有作品的人，我们想和你一起造点东西。' },
    F: { no: 'F', name: '教育机构与讲师', line: '这一段只给机构与老师——合作通道从这里开始。' },
    X: { no: 'X', name: '联系方式', line: '最后一步。联系方式完全选填。' }
  };

  /* ---------- 33 题 ----------
   * type: single 单选 / multi 多选(互斥) / multi3 多选限3 / open 开放填空 / score 分值0-10 / price4 价格四格
   * show(answers) 返回 false 则本题不出现；不写 show = 恒显。
   * required:false = 选填。
   */
  var QUESTIONS = [
    /* ===== A 段 · 人群画像（4） ===== */
    {
      id: 'A1', section: 'A', type: 'single',
      title: '您目前的身份是？',
      options: [
        { v: 'stu_eng', t: '在校大学生（理工科）' },
        { v: 'stu_lib', t: '在校大学生（非理工科）' },
        { v: 'fresh', t: '应届毕业生（毕业≤1年）' },
        { v: 'employed', t: '在职人员' },
        { v: 'educator', t: '教育机构从业者/教师' },
        { v: 'freelance', t: '自由职业/创业者' },
        { v: 'other', t: '其他' }
      ]
    },
    {
      id: 'A2', section: 'A', type: 'single',
      title: '您的年龄段是？',
      options: [
        { v: '18-22', t: '18–22' },
        { v: '23-25', t: '23–25' },
        { v: '26-30', t: '26–30' },
        { v: '31-40', t: '31–40' },
        { v: '41-50', t: '41–50' },
        { v: '51+', t: '51+' }
      ]
    },
    {
      id: 'A3', section: 'A', type: 'single',
      title: '您所在的城市属于？',
      options: [
        { v: 't1', t: '一线' },
        { v: 'new1', t: '新一线' },
        { v: 't2', t: '二线' },
        { v: 't3', t: '三线及以下' },
        { v: 'overseas', t: '海外' }
      ]
    },
    {
      id: 'A4', section: 'A', type: 'single',
      title: '您第一次了解到本测试是通过？',
      options: [
        { v: 'weixin_search', t: '微信搜一搜' },
        { v: 'friend_share', t: '朋友分享（段位卡转发）' },
        { v: 'video_platform', t: '其他平台（B站/小红书/抖音）' },
        { v: 'offline', t: '线下活动' },
        { v: 'other', t: '其他' }
      ]
    },

    /* ===== B 段 · 认知与热情（5） ===== */
    {
      id: 'B1', section: 'B', type: 'single',
      title: '以下概念您听说过几个？（具身智能、VLA 模型、强化学习、SLAM、力控/遥操作）',
      options: [
        { v: '5plus', t: '5 个及以上' },
        { v: '3to4', t: '3–4 个' },
        { v: '1to2', t: '1–2 个' },
        { v: 'zero', t: '一个都说不出' }
      ]
    },
    {
      id: 'B2', section: 'B', type: 'multi',
      title: '过去一年，您做过以下哪些事？（多选）',
      options: [
        { v: 'watch', t: '经常看相关视频/文章（≥每周）' },
        { v: 'follow', t: '长期追踪特定公司/UP主/论文/公众号' },
        { v: 'hands', t: '动手做项目/复现论文/参加比赛' },
        { v: 'bought', t: '花钱买过相关课程/硬件/套件' },
        { v: 'recommend', t: '向朋友安利过' },
        { v: 'none', t: '都没有', exclusive: true }
      ]
    },
    {
      id: 'B2a', section: 'B', type: 'open', required: false, maxLen: 100,
      title: '请用一两句话简述您做过的项目/比赛。（选填）',
      hint: '仅当 B2 勾选「动手做项目/复现论文/参加比赛」时显示 · 最长 100 字',
      show: function (a) { return !!a.B2 && a.B2.indexOf('hands') >= 0; }
    },
    {
      id: 'B3', section: 'B', type: 'single',
      title: '朋友邀您周末参加一场具身智能工作坊，您会？',
      options: [
        { v: 'free_only', t: '免费才去体验一次' },
        { v: 'paid_try', t: '付费也想去体验' },
        { v: 'hands_fun', t: '比起听讲，更想自己动手组装调试，装调本身就是乐趣' },
        { v: 'sys_learn', t: '想系统学习，做出自己的项目/作品' }
      ]
    },
    {
      id: 'B4', section: 'B', type: 'score',
      title: '您向朋友推荐具身智能相关内容的可能性有多大？（0–10 分）',
      hint: '拖动滑块取值'
    },

    /* ===== C 段 · 付费与决策（4） ===== */
    {
      id: 'C1', section: 'C', type: 'single',
      title: '过去一年，您在机器人/AI 相关课程、硬件、内容上的总花费？',
      options: [
        { v: 'zero', t: '¥0' },
        { v: 'under3k', t: '¥3,000 以内' },
        { v: '3kto10k', t: '¥3,000–10,000' },
        { v: 'over10k', t: '¥10,000 以上' }
      ]
    },
    {
      id: 'C2', section: 'C', type: 'price4',
      title: '针对「MicroDuck 双足机械鸭复刻套件（参考价 ¥2,999）」，请分别填写您的心理价位（单位：元）',
      hint: '参考产品：MicroDuck 双足机械鸭复刻套件（参考价 ¥2,999）',
      fields: [
        { key: 'cheap', label: '太便宜', desc: '便宜到让您怀疑质量' },
        { key: 'fair', label: '划算价', desc: '物有所值' },
        { key: 'pricey', label: '有点贵', desc: '开始觉得贵但仍会考虑' },
        { key: 'tooexp', label: '太贵', desc: '不会考虑' }
      ],
      validate: '太便宜 < 划算价 < 有点贵 < 太贵，违序提交时要求重填'
    },
    {
      id: 'C3', section: 'C', type: 'multi3', max: 3,
      title: '以下哪些品类您愿意花钱？（多选，最多 3 项）',
      options: [
        { v: 'kit', t: '机器人整机/套件' },
        { v: 'course', t: '系统课程/训练营' },
        { v: 'research', t: '科研项目/作品集/推荐信（升学背景提升）' },
        { v: 'community', t: '会员/社群/活动' },
        { v: 'parts', t: '配件/耗材/工具' },
        { v: 'none', t: '都不想花钱买', exclusive: true }
      ]
    },
    {
      id: 'C4', section: 'C', type: 'single',
      title: '购买这类产品时，通常由谁决定？',
      options: [
        { v: 'self', t: '自己决定' },
        { v: 'family', t: '需和家庭商量' },
        { v: 'company', t: '走公司/机构采购流程' }
      ]
    },

    /* ===== D 段 · 留学与深造（6，仅学生/应届显示） ===== */
    {
      id: 'D1', section: 'D', type: 'single',
      title: '您的学业阶段是？',
      show: isStudent,
      options: [
        { v: 'y12', t: '大一大二' },
        { v: 'y34', t: '大三大四' },
        { v: 'master', t: '硕士在读' },
        { v: 'master1y', t: '硕士毕业≤1年' },
        { v: 'phd', t: '博士在读' }
      ]
    },
    {
      id: 'D2', section: 'D', type: 'single',
      title: '未来 3 年，您是否有留学或深造计划？',
      show: isStudent,
      options: [
        { v: 'plan3y', t: '3 年内有明确留学/深造计划' },
        { v: 'considering', t: '在考虑中' },
        { v: 'none', t: '暂无计划' }
      ]
    },
    {
      id: 'D3', section: 'D', type: 'multi3', max: 3,
      title: '您感兴趣的方向是？（多选，最多 3 项）',
      show: dOpen,
      options: [
        { v: 'ai', t: '人工智能/机器学习' },
        { v: 'robotics', t: '机器人/自动化' },
        { v: 'cs', t: '计算机/软件工程' },
        { v: 'ee_me', t: '电子/机械/控制' },
        { v: 'other_stem', t: '其他理工方向' },
        { v: 'undecided', t: '尚未确定' }
      ]
    },
    {
      id: 'D4', section: 'D', type: 'multi3', max: 3,
      title: '申请/深造材料中，您已具备哪些？（多选，最多 3 项）',
      show: dOpen,
      options: [
        { v: 'lang', t: '语言成绩（托福/雅思/GRE）' },
        { v: 'paper', t: '科研经历/论文' },
        { v: 'contest', t: '竞赛获奖' },
        { v: 'portfolio', t: '项目/作品集' },
        { v: 'none', t: '都还没有', exclusive: true }
      ]
    },
    {
      id: 'D5', section: 'D', type: 'single',
      title: '若需要背景提升服务（科研营/论文/作品集等），您的可接受预算？',
      show: dOpen,
      options: [
        { v: 'zero', t: '¥0（不会为此付费）' },
        { v: 'under5k', t: '¥5,000 以内' },
        { v: '5kto10k', t: '¥5,000–10,000' },
        { v: '10kto30k', t: '¥10,000–30,000' },
        { v: 'over30k', t: '¥30,000 以上' }
      ]
    },
    {
      id: 'D6', section: 'D', type: 'multi3', max: 3,
      title: '您最希望获得哪类帮助？（多选，最多 3 项）',
      show: dOpen,
      options: [
        { v: 'camp', t: '科研营/科研项目经历' },
        { v: 'paper_patent', t: '论文/专利辅导' },
        { v: 'portfolio', t: '作品集/项目打磨' },
        { v: 'referral', t: '推荐信/学术人脉资源' },
        { v: 'docs', t: '择校与文书' },
        { v: 'none_needed', t: '暂不需要', exclusive: true }
      ]
    },

    /* ===== E 段 · 共创与二创（6，仅 B2 动手或 B3 C/D 项显示） ===== */
    {
      id: 'E1', section: 'E', type: 'multi',
      title: '过去一年，您产出过哪些相关内容？（多选）',
      show: handsOn,
      options: [
        { v: 'review_video', t: '测评/开箱视频' },
        { v: 'tech_article', t: '技术文章/教程/公众号' },
        { v: 'open_source', t: '开源项目/代码仓库' },
        { v: 'account', t: '运营相关账号或社群' },
        { v: 'offline_org', t: '组织线下活动/比赛' },
        { v: 'none', t: '都没有', exclusive: true }
      ]
    },
    {
      id: 'E2', section: 'E', type: 'single',
      title: '您的创作主要发布在？',
      show: function (a) { return eBase(a) && eContent(a); },
      options: [
        { v: 'bilibili', t: 'B站' },
        { v: 'red', t: '小红书' },
        { v: 'douyin', t: '抖音/视频号' },
        { v: 'wechat_zh', t: '公众号/知乎' },
        { v: 'offline', t: '线下' },
        { v: 'other', t: '其他' }
      ]
    },
    {
      id: 'E3', section: 'E', type: 'single',
      title: '若有机会与我们合作，您更倾向？',
      show: function (a) { return eBase(a) && eContent(a); },
      options: [
        { v: 'deep', t: '深度共创（联合开发/联合课程/联合测评）' },
        { v: 'light', t: '轻量二创（转发/混剪/改编内容）' },
        { v: 'notyet', t: '暂不考虑' }
      ]
    },
    {
      id: 'E4', section: 'E', type: 'single',
      title: '每周可稳定投入创作/开发的时间？',
      show: function (a) { return eBase(a) && eContent(a); },
      options: [
        { v: '10h', t: '10 小时以上' },
        { v: '3to10', t: '3–10 小时' },
        { v: 'under3', t: '3 小时以内' },
        { v: 'flexible', t: '不固定，看项目' }
      ]
    },
    {
      id: 'E5', section: 'E', type: 'single',
      title: '若参与共创，您的合作身份是？',
      show: function (a) { return eBase(a) && eContent(a); },
      options: [
        { v: 'personal', t: '以个人身份参与' },
        { v: 'org', t: '代表机构/公司参与' },
        { v: 'both', t: '两者都可以' }
      ]
    },
    {
      id: 'E6', section: 'E', type: 'open', required: false, maxLen: 200,
      title: '请贴出您最满意的一个作品链接或简述。（选填）',
      hint: '最长 200 字',
      show: function (a) { return eBase(a) && eContent(a); }
    },

    /* ===== F 段 · 教育机构与讲师（6，仅 A1=教育机构从业者显示） ===== */
    {
      id: 'F1', section: 'F', type: 'single',
      title: '您目前在教育机构任职吗？',
      show: function (a) { return a.A1 === 'educator'; },
      options: [
        { v: 'yes', t: '是' },
        { v: 'left_part', t: '已离职/兼职' }
      ]
    },
    {
      id: 'F2', section: 'F', type: 'single',
      title: '您所在机构的类型是？',
      show: function (a) { return a.A1 === 'educator'; },
      options: [
        { v: 'k12', t: 'K12/素质教育' },
        { v: 'vocational', t: '职业教育/IT 培训' },
        { v: 'college', t: '高校/职业院校' },
        { v: 'study_abroad', t: '留学服务/背景提升机构' },
        { v: 'other', t: '其他' }
      ]
    },
    {
      id: 'F3', section: 'F', type: 'single',
      title: '您在机构中的角色是？',
      show: function (a) { return a.A1 === 'educator'; },
      options: [
        { v: 'teacher', t: '授课教师' },
        { v: 'r_and_d', t: '课程研发/教研' },
        { v: 'manager', t: '教学管理' },
        { v: 'founder', t: '创始人/校长' },
        { v: 'other', t: '其他' }
      ]
    },
    {
      id: 'F4', section: 'F', type: 'single',
      title: '若下学期开出具体验课，贵机构最可能的状态是？',
      show: function (a) { return a.A1 === 'educator'; },
      options: [
        { v: 'confirmed', t: '已确定开设' },
        { v: 'evaluating', t: '正在评估' },
        { v: 'lack_resources', t: '想开但缺师资/课程' },
        { v: 'not_now', t: '暂不考虑' }
      ]
    },
    {
      id: 'F5', section: 'F', type: 'single',
      title: '若提供教材、教具与培训，您是否愿意开发或讲授具身智能课程？',
      show: function (a) { return a.A1 === 'educator'; },
      options: [
        { v: 'teach', t: '愿意主讲' },
        { v: 'develop', t: '愿意参与研发，暂不主讲' },
        { v: 'self_learn', t: '先自己学习了解' },
        { v: 'not_now', t: '暂不考虑' }
      ]
    },
    {
      id: 'F6', section: 'F', type: 'multi',
      title: '贵机构对哪些合作形式有兴趣？（多选）',
      show: function (a) { return a.A1 === 'educator'; },
      options: [
        { v: 'co_teach', t: '联合开课' },
        { v: 'teacher_training', t: '师资培训' },
        { v: 'buy_kits', t: '采购教具套件' },
        { v: 'co_build', t: '课程共建与分销' },
        { v: 'not_now', t: '暂不考虑', exclusive: true }
      ]
    },

    /* ===== X 段 · 联系方式（2） ===== */
    {
      id: 'X1', section: 'X', type: 'open', required: false, maxLen: 50,
      title: '若愿意接收专属报告与活动邀约，请留下微信号或手机号。（选填）',
      hint: '最长 50 字 · 信息仅用于 MicroDuck 分层与邀约，不对外提供'
    },
    {
      id: 'X1b', section: 'X', type: 'multi', required: false,
      title: '您感兴趣的后续（可多选，选填）',
      options: [
        { v: 'experience_officer', t: '新品体验官' },
        { v: 'co_creation', t: '共创计划' },
        { v: 'study_abroad', t: '留学背景提升咨询' },
        { v: 'lecturer', t: '讲师合作' },
        { v: 'report_only', t: '仅接收报告', exclusive: true }
      ]
    }
  ];

  /* ---------- 对外接口 ---------- */
  window.QUIZ = {
    version: 'v1.1.0',
    intro: {
      title: 'MicroDuck 具身智能段位测试',
      sub: '测测你的具身智能段位',
      meta: '版本 v1.1.0 · 题库 33 题 · 单选 20 · 多选 4 · 多选限 3 项 4 · 开放填空 3 · 分值题 1 · 价格四格 1',
      branch: '按身份自动分支，实际作答 16–26 题，约 4–6 分钟',
      privacy: '隐私声明：信息仅用于 MicroDuck 分层与邀约，不对外提供；本问卷面向 18 岁以上用户，联系方式为选填。'
    },
    sections: SECTIONS,
    questions: QUESTIONS,
    /* 当前答案下的可见题列表 */
    visibleList: function (answers) {
      var out = [];
      for (var i = 0; i < QUESTIONS.length; i++) {
        var q = QUESTIONS[i];
        if (!q.show || q.show(answers)) out.push(q);
      }
      return out;
    },
    helpers: { isStudent: isStudent, handsOn: handsOn, dOpen: dOpen, eBase: eBase, eContent: eContent }
  };
})();
