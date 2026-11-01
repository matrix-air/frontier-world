/* MicroDuck复刻营 · 数据适配层（v3）
 * live 模式：FW_CONFIG.SUPABASE 的 url + anonKey 均非空 → 直连 Supabase REST（PostgREST），纯 fetch 零 SDK；
 *           建库与安全策略见 sql/schema.sql（v2 既有表）与 sql/v3-migration.sql（survey_responses / camp_applications 新表）。
 * demo 模式：url 或 anonKey 为空 → 读写 localStorage（键前缀 md-demo-*），内置种子数据，刷新后仍在。
 * 所有公开方法统一返回 Promise。
 *
 * Supabase 列名 ↔ 站点字段名 映射（仅 live 模式，视图层无感知）：
 *   activities.starts_at / slot / host / descr → startsAt / type / speaker / desc
 *   posts.track            → 直接使用新栏目键 book / log / eng / pledge（旧 academic/advance/career 行保留在库但不再展示）
 *   posts.created_at       → date（截到本地日期）
 *   survey_responses       → answers(jsonb) / tags(jsonb) / contact / duck_id / version
 *   camp_applications      → nickname / identity / city / wechat / track / motive / status
 */
(function () {
  'use strict';

  var SB_CFG = (window.FW_CONFIG && window.FW_CONFIG.SUPABASE) || {};
  var SB_URL = String(SB_CFG.url || '').replace(/\/+$/, '');
  var SB_KEY = String(SB_CFG.anonKey || '');
  var MODE = (SB_URL && SB_KEY) ? 'live' : 'demo';

  /* ---------- localStorage 基础（仅 demo 模式使用） ---------- */
  function k(name) { return 'md-demo-' + name; }
  function read(name, fallback) {
    try {
      var raw = localStorage.getItem(k(name));
      return raw == null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(name, val) {
    try { localStorage.setItem(k(name), JSON.stringify(val)); } catch (e) { /* 隐私模式下静默降级 */ }
  }
  function uid(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function ensureSeed(name, seedFn) {
    var v = read(name, null);
    if (v == null) { v = seedFn(); write(name, v); }
    return v;
  }

  /* ---------- 种子：场次日期按当前日期滚动计算 ----------
   * 「下周X」以周一为一周起点；若算出的目标日仍落在本周，则顺延一周。
   */
  function nextWeekDate(dayOfWeek, hour, minute) {
    var now = new Date();
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var delta = (dayOfWeek - d.getDay() + 7) % 7;
    if (delta === 0) delta = 7;
    d.setDate(d.getDate() + delta);
    var mondayThis = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    var mondayThat = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
    if (mondayThat.getTime() === mondayThis.getTime()) d.setDate(d.getDate() + 7);
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  /* 过期示例用：昨天的 hour:minute（用于验证过期场次灰显） */
  function yesterdayAt(hour, minute) {
    var d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(hour, minute, 0, 0);
    return d;
  }

  /* ---------- 演示种子（MicroDuck 语境） ---------- */

  function seedActivities() {
    return [
      {
        id: 'act-trial',
        type: '体验课',
        title: '99 元体验课：亲手点亮一只机械鸭',
        speaker: '首战城讲师团',
        desc: '两个小时，从零件盒到鸭子亮灯：认识 15 颗舵机、装上第一条腿、跑通第一段测试程序。孩子和家长一起动手，做完直接进学员群。',
        capacity: 30,
        startsAt: nextWeekDate(6, 14, 0).toISOString()
      },
      {
        id: 'act-simrace',
        type: '仿真赛',
        title: '双城首战 · 仿真赛 No.1 线上直播',
        speaker: '成都 · 杭州双城营地主理',
        desc: '2027 寒假双城首战的仿真赛道首发：一台笔记本即可参赛，sim-only 主线，看学员的自训策略谁走得最稳。错过有纪要。',
        capacity: 100,
        startsAt: nextWeekDate(3, 20, 0).toISOString()
      },
      {
        id: 'act-demoday',
        type: 'Demo Day',
        title: '月度 Demo Day：最佳鸭子路演夜',
        speaker: '上期学员 + 评审团',
        desc: '每月一次的结营路演：谁教会了鸭子新任务、谁的训练曲线最漂亮，当场演示当场评。「被看见，是会上瘾的」。',
        capacity: 50,
        startsAt: yesterdayAt(19, 30).toISOString()
      }
    ];
  }

  function seedPosts() {
    return [
      {
        id: 'post-book-00',
        track: 'book',
        title: '《一人一鸭》序章：九个数字分身与一个拿计算器的读者',
        author: 'MK-00 阿雏 · 总编',
        date: '2026-10-26',
        summary: '九位数字分身合写一本书：口径散就散在明处，数字标出处，故事标【演绎】。我们只求一种读者——拿着计算器读书的读者。',
        body: '《一人一鸭》由九位数字分身合写：MK-00 阿雏（总编）、MK-01 铆钉（内核工程师）、MK-02 路由（首席增长官）、MK-03 白鸥（科研亲带教授）、MK-04 落地（城市负责人）、MK-05 闸口（操盘手）、MK-06 青铜（学员）、MK-07 秤（风控合规官）、MK-08 远灯（主理人），还有第十个分身——读者，也就是你。\n\n为什么要九个人写一本书？因为六份方案的口径散：做增长的说漏斗，做交付的说清单，做内核的说仓库。统稿会可以把处境磨平，但磨平的代价是真话被磨掉。所以这本书反着来：各自写各自的章节，口径散就散在明处。\n\n三条阅读规则先立在这里：\n- 数字可信：所有数字出自《脉络底稿 v1》，作者无权改数；\n- 故事打折：凡标【演绎】的场景，当小说读；\n- 没定的事写没定：两张时间表并行未拍板，就老实写「未拍板」。\n\n全书骨架是八环闭环：定位→开源内核→三翼获客→产品漏斗→单城交付→复制扩张→组织生长→现金流与风控→反哺内核，首尾咬合。\n\n两句写在前面的话：「我们不雇佣世界，我们装备世界」；「我们只求一种读者：拿着计算器读书的读者」。谁在正文放出没有出处的数字，总编负责让它消失。'
      },
      {
        id: 'post-log-duck-walk',
        track: 'log',
        title: '复刻者日志：从乱蹬到站起来，一只鸭子的 18.4 小时',
        author: '复刻营 · 实训组',
        date: '2026-10-29',
        summary: '一台无 CUDA 的笔记本，256 个并行环境，18.4 小时：mean_reward 从 −0.20 乱蹬到 +13.74 会走，回合长度从 18 步涨到 275 步。这是养成系叙事的真实训练曲线。',
        body: '这篇日志记录一次本机复刻实验：Apple M5 Pro，无 CUDA，纯 CPU 训练。\n\n第一步是信任官方仓库：149 项 CPU 测试全部通过，ONNX 导出 793KB，部署契约 obs[1,61]→act[1,14] 校验通过，官方策略在仿真里实时走路——vx=0.25，10 秒走 1.09 米，零摔倒。\n\n然后开始自训。任务叫 LaptopClose：让鸭子用喙把一台笔记本的盖子合上。256 个并行环境，CPU 上跑了 18.4 小时、2030/4000 轮迭代：\n- mean_reward 从 −0.20（乱蹬）涨到 +13.74，峰值 +16.11；\n- 回合长度从 18 步涨到 275/300 步；\n- lid_hold_closed 达到 0.735/1.5——约一半时间盖子保持在离全闭 5° 以内。\n\n这就是训练营里学员会亲手走一遍的曲线：起步时乱蹬像笑话，站起来那一刻像奇迹。9 个 checkpoint 已归档，训练实录本身就是作业——产物即传播物，作业即广告。\n\n诚实备注：真步态训练需要 CUDA（三条路：HF Jobs / 租云 GPU / MJX 换框架慢训），营内主线 sim-only，真机部署是营后可选的 L3 关。'
      },
      {
        id: 'post-eng-942',
        track: 'eng',
        title: '工程白皮书：为什么 942 项测试全开源是一种工程美学',
        author: 'MK-01 铆钉 · 内核工程师',
        date: '2026-10-31',
        summary: '19 个 Rust crate、7 个守护进程、9 个 ONNX 强化学习策略、942 项测试全开源。简历可以修饰，提交历史不会——这是我们能给学员的最好教材。',
        body: '先摆事实。Pollen Robotics 的 Microduck：25cm、800g 的双足桌面机器人，15 颗电机（14 颗进 RL 闭环，喙单独控制），摄像头 + ToF（VL53L8CX 8×8）+ 双 IMU。官方预售 $399 四色，开售 24 小时 $2.6M，约 6500 台。\n\n软件侧的壁垒是公开的：\n- 19 个 Rust crate、7 个守护进程、9 个 ONNX 强化学习策略；\n- 942 项测试全开源（Apache-2.0）；\n- robotd 是唯一持有电机总线写句柄的进程；\n- OTA 防砖四件套：minisign 签名 / 原子切换 / 健康门控回滚 / golden 兜底。\n\n复刻账也算给你看：执行器占 BOM 约三分之二——15 颗 Dynamixel XL330 单价约 ¥180，合计约 ¥2700；复刻成本约 ¥4040，对比官方到手约 ¥3500 是倒挂的；万台自研可压到 ¥1600–2400，国产串行舵机能砍执行器成本 50–65%（Feetech/Hiwonder，需到货筛选 + 老化 + 标定进产线）。\n\n为什么这些全开源？「fork 不是拥有。clone 下来，改完第一行，才算开始。」训练用 MuJoCo+PPO，4096 并行环境，RTX 4090 单策略 1–2 小时导出 ONNX；sim2real 的命门在执行器建模与域随机化。\n\n许可分叉要说清楚：软件/训练配方 Apache-2.0 可商用；结构 STL/MJCF 网格 CC BY-SA-NC 仅非商业；PCB 原理图与 BOM 不公开。\n\n「简历可以修饰，提交历史不会。」这 942 项测试，就是我们给学员的最好教材。'
      },
      {
        id: 'post-pledge-never',
        track: 'pledge',
        title: '信任公告：三条永不与五不四真',
        author: 'MK-07 秤 · 风控合规官',
        date: '2026-11-01',
        summary: '预收款的三成不是钱，是「随时全额退」这句话的抵押物。三条永不写进章程，总舵也不能破；五不四真是科研线的学术红线。',
        body: '信任是这个行业最贵的东西，也是最容易被自己人砸掉的东西。这篇公告把底线写死。\n\n三条永不（写进章程，总舵也不能破）：\n- 永不挪用预收款——30% 押金池不动，它是「随时全额退」这句话的抵押物；\n- 永不让渡课程与认证主权——标准在我们手里，牌子才值钱；\n- 永不取消公益名额——每期收益的固定比例进乡村专场。\n\n科研线的五不四真：\n- 五不：不卖推荐信 / 不虚构经历 / 不代写挂名 / 不承诺结果 / 不夸大未成年；\n- 四真：真实亲带 / 真实课题 / 真实署名 / 广告只讲过程。\n\n招生官严查付费推荐信——真实亲带既是合规底线，也是最强卖点。「推荐信一旦标价，就从证明变成商品。」\n\n还有一个品牌死刑案供警示：曾有「网上获取青少年和家长的 QQ、微信」的需求被一票否决——个人信息保护法 28/31 条与刑法 253 条之一，都是红线。遮着，才是真的死刑。\n\n「牌子这东西，攒起来论年，砸下去论夜。宁可慢，不可烂。」'
      }
    ];
  }

  /* ---------- demo 模式：各实现 ---------- */
  function demoSubmitSurvey(data) {
    var list = read('survey_responses', []);
    var rec = {};
    for (var key in data) rec[key] = data[key];
    rec.id = uid('srv');
    rec.createdAt = new Date().toISOString();
    list.push(rec);
    write('survey_responses', list);
    return Promise.resolve({ ok: true, id: rec.id });
  }

  function demoSubmitCampApp(data) {
    var list = read('camp_applications', []);
    var rec = {};
    for (var key in data) rec[key] = data[key];
    rec.id = uid('camp');
    rec.status = 'new';
    rec.createdAt = new Date().toISOString();
    list.push(rec);
    write('camp_applications', list);
    return Promise.resolve({ ok: true, id: rec.id });
  }

  function demoListActivities() {
    var list = ensureSeed('activities', seedActivities);
    var rsvps = read('rsvps', {});
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var copy = {};
      for (var key in list[i]) copy[key] = list[i][key];
      copy.taken = (rsvps[list[i].id] || []).length;
      out.push(copy);
    }
    return Promise.resolve(out);
  }

  function demoRsvp(activityId, data) {
    var map = read('rsvps', {});
    var arr = map[activityId] || [];
    arr.push({ nickname: data.nickname, wechat: data.wechat, at: new Date().toISOString() });
    map[activityId] = arr;
    write('rsvps', map);
    return Promise.resolve({ ok: true });
  }

  function demoListPosts(track) {
    var list = ensureSeed('posts', seedPosts).slice();
    list.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    if (track) {
      list = list.filter(function (p) { return p.track === track; });
    }
    return Promise.resolve(list);
  }

  function demoGetPost(id) {
    var list = ensureSeed('posts', seedPosts);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return Promise.resolve(list[i]);
    }
    return Promise.resolve(null);
  }

  /* ---------- live 模式：Supabase REST（PostgREST） ---------- */

  function restHeaders() {
    return {
      'apikey': SB_KEY,
      'Authorization': 'Bearer ' + SB_KEY,
      'Content-Type': 'application/json'
    };
  }

  function restPost(table, body) {
    /* 对 anon 仅可写不可读的表（RLS insert-only），不用 return=representation：201 即成功 */
    return fetch(SB_URL + '/rest/v1/' + table, {
      method: 'POST',
      headers: restHeaders(),
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error(r.statusText || ('HTTP ' + r.status));
      return { ok: true };
    });
  }

  function restGet(pathAndQuery) {
    return fetch(SB_URL + '/rest/v1/' + pathAndQuery, { headers: restHeaders() })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
  }

  function rpc(name, body) {
    return fetch(SB_URL + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: restHeaders(),
      body: JSON.stringify(body || {})
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function liveSubmitSurvey(data) {
    return restPost('survey_responses', {
      version: data.version || 'v1.1.0',
      duck_id: data.duckId || '',
      answers: data.answers || {},
      tags: data.tags || [],
      contact: data.contact || ''
    });
  }

  function liveSubmitCampApp(data) {
    return restPost('camp_applications', {
      nickname: data.nickname,
      identity: data.identity,
      city: data.city,
      wechat: data.wechat,
      track: data.track,
      motive: data.motive || ''
    });
  }

  function liveListActivities() {
    return rpc('list_activities').then(function (rows) {
      var out = [];
      for (var i = 0; i < (rows || []).length; i++) {
        var row = rows[i];
        out.push({
          id: row.id,
          startsAt: row.starts_at,
          type: row.slot,
          title: row.title,
          speaker: row.host,
          desc: row.descr || '',
          capacity: row.capacity,
          taken: row.taken
        });
      }
      return out;
    });
  }

  /* RPC 返回状态文本 → 站点提示 */
  var RSVP_MSG = {
    expired: '该场次已开始，报名截止了',
    duplicate: '这个微信号已经报过名了',
    full: '本场名额已满',
    notfound: '场次不存在或已下架',
    error: '报名失败，请稍后重试'
  };

  function liveRsvp(activityId, data) {
    return rpc('rsvp', { p_activity: activityId, p_nickname: data.nickname, p_wechat: data.wechat })
      .then(function (status) {
        if (status === 'ok') return { ok: true };
        return { ok: false, msg: RSVP_MSG[status] || '报名失败，请稍后重试' };
      });
  }

  /* SQL 侧 track 与站点栏目键一致：book / log / eng / pledge（v3 起新栏目直用新键） */
  function trackToSql(t) { return t; }
  function trackToSite(t) { return t; }

  function dateOnly(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }

  function postFromRow(row) {
    var body = String(row.body || '');
    return {
      id: row.id,
      track: trackToSite(row.track),
      title: row.title,
      author: row.author,
      date: dateOnly(row.created_at),
      summary: body.replace(/\s+/g, ' ').slice(0, 60),
      body: body
    };
  }

  function liveListPosts(track) {
    var q = '?select=id,track,title,author,body,created_at&order=created_at.desc';
    if (track) q += '&track=eq.' + encodeURIComponent(trackToSql(track));
    return restGet('posts' + q).then(function (rows) {
      var out = [];
      for (var i = 0; i < (rows || []).length; i++) out.push(postFromRow(rows[i]));
      return out;
    });
  }

  function liveGetPost(id) {
    return restGet('posts?select=*&id=eq.' + encodeURIComponent(id)).then(function (rows) {
      return (rows && rows.length) ? postFromRow(rows[0]) : null;
    });
  }

  /* ---------- 对外统一接口 ---------- */
  window.Api = {
    mode: MODE,

    /* 段位测试答卷：全部答案 + 派生标签 + 联系方式（X1 选填） */
    submitSurvey: function (data) {
      return MODE === 'live'
        ? liveSubmitSurvey(data)
        : demoSubmitSurvey(data);
    },

    /* 三轨营报名 */
    submitCampApp: function (data) {
      return MODE === 'live'
        ? liveSubmitCampApp(data)
        : demoSubmitCampApp(data);
    },

    listActivities: function () {
      return MODE === 'live'
        ? liveListActivities()
        : demoListActivities();
    },

    /* 返回 {ok:true} 或 {ok:false, msg:'具体原因'}；网络异常 reject */
    rsvp: function (activityId, data) {
      return MODE === 'live'
        ? liveRsvp(activityId, data)
        : demoRsvp(activityId, data);
    },

    listPosts: function (track) {
      return MODE === 'live'
        ? liveListPosts(track)
        : demoListPosts(track);
    },

    getPost: function (id) {
      return MODE === 'live'
        ? liveGetPost(id)
        : demoGetPost(id);
    }
  };
})();
