/* MicroDuck复刻营 · 前端应用 v3（hash 路由 SPA）
 * 路由：#/ 首页（隐藏 #app-view 显示静态内容）、#/test 段位测试（33 题分支问卷 v1.1.0）、
 *       #/growth 成长体系、#/map 作战图谱、#/camp 三轨营+报名、#/open 开源内核、
 *       #/activities 活动、#/library 内容库、#/library/:id 文章详情、#/pledge 十方共赢、#/admin 管理指南。
 * 数据全部经 window.Api（assets/api.js）；题库 window.QUIZ（assets/quiz-data.js）；
 * FW_CONFIG.SUPABASE 的 url/anonKey 任一为空 = 演示模式。
 * 内容源：MATERIALS-BRIEF.md（数字逐字）；问卷源：microduck-survey/docs/问卷全文-v1.1.0.docx。
 */
(function () {
  'use strict';

  var Api = window.Api;
  var Q = window.QUIZ;
  var SUPA_CFG = (window.FW_CONFIG || {}).SUPABASE || {};
  var IS_DEMO = !(SUPA_CFG.url && SUPA_CFG.anonKey);
  var SUPABASE_DASH = 'https://supabase.com/dashboard';

  var appView = null;
  var mainEl = null;
  var lastKey = null;
  var libTab = 'book';   // 内容库当前栏目（默认第一个：一人一鸭·连载）

  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var TYPE_COLORS = { '体验课': '#F2A93B', '仿真赛': '#24466B', 'Demo Day': '#C0392B', '造物者节': '#8A5A2B' };
  var COLS = [
    { key: 'book', name: '一人一鸭·连载', color: '#F2A93B' },
    { key: 'log', name: '复刻者日志', color: '#24466B' },
    { key: 'eng', name: '工程白皮书', color: '#4A6785' },
    { key: 'pledge', name: '信任公告', color: '#C0392B' }
  ];

  /* ============ 工具 ============ */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function parseWhen(iso) {
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function fmtBadgeDate(d) { return pad2(d.getMonth() + 1) + '/' + pad2(d.getDate()); }
  function fmtBadgeWeek(d) { return WEEK[d.getDay()] + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }

  function isPast(iso) {
    var d = parseWhen(iso);
    return !d || d.getTime() < Date.now();
  }

  function colOf(key) {
    for (var i = 0; i < COLS.length; i++) {
      if (COLS[i].key === key) return COLS[i];
    }
    return { key: key, name: key || '未分类', color: '#8CA0B6' };
  }

  function typeColor(type) { return TYPE_COLORS[type] || '#4A6785'; }

  function toast(msg) {
    var box = document.getElementById('toast-box');
    if (!box) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    box.appendChild(t);
    window.requestAnimationFrame(function () { t.classList.add('show'); });
    window.setTimeout(function () {
      t.classList.remove('show');
      window.setTimeout(function () {
        if (t.parentNode) t.parentNode.removeChild(t);
      }, 320);
    }, 3000);
  }

  /* ============ 表单校验（必填 + 行内错误） ============ */

  function filled(v) { return String(v == null ? '' : v).trim().length > 0; }

  function invalidate(input, msg) {
    var f = input && input.closest ? input.closest('.field') : null;
    if (!f) return;
    f.classList.add('invalid');
    var e = f.querySelector('.err-msg');
    if (e) e.textContent = msg || '该项必填';
  }

  function validate(form, rules) {
    var data = {};
    var ok = true;
    for (var i = 0; i < rules.length; i++) {
      var el = form.elements[rules[i].name];
      if (!el) continue;
      var v = String(el.value || '').trim();
      data[rules[i].name] = v;
      if (!filled(v)) { invalidate(el, '请填写' + rules[i].label); ok = false; }
    }
    return ok ? data : null;
  }

  function bindLiveClear(root) {
    function handler(e) {
      var f = e.target && e.target.closest ? e.target.closest('.field') : null;
      if (f) f.classList.remove('invalid');
    }
    root.addEventListener('input', handler);
    root.addEventListener('change', handler);
  }

  function fld(label, inner, opts) {
    opts = opts || {};
    return '<div class="field">' +
      '<label for="' + opts.id + '">' + label + (opts.required ? '<em>*</em>' : '') + '</label>' +
      inner +
      (opts.hint ? '<div class="hint">' + opts.hint + '</div>' : '') +
      '<div class="err-msg"></div>' +
      '</div>';
  }

  function inText(id, name, ph, extra) {
    return '<input id="' + id + '" name="' + name + '" type="text" placeholder="' + esc(ph || '') + '" autocomplete="off"' + (extra || '') + '>';
  }

  function inSelect(id, name, options, placeholder) {
    var h = '<select id="' + id + '" name="' + name + '">';
    if (placeholder) h += '<option value="" disabled selected>' + esc(placeholder) + '</option>';
    for (var i = 0; i < options.length; i++) {
      var pair = Array.isArray(options[i]) ? options[i] : [options[i], options[i]];
      h += '<option value="' + esc(pair[0]) + '">' + esc(pair[1]) + '</option>';
    }
    return h + '</select>';
  }

  function pageHead(kicker, title, desc) {
    return '<div class="page-head">' +
      '<div class="kicker">' + kicker + '</div>' +
      '<h2>' + title + '</h2>' +
      (desc ? '<p class="desc">' + desc + '</p>' : '') +
      '</div>';
  }

  /* ============ 路由 ============ */

  function parseRoute() {
    var h = window.location.hash || '';
    if (h === '' || h === '#' || h === '#/') return { view: 'home' };
    if (h.indexOf('#/') !== 0) return null;   // 站内锚点，不切视图
    var parts = h.slice(2).split('/');
    var head = parts[0] || '';
    if (head === 'test') return { view: 'test' };
    if (head === 'growth') return { view: 'growth' };
    if (head === 'map') return { view: 'map' };
    if (head === 'camp') return { view: 'camp' };
    if (head === 'open') return { view: 'open' };
    if (head === 'pledge') return { view: 'pledge' };
    if (head === 'vision') return { view: 'vision' };
    if (head === 'activities') return { view: 'activities' };
    if (head === 'library') {
      if (parts[1]) {
        var pid = parts[1];
        try { pid = decodeURIComponent(pid); } catch (e) { /* 原样使用 */ }
        return { view: 'post', id: pid };
      }
      return { view: 'library' };
    }
    if (head === 'admin') return { view: 'admin' };
    if (head === '') return { view: 'home' };
    return { view: '404' };
  }

  function routeKey(r) { return r ? r.view + (r.id ? ':' + r.id : '') : ''; }

  function setNavActive(view) {
    var map = {
      home: '#/', test: '#/test', growth: '#/growth', map: '#/map',
      camp: '#/camp', library: '#/library', post: '#/library'
    };
    var target = map[view] || '';
    var links = document.querySelectorAll('.nav-links a');
    for (var i = 0; i < links.length; i++) {
      if (links[i].getAttribute('href') === target) links[i].classList.add('active');
      else links[i].classList.remove('active');
    }
  }

  function render() {
    var r = parseRoute();
    lastKey = routeKey(r);
    if (!r || r.view === 'home') {
      appView.hidden = true;
      appView.innerHTML = '';
      mainEl.hidden = false;
      setNavActive('home');
      return;
    }
    mainEl.hidden = true;
    appView.hidden = false;
    window.scrollTo(0, 0);
    if (r.view === 'test') { setNavActive('test'); viewTest(); }
    else if (r.view === 'growth') { setNavActive('growth'); viewGrowth(); }
    else if (r.view === 'map') { setNavActive('map'); viewMap(); }
    else if (r.view === 'camp') { setNavActive('camp'); viewCamp(); }
    else if (r.view === 'open') { setNavActive(''); viewOpen(); }
    else if (r.view === 'pledge') { setNavActive(''); viewPledge(); }
    else if (r.view === 'vision') { setNavActive(''); viewVision(); }
    else if (r.view === 'activities') { setNavActive(''); viewActivities(); }
    else if (r.view === 'library') { setNavActive('library'); viewLibrary(); }
    else if (r.view === 'post') { setNavActive('post'); viewPost(r.id); }
    else if (r.view === 'admin') { setNavActive(''); viewAdmin(); }
    else { setNavActive(''); view404(); }
  }

  function onHashChange() {
    var r = parseRoute();
    if (!r) return;
    if (routeKey(r) === lastKey) return;
    render();
  }

  /* ============================================================
   * 视图：#/test 段位测试（问卷 v1.1.0 · 33 题动态分支流）
   * phase: intro → flow（过渡页/题目交替）→ result
   * 注意：不伪造七级段位判定——结果页只输出「分层画像卡」，
   *       卡片角落标注「段位体系 2027 寒假实装」。
   * ============================================================ */

  var quiz = null;   // { phase, answers, curId, sectionsSeen, duckId, submitted }

  function viewTest() {
    if (!quiz) quiz = { phase: 'intro', answers: {}, curId: null, sectionsSeen: {}, duckId: '', submitted: false };
    appView.innerHTML =
      '<section class="page"><div class="wrap wrap-narrow">' +
        '<div class="quiz-shell">' +
          '<div class="quiz-top" id="quiz-top"></div>' +
          '<div class="quiz-body" id="quiz-body"></div>' +
        '</div>' +
      '</div></section>';
    paintQuiz();
  }

  function quizVisible() { return Q.visibleList(quiz.answers); }

  function paintQuiz() {
    var top = document.getElementById('quiz-top');
    var body = document.getElementById('quiz-body');
    if (!top || !body) return;   // 用户已离开本视图

    if (quiz.phase === 'intro') {
      top.innerHTML = '<span class="quiz-progress-label">QUIZ ' + esc(Q.version.toUpperCase()) + '</span><div class="quiz-bar"><i style="width:0%"></i></div>';
      body.innerHTML =
        '<div class="quiz-intro">' +
          '<h2>' + esc(Q.intro.title) + '</h2>' +
          '<div class="qi-sub">' + esc(Q.intro.sub) + '</div>' +
          '<div class="qi-meta">' + esc(Q.intro.meta) + '</div>' +
          '<div class="qi-branch">' + esc(Q.intro.branch) + '</div>' +
          '<div class="qi-privacy">' + esc(Q.intro.privacy) + '</div>' +
          '<button type="button" class="btn btn-primary" id="quiz-start">开始测试</button>' +
        '</div>';
      document.getElementById('quiz-start').addEventListener('click', function () {
        quiz.phase = 'flow';
        quiz.answers = {};
        quiz.sectionsSeen = {};
        var list = quizVisible();
        quiz.curId = list.length ? list[0].id : null;
        paintQuiz();
      });
      return;
    }

    if (quiz.phase === 'result') { paintQuizResult(); return; }

    /* flow：先看是否需要段落过渡页 */
    var list = quizVisible();
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].id === quiz.curId) { idx = i; break; } }
    if (idx < 0) { finishQuiz(); return; }

    var q = list[idx];
    var pct = Math.round((idx / list.length) * 100);
    top.innerHTML = '<span class="quiz-progress-label">第 ' + (idx + 1) + ' 题 · 共约 ' + list.length + ' 题</span>' +
      '<div class="quiz-bar"><i style="width:' + pct + '%"></i></div>';

    var sec = Q.sections[q.section];
    if (!quiz.sectionsSeen[q.section]) {
      quiz.sectionsSeen[q.section] = true;
      body.innerHTML =
        '<div class="quiz-transition">' +
          '<div class="qt-sec">SECTION ' + esc(sec.no) + ' / 7</div>' +
          '<h3>' + esc(sec.name) + '</h3>' +
          '<p>' + esc(sec.line) + '</p>' +
          '<button type="button" class="btn btn-primary quiz-continue">继续</button>' +
        '</div>';
      body.querySelector('.quiz-continue').addEventListener('click', paintQuiz);
      return;
    }

    body.setAttribute('data-kind', q.type);
    body.innerHTML = quizQuestionHtml(q, idx, list.length);
    bindQuizQuestion(q, body);
  }

  function optLetter(n) {
    return String.fromCharCode(65 + n);   // A B C ...
  }

  function quizQuestionHtml(q, idx, total) {
    var h = '<div class="quiz-q" data-qid="' + esc(q.id) + '" data-kind="' + esc(q.type) + '">';
    h += '<div class="quiz-qid">Q' + esc(q.id) + ' · ' + (idx + 1) + '/' + total + '</div>';
    h += '<div class="quiz-q-title">' + esc(q.title) + '</div>';
    if (q.hint) h += '<div class="quiz-q-hint">' + esc(q.hint) + '</div>';

    var saved = quiz.answers[q.id];

    if (q.type === 'single') {
      h += '<div class="opt-list">';
      for (var i = 0; i < q.options.length; i++) {
        var o = q.options[i];
        var picked = saved === o.v ? ' picked' : '';
        h += '<button type="button" class="opt' + picked + '" data-v="' + esc(o.v) + '">' +
               '<span class="opt-key">' + optLetter(i) + '</span><span>' + esc(o.t) + '</span></button>';
      }
      h += '</div>';
    } else if (q.type === 'multi' || q.type === 'multi3') {
      h += '<div class="opt-list">';
      for (var j = 0; j < q.options.length; j++) {
        var mo = q.options[j];
        var on = saved && saved.indexOf(mo.v) >= 0 ? ' picked' : '';
        h += '<button type="button" class="opt opt-box' + on + '" data-v="' + esc(mo.v) + '"' + (mo.exclusive ? ' data-exclusive="1"' : '') + '>' +
               '<span class="opt-key">' + optLetter(j) + '</span><span>' + esc(mo.t) + '</span></button>';
      }
      h += '</div>';
      h += '<div class="opt-note" role="alert"></div>';
      var confirmDisabled = (q.required !== false);
      h += '<div class="quiz-actions">' +
             '<button type="button" class="btn btn-primary quiz-confirm"' + (confirmDisabled ? '' : '') + '>' + (q.required !== false ? '确认' : '确认（可跳过）') + '</button>' +
             '<button type="button" class="quiz-back">← 上一题</button>' +
           '</div>';
    } else if (q.type === 'open') {
      h += '<div class="field">' +
             '<textarea id="quiz-open" maxlength="' + (q.maxLen || 200) + '" placeholder="' + (q.required === false ? '选填，可直接跳过' : '请输入') + '">' + esc(saved || '') + '</textarea>' +
           '</div>' +
           '<div class="quiz-actions">' +
             '<button type="button" class="btn btn-primary quiz-confirm">' + (q.required === false ? '下一题（选填）' : '确认') + '</button>' +
             '<button type="button" class="quiz-back">← 上一题</button>' +
           '</div>';
    } else if (q.type === 'score') {
      var v0 = typeof saved === 'number' ? saved : 5;
      h += '<div class="score-row">' +
             '<input type="range" id="quiz-score" min="0" max="10" step="1" value="' + v0 + '">' +
             '<span class="score-val" id="quiz-score-val">' + v0 + '</span>' +
           '</div>' +
           '<div class="score-scale"><span>0 绝不会</span><span>5 中性</span><span>10 一定会</span></div>' +
           '<div class="quiz-actions">' +
             '<button type="button" class="btn btn-primary quiz-confirm">确认</button>' +
             '<button type="button" class="quiz-back">← 上一题</button>' +
           '</div>';
    } else if (q.type === 'price4') {
      var pv = saved || {};
      h += '<div class="price4-grid">';
      for (var p = 0; p < q.fields.length; p++) {
        var f = q.fields[p];
        h += '<div class="price4-cell">' +
               '<div class="p4-label">' + esc(f.label) + '</div>' +
               '<div class="p4-desc">' + esc(f.desc) + '</div>' +
               '<input type="number" min="0" step="1" inputmode="numeric" data-p4="' + esc(f.key) + '" value="' + esc(pv[f.key] != null ? pv[f.key] : '') + '" placeholder="____ 元">' +
             '</div>';
      }
      h += '</div>' +
           '<div class="opt-note" role="alert"></div>' +
           '<div class="quiz-actions">' +
             '<button type="button" class="btn btn-primary quiz-confirm">确认</button>' +
             '<button type="button" class="quiz-back">← 上一题</button>' +
           '</div>';
    }

    if (q.type === 'single') {
      h += '<div class="quiz-actions"><button type="button" class="quiz-back">← 上一题</button></div>';
    }
    h += '</div>';
    return h;
  }

  function quizGoNext() {
    var list = quizVisible();
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].id === quiz.curId) { idx = i; break; } }
    for (var j = idx + 1; j < list.length; j++) {
      quiz.curId = list[j].id;
      paintQuiz();
      return;
    }
    finishQuiz();
  }

  function quizGoPrev() {
    var list = quizVisible();
    var idx = -1;
    for (var i = 0; i < list.length; i++) { if (list[i].id === quiz.curId) { idx = i; break; } }
    if (idx > 0) {
      quiz.curId = list[idx - 1].id;
      paintQuiz();
    }
  }

  function bindQuizQuestion(q, body) {
    var backBtn = body.querySelector('.quiz-back');
    if (backBtn) backBtn.addEventListener('click', quizGoPrev);

    if (q.type === 'single') {
      var opts = body.querySelectorAll('.opt');
      for (var i = 0; i < opts.length; i++) {
        opts[i].addEventListener('click', function () {
          for (var k = 0; k < opts.length; k++) opts[k].classList.remove('picked');
          this.classList.add('picked');
          quiz.answers[q.id] = this.getAttribute('data-v');
          var self = this;
          window.setTimeout(function () {
            if (quiz && quiz.phase === 'flow' && quiz.answers[q.id] === self.getAttribute('data-v')) quizGoNext();
          }, 280);
        });
      }
    } else if (q.type === 'multi' || q.type === 'multi3') {
      var max = q.type === 'multi3' ? (q.max || 3) : 0;
      var note = body.querySelector('.opt-note');
      var mopts = body.querySelectorAll('.opt');
      function selCount() {
        var n = 0;
        for (var c = 0; c < mopts.length; c++) if (mopts[c].classList.contains('picked')) n++;
        return n;
      }
      function syncHidden() {
        var vals = [];
        for (var c = 0; c < mopts.length; c++) {
          if (mopts[c].classList.contains('picked')) vals.push(mopts[c].getAttribute('data-v'));
        }
        quiz.answers[q.id] = vals;
      }
      for (var m = 0; m < mopts.length; m++) {
        mopts[m].addEventListener('click', function () {
          if (this.classList.contains('picked')) {
            this.classList.remove('picked');
            if (note) note.textContent = '';
            syncHidden();
            return;
          }
          if (max && selCount() >= max) {
            if (note) note.textContent = '最多选 ' + max + ' 项，先取消一项再选。';
            return;
          }
          if (this.getAttribute('data-exclusive')) {
            for (var c2 = 0; c2 < mopts.length; c2++) mopts[c2].classList.remove('picked');
          } else {
            for (var c3 = 0; c3 < mopts.length; c3++) {
              if (mopts[c3].getAttribute('data-exclusive')) mopts[c3].classList.remove('picked');
            }
          }
          this.classList.add('picked');
          if (note) note.textContent = '';
          syncHidden();
        });
      }
      body.querySelector('.quiz-confirm').addEventListener('click', function () {
        var vals = quiz.answers[q.id] || [];
        if (q.required !== false && vals.length === 0) {
          if (note) note.textContent = '至少选一项';
          return;
        }
        quizGoNext();
      });
    } else if (q.type === 'open') {
      var ta = body.querySelector('#quiz-open');
      body.querySelector('.quiz-confirm').addEventListener('click', function () {
        quiz.answers[q.id] = String(ta.value || '').trim();
        quizGoNext();
      });
    } else if (q.type === 'score') {
      var range = body.querySelector('#quiz-score');
      var val = body.querySelector('#quiz-score-val');
      range.addEventListener('input', function () { val.textContent = range.value; });
      body.querySelector('.quiz-confirm').addEventListener('click', function () {
        quiz.answers[q.id] = Number(range.value);
        quizGoNext();
      });
    } else if (q.type === 'price4') {
      var note2 = body.querySelector('.opt-note');
      body.querySelector('.quiz-confirm').addEventListener('click', function () {
        var inputs = body.querySelectorAll('input[data-p4]');
        var vals = {};
        var allNum = true;
        for (var p = 0; p < inputs.length; p++) {
          var key = inputs[p].getAttribute('data-p4');
          var num = Number(inputs[p].value);
          if (!isFinite(num) || inputs[p].value === '' || num <= 0) { allNum = false; break; }
          vals[key] = num;
        }
        if (!allNum) {
          if (note2) note2.textContent = '四个价位都请填写大于 0 的数字。';
          return;
        }
        if (!(vals.cheap < vals.fair && vals.fair < vals.pricey && vals.pricey < vals.tooexp)) {
          if (note2) note2.textContent = '价格需满足：太便宜 < 划算价 < 有点贵 < 太贵，请重填。';
          return;
        }
        if (note2) note2.textContent = '';
        quiz.answers[q.id] = vals;
        quizGoNext();
      });
    }
  }

  /* ---------- 结果：派生标签 + canvas 画像卡 + 提交 ---------- */

  function deriveTags(a) {
    var tags = [];
    var peopleMap = {
      stu_eng: '在校理工生', stu_lib: '在校非理工生', fresh: '应届毕业生',
      employed: '职场人', educator: '教育机构从业者', freelance: '自由职业/创业者', other: '探索者'
    };
    tags.push('人群 · ' + (peopleMap[a.A1] || '未填'));

    var hands = Q.helpers.handsOn(a);
    var tendency = hands ? '动手型'
      : ((a.B3 === 'paid_try' || (a.B2 && a.B2.indexOf('bought') >= 0)) ? '投入型' : '观察型');
    tags.push('动手倾向 · ' + tendency);

    var c1Map = { zero: '¥0 观望', under3k: '轻投入 <¥3k', '3kto10k': '中度 ¥3k–1万', over10k: '高投入 >¥1万' };
    tags.push('付费带 · ' + (c1Map[a.C1] || '未填'));

    var x1bMap = {
      experience_officer: '新品体验官', co_creation: '共创计划',
      study_abroad: '留学背景提升', lecturer: '讲师合作', report_only: '接收报告'
    };
    var interest = '';
    if (a.X1b && a.X1b.length) {
      var parts = [];
      for (var i = 0; i < a.X1b.length; i++) {
        if (x1bMap[a.X1b[i]]) parts.push(x1bMap[a.X1b[i]]);
      }
      interest = parts.join(' / ');
    }
    if (!interest) {
      if (hands) interest = '共创计划';
      else if (Q.helpers.isStudent(a) && a.D2 && a.D2 !== 'none') interest = '留学背景提升';
      else interest = '关注中';
    }
    tags.push('兴趣标签 · ' + interest);
    return tags;
  }

  function drawDuckCard(canvas, tags, duckId) {
    var W = 600, H = 800;
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var INK = '#1C2B3A', CREAM = '#F5F1E8', DUCK = '#F2A93B', BEAK = '#E8B84B';

    /* 底：靛墨蓝坐标纸 */
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(245,241,232,0.06)';
    ctx.lineWidth = 1;
    for (var g = 40; g < W; g += 40) {
      ctx.beginPath(); ctx.moveTo(g, 0); ctx.lineTo(g, H); ctx.stroke();
    }
    for (var g2 = 40; g2 < H; g2 += 40) {
      ctx.beginPath(); ctx.moveTo(0, g2); ctx.lineTo(W, g2); ctx.stroke();
    }

    /* 四角十字定位标 */
    ctx.strokeStyle = 'rgba(245,241,232,0.4)';
    ctx.lineWidth = 1.5;
    var cross = function (cx, cy) {
      ctx.beginPath(); ctx.moveTo(cx - 14, cy); ctx.lineTo(cx + 14, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy + 14); ctx.stroke();
    };
    cross(30, 30); cross(570, 30); cross(30, 770); cross(570, 770);

    /* 顶部品牌行 */
    ctx.fillStyle = DUCK;
    ctx.fillRect(52, 52, 20, 20);
    ctx.fillStyle = CREAM;
    ctx.font = '700 21px IBMPlexMono, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('MICRODUCK REPLICA CAMP', 84, 63);

    /* Duck 编号 */
    ctx.fillStyle = DUCK;
    ctx.font = '700 34px IBMPlexMono, monospace';
    ctx.fillText(duckId, 52, 122);

    /* 鸭形（雏鸭黄只给活的部分） */
    /* 腿脚（画在身体后面） */
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(330, 400); ctx.lineTo(346, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(392, 396); ctx.lineTo(384, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(322, 522); ctx.lineTo(382, 522); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(360, 518); ctx.lineTo(420, 518); ctx.stroke();
    /* 身体 */
    ctx.fillStyle = DUCK;
    ctx.beginPath();
    ctx.ellipse(310, 330, 138, 94, 0, 0, Math.PI * 2);
    ctx.fill();
    /* 头 */
    ctx.beginPath();
    ctx.arc(212, 212, 64, 0, Math.PI * 2);
    ctx.fill();
    /* 眼 */
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(190, 196, 9, 0, Math.PI * 2);
    ctx.fill();
    /* 喙 */
    ctx.fillStyle = BEAK;
    ctx.beginPath();
    ctx.moveTo(152, 212); ctx.lineTo(152, 246); ctx.lineTo(88, 229); ctx.closePath();
    ctx.fill();

    /* 尺寸标注线 */
    ctx.strokeStyle = 'rgba(245,241,232,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(110, 566); ctx.lineTo(490, 566); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(110, 552); ctx.lineTo(110, 580); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(490, 552); ctx.lineTo(490, 580); ctx.stroke();
    ctx.fillStyle = 'rgba(245,241,232,0.75)';
    ctx.font = '400 17px IBMPlexMono, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('H 250 MM · ZERO TO ONE', 300, 596);

    /* 画像标签（由答案推导） */
    var labels = ['人群', '动手倾向', '付费带', '兴趣标签'];
    var y0 = 636;
    for (var i = 0; i < tags.length && i < 4; i++) {
      var rowY = y0 + i * 34;
      ctx.textAlign = 'left';
      ctx.fillStyle = DUCK;
      ctx.font = '700 14px IBMPlexMono, monospace';
      ctx.fillText(labels[i] || '标签' + (i + 1), 60, rowY);
      ctx.fillStyle = CREAM;
      ctx.font = '400 19px -apple-system, PingFang SC, sans-serif';
      var val = String(tags[i] || '').replace(/^[^·]*·\s*/, '');
      ctx.fillText(val, 158, rowY);
    }

    /* 底部：版本 + 角落小字（不伪造段位判定） */
    ctx.fillStyle = 'rgba(245,241,232,0.72)';
    ctx.font = '400 14px -apple-system, PingFang SC, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MicroDuck复刻营 · 段位测试 v1.1.0', 300, 772);
    ctx.fillStyle = 'rgba(245,241,232,0.5)';
    ctx.font = '400 12px -apple-system, PingFang SC, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('段位体系 2027 寒假实装', 566, 748);
  }

  function paintQuizResult() {
    var top = document.getElementById('quiz-top');
    var body = document.getElementById('quiz-body');
    if (!top || !body) return;
    top.innerHTML = '<span class="quiz-progress-label">RESULT</span><div class="quiz-bar"><i style="width:100%"></i></div>';

    if (!quiz.duckId) {
      quiz.duckId = 'DUCK #R-' + (1000 + Math.floor(Math.random() * 9000));
    }
    var tags = deriveTags(quiz.answers);
    quiz.tags = tags;

    body.innerHTML =
      '<div class="quiz-result">' +
        '<h3>你的分层画像卡</h3>' +
        '<div class="qr-sub">「我能行」的第一份证据档案已生成——截图转发，就是段位卡的裂变钩子。</div>' +
        '<div class="duck-card-wrap"><canvas id="quiz-card-canvas" width="600" height="800" aria-label="分层画像卡"></canvas></div>' +
        '<div class="qr-tags">' + tags.map(function (t) {
          var idx = t.indexOf(' · ');
          return '<span class="qr-tag"><b>' + esc(t.slice(0, idx)) + '</b>' + esc(t.slice(idx + 3)) + '</span>';
        }).join('') + '</div>' +
        '<div class="qr-note">' + esc(quiz.duckId) + ' · 本卡为分层画像，不构成七级段位判定；段位体系 2027 寒假实装。</div>' +
        '<div class="qr-actions">' +
          '<button type="button" class="btn btn-primary" id="quiz-download">下载画像卡 PNG</button>' +
          '<a class="btn btn-ghost" href="#/camp">报名三轨营</a>' +
          '<button type="button" class="btn btn-ghost" id="quiz-retry">重新测一次</button>' +
        '</div>' +
      '</div>';

    var canvas = document.getElementById('quiz-card-canvas');
    if (canvas && canvas.getContext) drawDuckCard(canvas, tags, quiz.duckId);

    var dl = document.getElementById('quiz-download');
    if (dl) {
      dl.addEventListener('click', function () {
        if (!canvas) return;
        try {
          var a = document.createElement('a');
          a.href = canvas.toDataURL('image/png');
          a.download = 'MicroDuck-段位画像卡-' + quiz.duckId.replace(/\s+/g, '') + '.png';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          toast('画像卡已生成，去下载目录找它');
        } catch (e) {
          toast('下载失败：请长按/右键画布保存');
        }
      });
    }
    var retry = document.getElementById('quiz-retry');
    if (retry) {
      retry.addEventListener('click', function () {
        quiz = null;
        viewTest();
      });
    }

    if (!quiz.submitted) {
      quiz.submitted = true;
      Api.submitSurvey({
        version: Q.version,
        duckId: quiz.duckId,
        answers: quiz.answers,
        tags: tags,
        contact: String(quiz.answers.X1 || '')
      }).catch(function () {
        toast('答卷提交失败，已保留在本页');
      });
    }
  }

  function finishQuiz() {
    quiz.phase = 'result';
    paintQuizResult();
  }

  /* ============================================================
   * 视图：#/growth 成长体系（七级段位 + 五幕关卡 + 成就墙 + 一条经验槽）
   * ============================================================ */

  var RANKS = [
    ['L1', '青铜', '见习造物者', '独立复刻点亮：装鸭 / 复刻运行', '+100'],
    ['L2', '白银', '复刻工匠', '复刻方案 v1 · 8 条复刻回答', '+200'],
    ['L3', '黄金', '魔改师', '魔改上 Demo Day · 亮相', '+500'],
    ['L4', '铂金', '原创者', '上游 PR 合入 · changelog 署名', '+800'],
    ['L5', '钻石', '舰队队长', '带队开新点', '+1000'],
    ['L6', '王者', '造物主', '城市合伙人 / 企业级工程 · 产品孵化', '+2000'],
    ['L7', '传奇', '具身智能行业领军人', '行业角色', '∞']
  ];

  var STAGES = [
    ['第一幕 · 新手村', '装鸭', '首只鸭点亮仪式：开营夜全场熄灯，每人点亮自己的鸭'],
    ['第二幕 · 工坊副本', '魔改', '改结构改任务：「我教会鸭子 X」，装调本身就是乐趣'],
    ['第三幕 · 竞技场', '仿真 / 区域赛', 'sim-only 一台笔记本完赛；2027 暑区域联赛'],
    ['第四幕 · 总决赛', '2028 总决赛', '六城网络时代的年度对决；造物者节定每年 1 月首战开幕日'],
    ['第五幕 · 开放世界', '营后世界', '开源社区、带队开点、产品孵化——排名会刷新，足迹不会']
  ];

  var BADGES = [
    ['初啼', '首次点亮', '普通', 'bw-common', '🐣'],
    ['上游合入', 'PR 被上游采纳', '稀有', 'bw-rare', '🔧'],
    ['一徒成师', '带出徒弟升段', '史诗', 'bw-epic', '🦆'],
    ['城市之光', '开城贡献第一', '史诗', 'bw-epic', '🌆'],
    ['封神', '传奇段位', '传说', 'bw-legend', '👑']
  ];

  var SLOT_FLOW = [
    ['学员', '营员起步，段位终身有效'],
    ['助教', '免学费 + 补贴 · 约 20% 转化通道'],
    ['主讲', '双城认证：成都 + 杭州两座首战城都认可才算数'],
    ['城市合伙人', '持牌开点，把四道闸口交到你手里']
  ];

  function viewGrowth() {
    var rankRows = '';
    for (var i = 0; i < RANKS.length; i++) {
      var r = RANKS[i];
      rankRows +=
        '<div class="card rank-card">' +
          '<div class="rank-lv">' + esc(r[0]) + '</div>' +
          '<div class="rank-main">' +
            '<h3>' + esc(r[1]) + ' · ' + esc(r[2]) + '<span class="rk-tier">' + esc(r[0]) + '</span></h3>' +
            '<div class="rk-crit">判据：' + esc(r[3]) + '</div>' +
          '</div>' +
          '<div class="rank-exp">EXP ' + esc(r[4]) + '</div>' +
        '</div>';
    }
    var stageCards = '';
    for (var s = 0; s < STAGES.length; s++) {
      stageCards +=
        '<div class="act-stage"><div class="as-no">ACT ' + (s + 1) + '/5</div>' +
          '<h3>' + esc(STAGES[s][0].split(' · ')[1]) + '</h3>' +
          '<p><b>' + esc(STAGES[s][1]) + '</b> — ' + esc(STAGES[s][2]) + '</p></div>';
    }
    var badgeCards = '';
    for (var b = 0; b < BADGES.length; b++) {
      var bd = BADGES[b];
      badgeCards +=
        '<div class="bw-item ' + bd[3] + '"><span class="bw-tier">' + esc(bd[2]) + '</span>' +
          '<div class="bw-icon">' + bd[4] + '</div><h3>' + esc(bd[0]) + '</h3><p>' + esc(bd[1]) + '</p></div>';
    }
    var slotNodes = '';
    for (var f = 0; f < SLOT_FLOW.length; f++) {
      slotNodes += '<div class="slot-node"><h3>' + esc(SLOT_FLOW[f][0]) + '</h3><p>' + esc(SLOT_FLOW[f][1]) + '</p></div>';
    }

    appView.innerHTML =
      '<section class="page"><div class="wrap">' +
        pageHead('GROWTH SYSTEM', '成长体系',
          '七级段位，每级一段能讲出来的故事。段位永久有效；赛季排行榜每半年重置；个人和组织共用一条经验槽——帮别人升级就是给自己升级。') +
        '<div class="tune-note">EXP 数值待实测调参（方案注明，以书稿版为基准）</div>' +
        '<h3 class="list-title">七级段位</h3>' +
        '<div class="rank-list">' + rankRows + '</div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">五幕关卡</h3>' +
        '<div class="acts-row">' + stageCards + '</div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">成就墙</h3>' +
        '<p class="desc" style="margin-bottom:14px">成就分普通 / 稀有 / 史诗 / 传说四档，随成长阶段更新。</p>' +
        '<div class="badge-wall">' + badgeCards + '</div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">一条经验槽</h3>' +
        '<p class="desc" style="margin-bottom:14px">学员 → 助教（约 20% 转化）→ 主讲（双城认证）→ 城市合伙人。个人升级与组织升级走同一条槽。</p>' +
        '<div class="slot-flow">' + slotNodes + '</div>' +
      '</div></section>';
  }

  /* ============================================================
   * 视图：#/map 作战图谱（路线图 + 城市网络 + 六环飞轮）
   * ============================================================ */

  var ROADMAP = [
    ['2026 Q4', '内核贯通 · 课程包 v0', 'GitHub + Gitee 双仓跑通，月度发版当节拍器，课程包 v0 完成。'],
    ['2027 寒', '双城首战 + 仿真赛 No.1', '成都 + 杭州：一座城是运气，两座城才是模型。仿真赛道一台笔记本即可完赛。'],
    ['2027 春', '开源 v1.20 · 社团分部', '开源 v1.20 发布；校园翼启动，20 校社团供给营员与助教。'],
    ['2027 暑', '+ 广州天津 · 区域赛', 'P1 两城开点，区域联赛启动；四道闸口吃台账数据。'],
    ['2027 秋', '认证 + 课程包商业化', '首战四闸口必须已过，商业化才开闸：讲师认证 + 课程包输出。'],
    ['2028 寒', '六城网络 + 总决赛', '成网期第一战：六城同开，总决赛落地。'],
    ['2028+', '20+ 城 · 东南亚试点', '把光带铺向每一座城；Chapter Kit 自助开办包压低开点成本。']
  ];

  var PHASES = [
    ['启动期', '先跑起来'],
    ['扩张期', '把光带铺向每一座城'],
    ['成网期', '造物者时代']
  ];

  var CITIES = [
    ['首战', '成都 · 杭州', '2027 寒双城首战', ''],
    ['P1', '广州 · 天津', '2027 暖季开点', ''],
    ['P2', '西安 · 太原', '复测后开点', ''],
    ['观察', '青岛', '从名单拿下案例在册', 'hold']
  ];

  var FLYWHEEL = [
    ['01', '开源内核'],
    ['02', '节点低门槛起步'],
    ['03', '作品产出'],
    ['04', '回流社区'],
    ['05', '荣誉放大'],
    ['06', '新节点加入']
  ];

  /* 三翼飞轮（公开安全层：只谈机制与顺序，不含分成比例与转化红线数值） */
  var WINGS = [
    ['家长翼 · 信任驱动', '五级梯子',
      ['观望', '体验（99 元体验课）', '忠诚（成长档案）', '组织（拼班团长）', '合伙人（城市分部共建）'],
      '家长不是流量，是孩子身边最可信的传播节点——每一级梯子都有实物承接。'],
    ['校园翼 · 资产驱动', '六环',
      ['微专业共建', '社团分部', '课程共建', '竞赛战队', '就业直通', '科研反哺'],
      '每进一环，校园资产厚一层；头一环微专业共建，是其余五环的地基。'],
    ['社会结构翼 · 交换驱动', '只谈对方 KPI',
      ['科协·科普数据', '机构·利润', '企业·ESG', '媒体·传播点'],
      '头部联培走「新东方模式」：我方工程师驻场教学，对方出场地与生源。']
  ];

  function viewMap() {
    var tl = '';
    for (var i = 0; i < ROADMAP.length; i++) {
      tl += '<div class="tl-node">' +
        '<div class="tl-when">' + esc(ROADMAP[i][0]) + '</div>' +
        '<h3>' + esc(ROADMAP[i][1]) + '</h3>' +
        '<p>' + esc(ROADMAP[i][2]) + '</p></div>';
    }
    var mottoHtml = '';
    for (var p = 0; p < PHASES.length; p++) {
      mottoHtml += '<div><b>[' + esc(PHASES[p][0]) + ']</b> 「' + esc(PHASES[p][1]) + '」</div>';
    }
    var cityCards = '';
    for (var c = 0; c < CITIES.length; c++) {
      var city = CITIES[c];
      cityCards += '<div class="city-card' + (city[3] ? ' hold' : '') + '">' +
        '<span class="c-phase">' + esc(city[0]) + '</span>' +
        '<h3>' + esc(city[1]) + '</h3><p>' + esc(city[2]) + '</p></div>';
    }
    var fwNodes = '';
    for (var f = 0; f < FLYWHEEL.length; f++) {
      var ang = (-90 + f * 60) * Math.PI / 180;
      var left = 50 + 42 * Math.cos(ang);
      var top = 50 + 42 * Math.sin(ang);
      fwNodes += '<div class="fw-node" style="left:' + left.toFixed(1) + '%;top:' + top.toFixed(1) + '%">' +
        '<b>' + FLYWHEEL[f][0] + '</b>' + esc(FLYWHEEL[f][1]) + '</div>';
    }
    var wingCards = '';
    for (var w = 0; w < WINGS.length; w++) {
      var wg = WINGS[w];
      var chips = '';
      for (var ci = 0; ci < wg[2].length; ci++) {
        chips += '<span class="wc-chip">' + esc(wg[2][ci]) + '</span>';
        if (ci < wg[2].length - 1) chips += '<span class="wc-arrow">→</span>';
      }
      wingCards += '<article class="card wing-card">' +
        '<span class="tk-tag">' + esc(wg[0]) + '</span>' +
        '<div class="wing-mode">' + esc(wg[1]) + '</div>' +
        '<div class="wing-chain">' + chips + '</div>' +
        '<p class="post-sum">' + esc(wg[3]) + '</p></article>';
    }

    appView.innerHTML =
      '<section class="page"><div class="wrap">' +
        pageHead('BATTLE MAP', '作战图谱',
          '扩张不是勇气问题，是数据批准问题。先看台账，再看地图——光是数据点亮的，铺之前，先验电压。') +
        '<h3 class="list-title">运动路线图</h3>' +
        '<div class="timeline">' + tl + '</div>' +
        '<div class="phase-motto" style="margin-top:16px">' + mottoHtml + '</div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">城市网络</h3>' +
        '<div class="city-grid">' + cityCards + '</div>' +
        '<p class="city-note">北京备注：v2 分区中北京归天津群承接（合规与成本最高）；若在北京开，预算×1.5、审批周期另加 1–2 个月。</p>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">社会化自动力飞轮</h3>' +
        '<p class="desc" style="margin-bottom:6px">燃料是荣誉，不是工资。六环首尾咬合：</p>' +
        '<div class="flywheel">' +
          '<div class="fw-ring" aria-hidden="true"></div>' +
          fwNodes +
          '<div class="fw-center">社会化<br>自动力</div>' +
        '</div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">三翼飞轮</h3>' +
        '<p class="desc" style="margin-bottom:10px">三翼各按各的燃料转：家长翼靠信任、校园翼靠资产、社会结构翼靠交换。只讲机制，不讲内部数值。</p>' +
        '<div class="grid grid-3">' + wingCards + '</div>' +
        '<div class="phase-motto wing-order"><b>[顺序纪律]</b> 第一棒 校园翼（2026 Q4–2027 Q1）→ 第二棒 家长翼（2027 寒假首战）→ 第三棒 社会结构翼（2027 起）——「先有信任的骨架，再长规模的肉」。</div>' +
        '<div class="rank-strip wing-gates">' +
          '<span class="rank-chip"><b>闸1</b>满班率</span><span class="rank-arrow">·</span>' +
          '<span class="rank-chip"><b>闸2</b>NPS</span><span class="rank-arrow">·</span>' +
          '<span class="rank-chip"><b>闸3</b>CAC 占比</span><span class="rank-arrow">·</span>' +
          '<span class="rank-chip"><b>闸4</b>转介绍</span>' +
        '</div>' +
        '<p class="dim-label">四道闸口 · 过闸才准扩城，一道不过全军待命</p>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">全国分区作战地图</h3>' +
        '<p class="desc">五大分区 · 首战 成都+杭州 · P1 广州+天津 · P2 西安+太原 · 暂缓 青岛。交通层与飞行轨迹为规划示意，非精确线路。</p>' +
        '<p class="map-embed-note">交互地图 · 可切图层 · 悬浮看分区 · 「倾斜视角」一秒立体感（纯 CSS，全设备可看）</p>' +
        '<div class="map-embed"><iframe id="map3d-frame" src="assets/map3d.html" title="全国分区作战地图"></iframe></div>' +
      '</div></section>';
  }

  /* ============================================================
   * 视图：#/camp 三轨营（三轨详卡 + 产品全景 + 亲带一年 + 红线 + 报名）
   * ============================================================ */

  var CAMP_TRACKS = [
    ['A', '兴趣', '初三 – 高一 · 5 天日营', '亲手造出你的第一只 AI 机器人'],
    ['B', '工程', '高二 – 大一 · 6 天', '从复刻到创造，只差一个寒假'],
    ['C', '落地', '大二 · 研究生 · 职场 · 6 天 + 4 周陪跑', '把一只鸭子，做成一门生意']
  ];

  var LADDER = [
    ['L0', 'Day 1', '跑通官方策略——「鸭子会走了」，15 秒录下来'],
    ['L1', 'Day 2–4', '自训走路策略：你自己的训练曲线和视频'],
    ['L2', 'Day 5–7', '自定义任务 · 改奖励——「我教会鸭子 X」'],
    ['L3', '营后 · 可选', '真机部署（真机视频）——真机门槛 ≈¥3500，主线 sim-only']
  ];

  var PRICE_TABLE = [
    ['免费公开课', '全人群', '¥0', '直播 + 回放 · 进私域池'],
    ['亲子共学营', '家长 + 孩子', '¥299–599', '7 天陪跑 · 共创任务 · 晒娃飞轮'],
    ['校园标准营', '大学生', '学生价 ¥299–599', 'L0–L2 全链路 · 助教 / 校园大使'],
    ['科研进阶营', '研究生', '¥599–999', '自定义任务 · 亲带线筛选池'],
    ['亲带一年（含 SCI 辅导）', '研究生 / 留学申请者', '万元级 · 可谈', '真实课题 + 论文辅导 + 推荐信（真实关系）'],
    ['世界入场券', '高意向家庭', '¥29,999', '营期 + 教授课×2 + 开源生态身份 + 90 天服务窗 + 续费低至官方价 20%'],
    ['讲师 / 合伙人', '电子科大本科生起步', '分成制', '授课 / 招生 / 运营 · 反哺全部业务']
  ];

  var M123 = [
    ['M1–3', '基础', '补课 + 定方向'],
    ['M4–9', '课题研究', '实验迭代 · 组会汇报'],
    ['M10–12', '论文', '写作 + 投稿辅导 · 真实科研经历 / SCI 辅助发表 / 教授亲笔推荐信']
  ];

  /* 社团 8 周课表（公开安全层 · 每周 90 分钟 · 每节课固定留下 1 条当堂产物） */
  var CAMP_WEEK = [
    ['W1', '拆箱与安全', '舵机逐个空转测试，先认识每一颗零件', '开箱照'],
    ['W2', '腿部装配', '五层零件盒逐层装配腿部', '装配照'],
    ['W3', '躯干总装', '腿 + 躯干合体，整机点亮', '整机照'],
    ['W4', '标定与站姿', '舵机中位与重心标定', '站立 15s 视频'],
    ['W5', '仿真跑通官方策略', '「鸭子会走了」——初啼时刻', '训练曲线 + 走路视频'],
    ['W6', '自训走路策略', '替换为你自己训练的策略', '两版曲线对比'],
    ['W7', '改奖励函数', '「我教会鸭子 X」自定义任务', '任务视频'],
    ['W8', '校内 Demo Day', '请家长与教务处来看路演', '结营海报']
  ];

  /* 家长看到的三报节律（全程微信群直达，零新软件） */
  var REPORT_ROWS = [
    ['每天 09:00', '晨报', '今日任务卡照片 + 一句今日目标'],
    ['每天 17:30', '日报三件套', '孩子的 15s 鸭子视频 + 当日训练曲线 + 三行排障日志'],
    ['每天 21:00', '晚报', '在宿登记确认 + 明日预告']
  ];

  function viewCamp() {
    var trackCards = '';
    for (var t = 0; t < CAMP_TRACKS.length; t++) {
      var tr = CAMP_TRACKS[t];
      trackCards +=
        '<article class="card track-card' + (tr[0] === 'B' ? ' hot' : '') + '">' +
          '<span class="tk-tag">TRACK ' + esc(tr[0]) + ' · ' + esc(tr[1]) + '</span>' +
          '<div class="tk-people">' + esc(tr[2]) + '</div>' +
          '<div class="tk-slogan">「' + esc(tr[3]) + '」</div>' +
          '<div class="ladder">';
      for (var l = 0; l < LADDER.length; l++) {
        trackCards += '<div class="ld"><b>' + esc(LADDER[l][0]) + '</b>' + esc(LADDER[l][1]) + '：' + esc(LADDER[l][2]) + '</div>';
      }
      trackCards += '</div></article>';
    }
    var priceRows = '';
    for (var p = 0; p < PRICE_TABLE.length; p++) {
      priceRows += '<tr><td>' + esc(PRICE_TABLE[p][0]) + '</td><td>' + esc(PRICE_TABLE[p][1]) + '</td>' +
        '<td class="p-price">' + esc(PRICE_TABLE[p][2]) + '</td><td>' + esc(PRICE_TABLE[p][3]) + '</td></tr>';
    }
    var m123 = '';
    for (var m = 0; m < M123.length; m++) {
      m123 += '<div class="mseg"><div class="m-when">' + esc(M123[m][0]) + '</div><h3>' + esc(M123[m][1]) + '</h3><p>' + esc(M123[m][2]) + '</p></div>';
    }
    var weekRows = '';
    for (var wk = 0; wk < CAMP_WEEK.length; wk++) {
      var cw = CAMP_WEEK[wk];
      weekRows += '<tr><td class="p-price">' + esc(cw[0]) + '</td><td><b>' + esc(cw[1]) + '</b></td>' +
        '<td>' + esc(cw[2]) + '</td><td>' + esc(cw[3]) + '</td></tr>';
    }
    var reportRows = '';
    for (var rp = 0; rp < REPORT_ROWS.length; rp++) {
      var rr = REPORT_ROWS[rp];
      reportRows += '<tr><td class="p-price">' + esc(rr[0]) + '</td><td><b>' + esc(rr[1]) + '</b></td><td>' + esc(rr[2]) + '</td></tr>';
    }

    appView.innerHTML =
      '<section class="page"><div class="wrap">' +
        pageHead('THREE TRACKS', '三轨营',
          '兴趣点火、工程成型、落地上路。任务阶梯 L0–L3 全线贯通：跑通 → 自训 → 自定义 → 真机可选。') +
        '<div class="grid grid-3">' + trackCards + '</div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">产品全景表</h3>' +
        '<div class="card table-card"><div class="table-wrap"><table class="price-table">' +
          '<thead><tr><th>产品</th><th>人群</th><th>价格</th><th>交付</th></tr></thead>' +
          '<tbody>' + priceRows + '</tbody></table></div></div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">社团 8 周课表</h3>' +
        '<p class="desc" style="margin-bottom:10px">每周 90 分钟，一学期把一只鸭从零件盒走到 Demo Day。每节课固定留下 1 条当堂产物——产物即档案。</p>' +
        '<div class="card table-card"><div class="table-wrap"><table class="price-table" id="camp-week-table">' +
          '<thead><tr><th>周</th><th>课</th><th>内容</th><th>当堂产物</th></tr></thead>' +
          '<tbody>' + weekRows + '</tbody></table></div></div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">家长看到的成长档案</h3>' +
        '<p class="desc" style="margin-bottom:10px">三报节律 + 周五直播 + 结营成长册，全程微信群直达、零新软件——翻群即翻档案。</p>' +
        '<div class="card table-card"><div class="table-wrap"><table class="price-table" id="report-table">' +
          '<thead><tr><th>时点</th><th>报</th><th>内容（实物）</th></tr></thead>' +
          '<tbody>' + reportRows + '</tbody></table></div></div>' +
        '<div class="report-extra">' +
          '<div class="rx-item"><b>每周五 19:00 · 鸭子时刻</b>15 分钟学员群直播：本周最佳鸭子巡游 + 下周预告。</div>' +
          '<div class="rx-item"><b>结营 48h · 成长册</b>网页链接直达：时间线 + 全部视频 + 段位事件 + 讲师总评，可转发。</div>' +
        '</div>' +
        '<p class="city-note">家长视角只有一件事：孩子的变化看得见。晨报 / 日报 / 晚报 + 可转发的成长册，就是「信任」两个字的实物形态。</p>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">结营后的助教通道</h3>' +
        '<div class="card ta-card">' +
          '<span class="tk-tag">TA CHANNEL</span>' +
          '<p class="post-sum" style="margin-top:8px">结营当天宣布助教标准：<b>出勤 100% + 作品达标 + 15 分钟面试</b>——命中即入助教池，每期约 20%。下一座新城开营时，助教就从这里出。</p>' +
          '<p class="ta-quote">「今天社团里的大二学生，四年后就是新课市的助教与主讲。」</p>' +
        '</div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">亲带一年 · 三段</h3>' +
        '<div class="m123">' + m123 + '</div>' +
        '<div class="dim-line"></div>' +
        '<div class="seal-block">' +
          '<span class="seal-stamp">红线</span>' +
          '<h3>五不四真 · 学术红线</h3>' +
          '<ul>' +
            '<li>不卖推荐信</li><li>不虚构经历</li><li>不代写挂名</li><li>不承诺结果</li><li>不夸大未成年</li>' +
          '</ul>' +
          '<div class="truth-row"><span class="tr">真实亲带</span><span class="tr">真实课题</span><span class="tr">真实署名</span><span class="tr">广告只讲过程</span></div>' +
          '<p class="post-sum" style="margin-top:10px">招生官严查付费推荐信——真实亲带既是合规底线，也是最强卖点。</p>' +
        '</div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title" id="camp-form-head">报名三轨营</h3>' +
        '<p class="desc" style="margin-bottom:14px">提交后由首战城团队 48 小时内联系；也可先做<a href="#/test">段位测试</a>再决定轨道。</p>' +
        '<form id="camp-form" class="card form-card" novalidate>' +
          '<div class="frow">' +
            fld('昵称', inText('cf-nickname', 'nickname', '怎么称呼你', ' maxlength="24"'), { id: 'cf-nickname', required: true }) +
            fld('身份 / 学段', inText('cf-identity', 'identity', '初三 / 高二 / 大一 / 研一 / 职场……', ' maxlength="32"'), { id: 'cf-identity', required: true }) +
          '</div>' +
          '<div class="frow">' +
            fld('城市', inText('cf-city', 'city', '成都 / 杭州 / 广州……', ' maxlength="24"'), { id: 'cf-city', required: true }) +
            fld('微信号', inText('cf-wechat', 'wechat', '用于建群联系', ' maxlength="40"'), { id: 'cf-wechat', required: true, hint: '仅首战城团队可见，用于联系开营' }) +
          '</div>' +
          '<div class="field">' +
            '<label for="cf-track">意向轨<em>*</em></label>' +
            inSelect('cf-track', 'track', [
              ['A', 'A 轨 · 兴趣（初三–高一 · 5 天日营）'],
              ['B', 'B 轨 · 工程（高二–大一 · 6 天）'],
              ['C', 'C 轨 · 落地（大二/研究生/职场 · 6 天+4 周陪跑）'],
              ['test', '先做段位测试，再定轨道']
            ], '请选择意向轨') +
            '<div class="err-msg"></div>' +
          '</div>' +
          '<div class="field">' +
            '<label for="cf-motive">一句话动机</label>' +
            '<textarea id="cf-motive" name="motive" placeholder="你想教会鸭子什么？或：你想通过这只鸭子做成什么？" maxlength="200"></textarea>' +
            '<div class="err-msg"></div>' +
          '</div>' +
          '<button type="submit" class="btn btn-primary btn-block">提交报名</button>' +
        '</form>' +
      '</div></section>';

    var form = document.getElementById('camp-form');
    bindLiveClear(form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = validate(form, [
        { name: 'nickname', label: '昵称' },
        { name: 'identity', label: '身份 / 学段' },
        { name: 'city', label: '城市' },
        { name: 'wechat', label: '微信号' },
        { name: 'track', label: '意向轨' }
      ]);
      if (!data) return;
      data.motive = String(form.elements.motive.value || '').trim();
      var btn = form.querySelector('button[type="submit"]');
      btn.disabled = true;
      Api.submitCampApp(data).then(function () {
        if (!form.parentNode) return;
        var okCard = document.createElement('div');
        okCard.className = 'card form-card ok-card';
        okCard.innerHTML =
          '<div class="ok-mark">√</div>' +
          '<h3>报名意向已收到，首战城团队 48 小时内联系你</h3>' +
          '<p class="post-sum">开营前你还会收到：零件盒清单、试运行日邀请、家长知情同意书。</p>' +
          '<ul class="covenant"><li>先跑起来</li><li>亲手做成</li><li>留下证据</li></ul>';
        form.parentNode.replaceChild(okCard, form);
        window.scrollTo(0, 0);
      }).catch(function () {
        btn.disabled = false;
        toast('提交失败，请稍后重试');
      });
    });
  }

  /* ============================================================
   * 视图：#/open 开源内核
   * ============================================================ */

  function viewOpen() {
    appView.innerHTML =
      '<section class="page"><div class="wrap">' +
        pageHead('OPEN CORE', '开源内核',
          '社区即课程、贡献即成长。图纸 / 代码 / 课程 / 账本全开源，clone 即拿走整套造物能力——fork 不是拥有，clone 下来改完第一行，才算开始。') +
        '<div class="grid grid-2">' +
          '<div class="card repo-card">' +
            '<div class="rc-name">GitHub · 全球主仓</div>' +
            '<div class="rc-desc">复刻仓库 fanhao375/microduck-replica：飞特 HD-1910 舵机实机验证，教学供应链底座。官方上游 19 个 Rust crate / 9 个 ONNX 策略 / 942 项测试全开源。</div>' +
          '</div>' +
          '<div class="card repo-card">' +
            '<div class="rc-name">Gitee · 国内加速</div>' +
            '<div class="rc-desc">与 GitHub 同源镜像，国内 clone 不出墙；月度发版当节拍器，changelog 署名每一位贡献者。</div>' +
          '</div>' +
        '</div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">贡献四步闭环</h3>' +
        '<div class="loop-steps">' +
          '<div class="loop-step"><div class="loop-no">1</div><div><h3>认领 good-first-issue</h3><p>从文档翻译、测试补全到任务魔改，总有一张牌桌缺人。</p></div></div>' +
          '<div class="loop-step"><div class="loop-no">2</div><div><h3>提交 PR（代码 / 文档 / 翻译）</h3><p>「你不留痕迹，只可能因为你什么都没提交。」</p></div></div>' +
          '<div class="loop-step"><div class="loop-no">3</div><div><h3>评审合入 · Committer 48h 响应</h3><p>悬置的评审比拒绝更伤人——48 小时是内核社区的铁律。</p></div></div>' +
          '<div class="loop-step"><div class="loop-no">4</div><div><h3>月度发版 · changelog 署名</h3><p>你的 GitHub ID 进入发版记录——简历可以修饰，提交历史不会。</p></div></div>' +
        '</div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">声望闭环</h3>' +
        '<div class="slot-flow">' +
          '<div class="slot-node"><h3>公开记录</h3><p>个人主页公开记录每一次贡献</p></div>' +
          '<div class="slot-node"><h3>Committer</h3><p>3 次优质合入晋升 Committer</p></div>' +
          '<div class="slot-node"><h3>PMC</h3><p>进入 PMC 参与路线决策</p></div>' +
          '<div class="slot-node"><h3>反哺新人</h3><p>评审与带教，社区自生长</p></div>' +
        '</div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">三级徽章</h3>' +
        '<div class="rank-strip">' +
          '<span class="rank-chip"><b>I</b>复刻者 · 参与</span><span class="rank-arrow">→</span>' +
          '<span class="rank-chip"><b>II</b>魔改师 · 魔改创意</span><span class="rank-arrow">→</span>' +
          '<span class="rank-chip"><b>III</b>原创者 · 孵化作品</span>' +
        '</div>' +
        '<div class="dim-line"></div>' +
        '<div class="lic-note"><b>Apache-2.0</b>（软件 / 训练配方）：可商用，教学安全。<br><b>CC BY-SA-NC</b>（结构 STL / MJCF 网格）：署名-相同方式共享-非商业，硬件商业化需另行授权；PCB 原理图与 BOM 不公开。</div>' +
      '</div></section>';
  }

  /* ============================================================
   * 视图：#/pledge 十方共赢
   * ============================================================ */

  var SWAP_TABLE = [
    ['学员', '时间与专注', '段位资产 + 作品 + 真机能力 + 简历素材', '成长被永久记录：段位终身有效'],
    ['家长', '学费 + 信任', '孩子的可见成长 + 安全交付 + 亲子素材', '变化看得见：档案与视频每期可晒'],
    ['高校', '学分 / 教室 / 名义', '微专业成果 + 就业数据 + 科研数据集 + 实践基地牌', '教育改革 KPI 与科研产出'],
    ['研究生助教', '时间', '报酬 + 数据集 + 论文署名', '论文与就业双收'],
    ['头部机构', '场地 / 人员 / 招生资源', '具身智能新品类 + 高客单产品线 + 分成', '利润与「科技教育」新故事'],
    ['小机构', '授权费', '高阶课程能力（RL / 仿真）', '生存升级，不必自研'],
    ['企业', '赞助 / ESG 投入', '人才池优先权 + 品牌曝光 + ESG 素材', '招聘与报告一次解决'],
    ['科协 / 官方', '背书', '科普业绩数据 + 教育公平案例', '可汇报的政绩'],
    ['开源社区', '代码 / 文档贡献', '声望 + 上游署名 + 职业机会', '公开可查的职业资产'],
    ['我们（发起方）', '课程 / 工程师 / 品牌 / 标准', '现金流 + 网络 + 数据 + 行业标准席位', '五类复利资产逐期变厚']
  ];

  var NEVERS = [
    '永不挪用预收款 —— 30% 押金池不动，它是「随时全额退」这句话的抵押物',
    '永不让渡课程与认证主权 —— 标准在我们手里，牌子才值钱',
    '永不取消公益名额 —— 每期收益的固定比例进乡村专场'
  ];

  function viewVision() {
    var tri = [
      ['时代的问题', '就业难 × AI 冲击', '市场就业困难，AI 正在冲击就业——这是社会化问题，不是某一代人的问题。'],
      ['我们的愿景', '世界一流产研中心', '把专业知识与产业结合起来，形成一个产学研真正结合的中心。'],
      ['切入点', '具身智能前沿', '黄仁勋在 GTC 大会展示的 MicroDuck——把一台开源机械鸭的完整复刻权交给每一个人。']
    ];
    var fly = [
      ['机构', '联培 · 分红 · 协议约束', '与培训机构、企业以联培、分红、协议约束达成一致合作；后期我们掌握资格证书考核权，向有资质的机构与企业授权课程包，配名牌讲师合作共赢。', '培训机构 · 企业'],
      ['家长', '成为传播的一环', '大学毕业工作不好找，家长恰恰能给孩子提供相关的资源信息——家长不是流量，是孩子身边最可信的传播节点。', '每一位家长'],
      ['学校', '联培 · 微专业', '以联培模式与高校共建，开设微专业，把专业知识与产业结合起来，合力解决当下时代面临的社会问题。', '高校 · 职业院校'],
      ['个人', '共同分红', '有潜力有兴趣的同学、有能力承担讲师业务的专业人员——我们愿意与您共同分红，享受发展的红利。', '同学 · 专业人员']
    ];
    var triHtml = '';
    var flyHtml = '';
    var i;
    for (i = 0; i < tri.length; i++) {
      triHtml += '<div class="card"><div class="v-tag">' + esc(tri[i][0]) + '</div><h3>' + esc(tri[i][1]) + '</h3><p>' + esc(tri[i][2]) + '</p></div>';
    }
    for (i = 0; i < fly.length; i++) {
      flyHtml += '<div class="card"><div class="v-tag">' + esc(fly[i][0]) + '</div><h3>' + esc(fly[i][1]) + '</h3><p>' + esc(fly[i][2]) + '</p><div class="v-who">适合：' + esc(fly[i][3]) + '</div></div>';
    }
    appView.innerHTML =
      '<section class="page"><div class="wrap">' +
        pageHead('FOUNDING MEMO', '愿景与合作', '这份筹备计划书是 MicroDuck复刻营的起点。我们构建的是一套新体系，回应一个社会化问题：市场就业困难，AI 冲击就业。') +
        '<div class="v-grid3">' + triHtml + '</div>' +
        '<div class="dim-line"></div>' +
        '<div class="seal-block"><span class="seal-stamp">目标</span>' +
          '<h3>一个夏令营，一份可带走的证明</h3>' +
          '<ul>' +
            '<li>形成社会自发动机：面向兴趣浓厚的初高中生筛选放开一部分名额；面向大学生、研究生乃至任何对具身智能感兴趣的社会成员。</li>' +
            '<li>经过一个夏令营的时间，让大家产生可带走的证明、从零到一的经验。</li>' +
            '<li>减轻社会中再就职、转型压力，减轻大学生就业压力。</li>' +
            '<li>提前为国家为社会培养一批前沿领域的接班人。</li>' +
          '</ul>' +
        '</div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">闭环飞轮 · 四路合作</h3>' +
        '<div class="v-grid2">' + flyHtml + '</div>' +
        '<div class="dim-line"></div>' +
        '<div class="seal-block"><span class="seal-stamp">档案</span>' +
          '<h3>筹备计划书 · 创始原文（节选）</h3>' +
          '<p class="v-quote">「我们的愿景是构建世界一流产研中心，把专业知识与产业结合起来形成一个产学研真正结合中心。我们的起始切入点是具身智能前沿，黄仁勋 GTC 大会上展示的 MicroDuck。我们的目标是形成社会自发动机，面向兴趣浓厚的初高中生筛选放开一部分名额……希望经过一个夏令营的时间，让大家产生可带走的证明、从零到一的经验，减轻社会中再就职、转型压力，……提前为国家为社会培养一批……接班人。」</p>' +
        '</div>' +
        '<div class="btn-row">' +
          '<a class="btn btn-main" href="#/camp">报名三轨营</a>' +
          '<a class="btn btn-ghost" href="#/pledge">十方共赢契约表</a>' +
          '<a class="btn btn-ghost" href="#/open">开源内核</a>' +
        '</div>' +
      '</div></section>';
  }

  function viewPledge() {
    var rows = '';
    for (var i = 0; i < SWAP_TABLE.length; i++) {
      rows += '<tr><td>' + esc(SWAP_TABLE[i][0]) + '</td><td>' + esc(SWAP_TABLE[i][1]) + '</td>' +
        '<td>' + esc(SWAP_TABLE[i][2]) + '</td><td>' + esc(SWAP_TABLE[i][3]) + '</td></tr>';
    }
    var nevers = '';
    for (var n = 0; n < NEVERS.length; n++) nevers += '<li>' + esc(NEVERS[n]) + '</li>';

    appView.innerHTML =
      '<section class="page"><div class="wrap">' +
        pageHead('WIN-WIN CONTRACT', '十方共赢',
          '每一方都先赢，我们才进场。合法性不能求，只能换——这张契约表就是全部交换结构。') +
        '<div class="card table-card"><div class="table-wrap"><table class="swap-table">' +
          '<thead><tr><th>参与方</th><th>付出</th><th>得到</th><th>共赢锚点</th></tr></thead>' +
          '<tbody>' + rows + '</tbody></table></div></div>' +
        '<div class="dim-line"></div>' +
        '<div class="seal-block">' +
          '<span class="seal-stamp">章程</span>' +
          '<h3>三条永不（写进章程，总舵也不能破）</h3>' +
          '<ul>' + nevers + '</ul>' +
        '</div>' +
        '<div class="dim-line"></div>' +
        '<h3 class="list-title">教育宣言</h3>' +
        '<div class="manifesto">' +
          '<div class="mani-card"><div class="mi-no">PRINCIPLE 01</div><h3>证据先于自信</h3><p>自信不是喊出来的，是做完一件难事之后长出来的。</p></div>' +
          '<div class="mani-card"><div class="mi-no">PRINCIPLE 02</div><h3>身份先于坚持</h3><p>「我是造物者」的身份认同，比任何打卡机制都持久。</p></div>' +
          '<div class="mani-card"><div class="mi-no">PRINCIPLE 03</div><h3>同伴先于老师</h3><p>同一个零件盒前坐过的人，是最好的老师。</p></div>' +
        '</div>' +
      '</div></section>';
  }

  /* ============================================================
   * 视图：#/activities 活动（沿用列表/报名/过期灰显逻辑）
   * ============================================================ */

  function rhythmStrip() {
    var items = [
      ['每周六 14:00 · 体验课', '#F2A93B'],
      ['每月 · Demo Day 路演夜', '#C0392B'],
      ['2027 寒 · 双城首战仿真赛', '#24466B'],
      ['每年 1 月首战日 · 造物者节', '#8A5A2B']
    ];
    var h = '<div class="rhythm-strip">';
    for (var i = 0; i < items.length; i++) {
      h += '<span class="rhythm-item" style="--rc:' + items[i][1] + '"><i aria-hidden="true"></i>' + items[i][0] + '</span>';
    }
    return h + '</div>';
  }

  function actCard(a) {
    var d = parseWhen(a.startsAt);
    var past = isPast(a.startsAt);
    var color = typeColor(a.type);
    var cap = Number(a.capacity) || 0;
    var taken = Number(a.taken) || 0;
    var remain = Math.max(0, cap - taken);
    var foot;
    if (past) {
      foot = '<div class="act-foot"><span class="past-tag">已结束 · 纪要整理中</span></div>';
    } else if (remain <= 0) {
      foot = '<div class="act-foot"><span class="slot full">已满员（<b>0</b> / ' + cap + ' 席）</span>' +
             '<button type="button" class="btn btn-ghost btn-sm" disabled>报名已满</button></div>';
    } else {
      foot =
        '<div class="act-foot">' +
          '<span class="slot">剩余 <b>' + remain + '</b> / ' + cap + ' 席</span>' +
          '<button type="button" class="btn btn-ghost btn-sm" data-rsvp="' + esc(a.id) + '">报名</button>' +
        '</div>' +
        '<div class="rsvp-form" id="rsvp-' + esc(a.id) + '">' +
          '<div class="frow">' +
            fld('昵称', inText('rv-n-' + esc(a.id), 'nickname', '怎么称呼你', ' maxlength="24"'), { id: 'rv-n-' + esc(a.id), required: true }) +
            fld('微信号', inText('rv-w-' + esc(a.id), 'wechat', '用于拉群邀请', ' maxlength="40"'), { id: 'rv-w-' + esc(a.id), required: true }) +
          '</div>' +
          '<button type="button" class="btn btn-primary btn-sm btn-block" data-rsvp-submit="' + esc(a.id) + '">提交报名</button>' +
        '</div>';
    }
    return (
      '<article class="card act-card' + (past ? ' past' : '') + '">' +
        '<div class="act-head">' +
          (d ? '<div class="date-badge"><div class="d1">' + fmtBadgeDate(d) + '</div><div class="d2">' + fmtBadgeWeek(d) + '</div></div>' : '') +
          '<div class="act-main">' +
            '<div class="act-type"><i style="background:' + color + '" aria-hidden="true"></i>' + esc(a.type || '') + '</div>' +
            '<h3 class="act-title">' + esc(a.title || '') + '</h3>' +
            '<div class="act-meta">主理：' + esc(a.speaker || '待定') + '</div>' +
            (a.desc ? '<p class="act-desc">' + esc(a.desc) + '</p>' : '') +
          '</div>' +
        '</div>' +
        foot +
      '</article>'
    );
  }

  function viewActivities() {
    appView.innerHTML =
      '<section class="page"><div class="wrap">' +
        pageHead('EVENTS', '活动',
          '体验课与赛事都有线上环节，错过有纪要。点「报名」留下联系方式，开场链接在群里发。') +
        rhythmStrip() +
        '<div id="act-list"><p class="empty">正在加载…</p></div>' +
      '</div></section>';
    Api.listActivities().then(function (list) {
      if (routeKey(parseRoute()) !== 'activities') return;
      var host = document.getElementById('act-list');
      if (!host) return;
      var sorted = (list || []).slice().sort(function (x, y) {
        return new Date(x.startsAt) - new Date(y.startsAt);
      });
      if (!sorted.length) {
        host.innerHTML = '<p class="empty">最近没有排期。先去做一份<a href="#/test">段位测试</a>，开营第一时间叫你。</p>';
        return;
      }
      var h = '';
      for (var i = 0; i < sorted.length; i++) h += actCard(sorted[i]);
      host.innerHTML = h;
      bindActivities();
    }).catch(function () {
      var host = document.getElementById('act-list');
      if (host) host.innerHTML = '<p class="empty">活动加载失败，请刷新重试。</p>';
    });
  }

  function bindActivities() {
    var host = document.getElementById('act-list');
    if (!host) return;
    bindLiveClear(host);

    var btns = host.querySelectorAll('[data-rsvp]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        var id = this.getAttribute('data-rsvp');
        var panel = document.getElementById('rsvp-' + id);
        if (!panel) return;
        var wasOpen = panel.classList.contains('open');
        var all = host.querySelectorAll('.rsvp-form.open');
        for (var j = 0; j < all.length; j++) all[j].classList.remove('open');
        if (!wasOpen) panel.classList.add('open');
      });
    }

    var subs = host.querySelectorAll('[data-rsvp-submit]');
    for (var k = 0; k < subs.length; k++) {
      subs[k].addEventListener('click', function () {
        var id = this.getAttribute('data-rsvp-submit');
        var panel = document.getElementById('rsvp-' + id);
        if (!panel) return;
        var nick = panel.querySelector('input[name="nickname"]');
        var wx = panel.querySelector('input[name="wechat"]');
        var ok = true;
        if (!filled(nick.value)) { invalidate(nick, '请填写昵称'); ok = false; }
        if (!filled(wx.value)) { invalidate(wx, '请填写微信号'); ok = false; }
        if (!ok) return;
        this.disabled = true;
        var self = this;
        Api.rsvp(id, { nickname: nick.value.trim(), wechat: wx.value.trim() }).then(function (res) {
          if (res && res.ok === false) {
            self.disabled = false;
            toast(res.msg || '报名失败，请稍后重试');
            return;
          }
          toast('已报名，开场链接在群里发');
          if (routeKey(parseRoute()) === 'activities') viewActivities();
        }).catch(function () {
          self.disabled = false;
          toast('报名失败，请稍后重试');
        });
      });
    }
  }

  /* ============================================================
   * 视图：#/library 内容库（book / log / eng / pledge 四栏目）
   * ============================================================ */

  function libraryTabs() {
    var h = '<div class="tabs" id="lib-tabs">';
    for (var i = 0; i < COLS.length; i++) {
      var t = COLS[i];
      h += '<button type="button" class="tab' + (t.key === libTab ? ' active' : '') + '" data-track="' + t.key + '">' + t.name + '</button>';
    }
    return h + '</div>';
  }

  function postCard(p) {
    var t = colOf(p.track);
    return (
      '<a class="card post-card" href="#/library/' + encodeURIComponent(p.id) + '">' +
        '<div class="post-head"><i class="dot" style="background:' + t.color + '" aria-hidden="true"></i><span>' + esc(t.name) + '</span></div>' +
        '<div class="post-title">' + esc(p.title || '') + '</div>' +
        '<div class="post-meta">' + esc(p.author || '') + ' · ' + esc(String(p.date || '').slice(0, 10)) + '</div>' +
        (p.summary ? '<p class="post-sum">' + esc(p.summary) + '</p>' : '') +
      '</a>'
    );
  }

  function paintLibList(all) {
    var host = document.getElementById('lib-list');
    if (!host) return;
    var src = all || [];
    var h = '';
    var n = 0;
    for (var i = 0; i < src.length; i++) {
      if (src[i].track === libTab) { h += postCard(src[i]); n++; }
    }
    if (!n) h = '<p class="empty">这个栏目还没有内容，稍后再来看看。</p>';
    host.innerHTML = h;
  }

  function viewLibrary() {
    appView.innerHTML =
      '<section class="page"><div class="wrap">' +
        pageHead('LIBRARY', '内容库',
          '连载、日志、白皮书与信任公告，按栏目归档，点开即读。') +
        '<div class="ops-banner">' +
          '<span class="ob-tag">活动预告</span>' +
          '<span class="ob-txt">双城首战 · 仿真赛 No.1（2027 寒 · 成都 + 杭州）——一台笔记本即可参赛，现已开放报名意向。</span>' +
          '<a href="#/activities">去报名 →</a>' +
        '</div>' +
        libraryTabs() +
        '<div id="lib-list"><p class="empty">正在加载…</p></div>' +
      '</div></section>';

    var currentPosts = null;
    document.getElementById('lib-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-track]') : null;
      if (!btn) return;
      libTab = btn.getAttribute('data-track');
      var all = document.querySelectorAll('#lib-tabs .tab');
      for (var i = 0; i < all.length; i++) {
        if (all[i] === btn) all[i].classList.add('active');
        else all[i].classList.remove('active');
      }
      paintLibList(currentPosts);
    });

    Api.listPosts().then(function (list) {
      if (routeKey(parseRoute()) !== 'library') return;
      currentPosts = list || [];
      paintLibList(currentPosts);
    }).catch(function () {
      var host = document.getElementById('lib-list');
      if (host) host.innerHTML = '<p class="empty">内容加载失败，请刷新重试。</p>';
    });
  }

  /* ---------- #/library/:id 文章详情 ---------- */

  /* 正文渲染：空行分段；「- 」开头的连续行渲染为列表；段内换行转 <br> */
  function renderArticleBody(body) {
    var out = '';
    var paras = String(body || '').split(/\n\s*\n/);
    for (var i = 0; i < paras.length; i++) {
      var lines = String(paras[i]).split('\n');
      var pBuf = [];
      var lBuf = [];
      for (var j = 0; j <= lines.length; j++) {
        var line = j < lines.length ? lines[j] : null;
        var isItem = line != null && line.replace(/^\s+|\s+$/g, '').indexOf('- ') === 0;
        if (isItem) {
          if (pBuf.length) {
            out += '<p>' + esc(pBuf.join('\n')).replace(/\n/g, '<br>') + '</p>';
            pBuf = [];
          }
          lBuf.push(line.replace(/^\s*-\s*/, ''));
        } else {
          if (line != null && line.replace(/^\s+|\s+$/g, '') !== '') pBuf.push(line);
          if (lBuf.length) {
            out += '<ul>';
            for (var m = 0; m < lBuf.length; m++) out += '<li>' + esc(lBuf[m]) + '</li>';
            out += '</ul>';
            lBuf = [];
          }
        }
      }
      if (pBuf.length) {
        out += '<p>' + esc(pBuf.join('\n')).replace(/\n/g, '<br>') + '</p>';
      }
    }
    return out;
  }

  function viewPost(id) {
    appView.innerHTML =
      '<section class="page"><div class="wrap">' +
        '<a class="back-link" href="#/library">← 返回内容库</a>' +
        '<div id="post-body"><p class="empty">正在加载…</p></div>' +
      '</div></section>';
    Api.getPost(id).then(function (p) {
      if (routeKey(parseRoute()) !== 'post:' + id) return;
      var host = document.getElementById('post-body');
      if (!host) return;
      if (!p) {
        host.innerHTML = '<div class="card notfound"><h3>内容不存在或已下架</h3><p class="post-sum">它可能已被移动或删除。</p></div>';
        return;
      }
      var t = colOf(p.track);
      host.innerHTML =
        '<article class="article">' +
          '<div class="post-head"><i class="dot" style="background:' + t.color + '" aria-hidden="true"></i><span>' + esc(t.name) + '</span></div>' +
          '<h1 class="article-title">' + esc(p.title || '') + '</h1>' +
          '<div class="article-meta">' + esc(p.author || '') + ' · ' + esc(String(p.date || '').slice(0, 10)) + '</div>' +
          '<div class="article-body">' + renderArticleBody(p.body) + '</div>' +
        '</article>';
    }).catch(function () {
      var host = document.getElementById('post-body');
      if (host) host.innerHTML = '<p class="empty">加载失败，请刷新重试。</p>';
    });
  }

  /* ============================================================
   * 视图：#/admin 管理指南
   * ============================================================ */

  var ADMIN_GUIDE = [
    ['applications', '旧社群申请（已停用）',
      'v2 社群申请表，已被 camp_applications 取代。表保留不删，anon 仅可插入、不可读；历史数据仍在库中可查。'],
    ['camp_applications', '营报名',
      '三轨营报名：nickname / identity / city / wechat / track（A / B / C / test）/ motive。status 流转：new 新报名 → contacted 已联系 → converted 已转化。需先执行 sql/v3-migration.sql 建表。'],
    ['survey_responses', '测试答卷',
      '段位测试 v1.1.0 全量答案（answers jsonb）+ 派生标签（tags）+ duck_id + contact（X1 选填）。仅可写入不可读，分层与邀约在 Studio 内导出。'],
    ['activities', '活动排期',
      '新增场次：starts_at 开场时间、slot 场次类型（体验课 / 仿真赛 / Demo Day / 造物者节）、title 主题、host 主理、descr 简介、capacity 名额。'],
    ['rsvps', '报名记录',
      '每场活动的报名名单（昵称 + 微信号），同一微信号同一场只记一次；删活动连带删报名。匿名端无任何直读权限。'],
    ['posts', '内容库',
      'track 栏目取值：book 一人一鸭·连载 / log 复刻者日志 / eng 工程白皮书 / pledge 信任公告。title 唯一；正文空行分段，以「- 」开头的行渲染为列表。']
  ];

  function viewAdmin() {
    var rows = '';
    for (var i = 0; i < ADMIN_GUIDE.length; i++) {
      rows +=
        '<tr>' +
          '<td class="mono">' + ADMIN_GUIDE[i][0] + '</td>' +
          '<td>' + ADMIN_GUIDE[i][1] + '</td>' +
          '<td class="q-col">' + ADMIN_GUIDE[i][2] + '</td>' +
        '</tr>';
    }
    appView.innerHTML =
      '<section class="page"><div class="wrap">' +
        pageHead('BACKSTAGE', '管理指南',
          '数据托管在 Supabase（免费额度）。所有管理在 Supabase Studio 的 Table Editor 里完成；v3 新表需先在 SQL Editor 执行一次 sql/v3-migration.sql。') +
        '<p class="admin-tip">隐私提醒：报名者与答卷者的微信号仅用于开营与邀约联系，请勿外传；数据库已限制匿名端只能写入、不能读取申请表与答卷。</p>' +
        '<div class="grid grid-2">' +
          '<div class="card">' +
            '<h3 class="form-title">第一步 · 打开 Supabase Studio</h3>' +
            '<p class="post-sum">登录 <a class="ext" href="' + SUPABASE_DASH + '" target="_blank" rel="noopener">supabase.com/dashboard</a>' +
            ' 进入你的项目，左侧栏打开「Table Editor」。v3 首次部署先在「SQL Editor」整段执行 <span class="mono">sql/v3-migration.sql</span>' +
            '（新建 survey_responses / camp_applications 两张表并插入新种子，不动既有表结构）；' +
            '项目 url 与 anon key 已填入 <span class="mono">assets/config.js</span>，站点即从演示模式切到正式模式。</p>' +
          '</div>' +
          '<div class="card">' +
            '<h3 class="form-title">第二步 · 日常管理</h3>' +
            '<p class="post-sum">下面这张对照表就是全部后台：营报名与测试答卷实时落库，活动与内容在 activities / posts 里增改，' +
            '保存即刻生效，前台刷新即可看到。防重复报名与名额校验由数据库自动完成，无需人工核对。</p>' +
          '</div>' +
        '</div>' +
        '<h3 class="list-title">表 · 功能对照</h3>' +
        '<div class="card table-card"><div class="table-wrap">' +
          '<table class="admin">' +
            '<thead><tr><th>表</th><th>管什么</th><th>说明</th></tr></thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div></div>' +
      '</div></section>';
  }

  /* ============ 视图：404 ============ */

  function view404() {
    appView.innerHTML =
      '<section class="page"><div class="wrap">' +
        '<div class="card notfound">' +
          '<h3>这一页还在图纸上</h3>' +
          '<p class="post-sum">地址可能打错了。</p>' +
          '<p class="nf-cta"><a class="btn btn-ghost btn-sm" href="#/">回到首页</a></p>' +
        '</div>' +
      '</div></section>';
  }

  /* ============ 启动 ============ */

  function init() {
    appView = document.getElementById('app-view');
    mainEl = document.querySelector('main');
    if (!appView || !mainEl || !Api || !Q) return;

    if (!document.getElementById('toast-box')) {
      var box = document.createElement('div');
      box.id = 'toast-box';
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
    }
    if (IS_DEMO && !document.getElementById('demo-badge')) {
      var b = document.createElement('div');
      b.id = 'demo-badge';
      b.className = 'demo-badge';
      b.textContent = '演示模式 · 数据仅存本机';
      document.body.appendChild(b);
    }

    window.addEventListener('hashchange', onHashChange);
    render();
  }

  init();
})();
