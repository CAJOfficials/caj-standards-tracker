/* Standards Comparison — side-by-side gap analysis with personal time entry.
   Data: window.SWIM_STANDARDS (standards.js) */
(function () {
  'use strict';

  var DATA = window.SWIM_STANDARDS || [];

  var LEVELS = [
    { key: 'Regional', label: 'Regional', short: 'Regionals', sub: 'Western Region Champs', tier: 'Regional',   color: '#4a90c2' },
    { key: 'OAG',      label: 'OAG',      short: 'OAG',       sub: 'Ontario Age Groups',    tier: 'Provincial', color: '#1e6aa8' },
    { key: 'OSC',      label: 'OSC',      short: 'OSC',       sub: 'Ontario Championships', tier: 'Provincial', color: '#003b7a' }
  ];

  var LV = {};
  LEVELS.forEach(function (l, i) { LV[l.key] = l; l.order = i; });

  var AGE_ORDER = ['10 & Under', '11 & Under', '11', '12', '13', '14', '15', '16', '17 & Over', 'Open'];
  var STROKE_ORDER = ['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Individual Medley'];

  var $ = function (id) { return document.getElementById(id); };
  var myTime = null;            // seconds, or null
  var NARROW = 700;                              // px — below this we treat it as a phone
  function isNarrow() { return window.innerWidth < NARROW; }
  var chartMode = isNarrow() ? 'scale' : 'bars';  // vertical on phones, horizontal on desktop
  var modeChosen = false;                         // true once the user picks a view themselves

  /* ---------------------------------------------------- helpers */
  function fmt(s) {
    if (s == null) return '—';
    var m = Math.floor(s / 60), r = s - m * 60;
    var rs = r.toFixed(2);
    if (r < 10) rs = '0' + rs;
    return m ? m + ':' + rs : r.toFixed(2);
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function uniq(a) { return a.filter(function (v, i) { return a.indexOf(v) === i; }); }
  function byOrder(list) {
    return function (a, b) {
      var ia = list.indexOf(a), ib = list.indexOf(b);
      if (ia < 0) ia = 999; if (ib < 0) ib = 999;
      return ia - ib || String(a).localeCompare(String(b));
    };
  }

  /* Accepts 1:12.34 · 1.12.34 · 1 12 34 · 72.34 · 112.34 (mmss.hh) · 31.4 */
  function parseTime(raw) {
    var t = String(raw).trim().replace(/,/g, '.');
    if (!t) return null;
    var parts = t.split(/[:.\s]+/).filter(function (p) { return p !== ''; });
    if (!parts.length || parts.some(function (p) { return !/^\d+$/.test(p); })) return null;

    var mins = 0, secs = 0, hund = 0;
    if (parts.length === 3) {              // m : ss . hh
      mins = +parts[0]; secs = +parts[1]; hund = +(parts[2] + '0').slice(0, 2);
      if (secs > 59) return null;
    } else if (parts.length === 2) {
      if (/[:\s]/.test(t) && t.indexOf('.') === -1) {   // m:ss
        mins = +parts[0]; secs = +parts[1];
        if (secs > 59) return null;
      } else {                              // ss.hh, or mmss.hh
        secs = +parts[0]; hund = +(parts[1] + '0').slice(0, 2);
        if (secs >= 100) { mins = Math.floor(secs / 100); secs = secs % 100; }
        if (secs > 59 && mins) return null;
      }
    } else {
      secs = +parts[0];
      if (secs >= 100) { mins = Math.floor(secs / 100); secs = secs % 100; }
      if (secs > 59 && mins) return null;
    }
    var total = mins * 60 + secs + hund / 100;
    if (!(total > 0) || total > 5400) return null;
    return Math.round(total * 100) / 100;
  }

  function lookup(level, gender, age, course, dist, stroke) {
    for (var i = 0; i < DATA.length; i++) {
      var r = DATA[i];
      if (r.level === level && r.gender === gender && r.age === age &&
          r.course === course && r.distance === dist && r.stroke === stroke) return r;
    }
    return null;
  }

  function sel() {
    var p = $('cEvent').value.split('|');
    return {
      gender: $('cGender').value,
      age: $('cAge').value,
      course: $('cCourse').value,
      dist: parseInt(p[0], 10),
      stroke: p[1]
    };
  }

  /* ---------------------------------------------------- populate controls */
  var ages = uniq(DATA.map(function (r) { return r.age; }))
    .filter(function (a) { return a !== 'Open'; }).sort(byOrder(AGE_ORDER));
  ages.forEach(function (a) {
    var o = el('option', null, a); o.value = a; $('cAge').appendChild(o);
  });
  $('cAge').value = ages.indexOf('16') > -1 ? '16' : ages[0];

  var events = uniq(DATA.map(function (r) { return r.distance + '|' + r.stroke; }));
  events.sort(function (a, b) {
    var pa = a.split('|'), pb = b.split('|');
    return STROKE_ORDER.indexOf(pa[1]) - STROKE_ORDER.indexOf(pb[1]) || pa[0] - pb[0];
  });
  events.forEach(function (e) {
    var p = e.split('|');
    var o = el('option', null, p[0] + 'm ' + p[1]); o.value = e;
    $('cEvent').appendChild(o);
  });
  $('cEvent').value = '50|Freestyle';

  /* ---------------------------------------------------- your standing */
  function renderStanding(have, s) {
    var card = $('standingCard'), box = $('standing');
    box.textContent = '';
    if (myTime == null || !have.length) { card.hidden = true; return; }
    card.hidden = false;

    var head = el('div', 'standing-head');
    head.appendChild(el('span', 'yt', fmt(myTime)));
    head.appendChild(el('span', 'meta',
      s.dist + 'm ' + s.stroke + ' · ' + s.gender + ' · ' + s.age + ' · ' + s.course));
    box.appendChild(head);

    var met = have.filter(function (f) { return myTime <= f.row.seconds; });
    var next = null;
    for (var i = 0; i < have.length; i++) {
      if (myTime > have[i].row.seconds) { next = have[i]; break; }
    }
    var summary = el('p', 'standing-summary');
    if (!met.length) {
      summary.appendChild(el('strong', 'not-yet', 'Not yet qualified'));
    } else {
      var best = met.reduce(function (a, b) { return b.row.seconds < a.row.seconds ? b : a; });
      summary.appendChild(el('strong', 'qualified', 'Qualified for ' + best.level.short));
    }
    if (next) {
      summary.appendChild(el('span', 'next-line',
        'Next target: ' + next.level.label + ' — ' + fmt(myTime - next.row.seconds) + ' to drop.'));
    }
    box.appendChild(summary);

    var grid = el('div', 'standing-grid');
    have.forEach(function (f) {
      var d = myTime - f.row.seconds;      // positive = still to drop
      var ok = d <= 0;
      var tile = el('div', 'st-tile' + (ok ? ' met' : ''));
      tile.appendChild(el('div', 'lv', f.level.label));
      tile.appendChild(el('div', 'std', 'Standard ' + f.row.time));
      tile.appendChild(el('div', 'delta ' + (ok ? 'met' : 'gap'),
        (ok ? '−' : '+') + fmt(Math.abs(d))));
      tile.appendChild(el('div', 'pct', ok
        ? fmt(Math.abs(d)) + ' inside the cut'
        : (d / myTime * 100).toFixed(1) + '% improvement needed'));
      tile.appendChild(el('span', 'badge ' + (ok ? 'met' : 'gap'), ok ? 'Qualified' : 'Not yet'));
      grid.appendChild(tile);
    });
    box.appendChild(grid);
  }

  /* ---------------------------------------------------- charts */

  /* Horizontal: the standard is the wall at the end of the pool. A swimmer short of the
     cut trails back to the left of it; one inside the cut has carried on past it. */
  function buildBarChart(have) {
    var box = el('div', 'gapchart');

    var deltas = have.map(function (f) { return myTime != null ? myTime - f.row.seconds : 0; });
    var maxIn = Math.max.apply(null, deltas.map(function (d) { return d < 0 ? -d : 0; }));
    var maxOut = Math.max.apply(null, deltas.map(function (d) { return d > 0 ? d : 0; }));

    /* The wall sits well to the right, and only shifts left to make room when a cut
       has been achieved and the swimmer runs past it. */
    var WALL = maxIn > 0 ? 58 : 86;
    var unitOut = maxOut > 0 ? (WALL - 12) / maxOut : 0;       // % per second, trailing left
    var unitIn = maxIn > 0 ? (100 - WALL - 12) / maxIn : 0;    // % per second, past the wall

    var axis = el('div', 'gc-axis');
    axis.appendChild(el('div', null, ''));
    var axLane = el('div', 'gc-axlane');
    var chip = el('span', 'ax-c', 'THE STANDARD');
    chip.style.left = WALL + '%';
    axLane.appendChild(chip);
    if (maxOut > 0) axLane.appendChild(el('span', 'ax-l', '\u25c0 time still to drop'));
    if (maxIn > 0) axLane.appendChild(el('span', 'ax-r', 'inside the cut \u25b6'));
    axis.appendChild(axLane);
    axis.appendChild(el('div', null, ''));
    box.appendChild(axis);

    have.forEach(function (f) {
      var d = myTime != null ? myTime - f.row.seconds : 0;   // >0 = still to drop
      var ok = d <= 0;
      var mag = Math.max(Math.abs(d) * (ok ? unitIn : unitOut), 0.6);

      var row = el('div', 'gc-row' + (myTime != null && ok ? ' met' : ''));

      var lab = el('div', 'gc-label', f.level.label);
      lab.appendChild(el('small', null, f.level.sub));
      row.appendChild(lab);

      var lane = el('div', 'gc-lane');

      var bar = el('div', 'gc-bar ' + (ok ? 'in' : 'out'));
      bar.style.width = mag + '%';
      if (ok) { bar.style.left = WALL + '%'; } else { bar.style.right = (100 - WALL) + '%'; }
      if (myTime != null) lane.appendChild(bar);

      var wall = el('span', 'gc-std-line');
      wall.style.left = WALL + '%';
      wall.title = 'Standard ' + f.row.time;
      lane.appendChild(wall);

      var you = el('span', 'gc-you');        // where the swimmer actually is
      you.style.left = (ok ? WALL + mag : WALL - mag) + '%';
      if (myTime != null) { you.title = 'Your time ' + fmt(myTime); lane.appendChild(you); }

      var tag = el('span', 'gc-tag ' + (ok ? 'in' : 'out'),
        (ok ? '\u2212' : '+') + fmt(Math.abs(d)));
      if (ok) tag.style.left = (WALL + mag + 1.5) + '%';
      else tag.style.right = (100 - WALL + mag + 1.5) + '%';
      if (myTime != null) lane.appendChild(tag);
      row.appendChild(lane);

      var right = el('div', 'gc-std');
      right.appendChild(el('b', null, f.row.time));
      if (myTime != null) right.appendChild(el('span', 'badge ' + (ok ? 'met' : 'gap'), ok ? 'Qualified' : 'Not yet'));
      row.appendChild(right);

      box.appendChild(row);
    });

    var lg = el('p', 'marker-legend');
    lg.textContent = myTime == null
      ? 'The navy line is the wall at the end of the pool \u2014 that is the standard. Enter your best time above to ' +
        'see how far from each wall you are.'
      : 'Think of the navy line as the wall at the end of the pool \u2014 that is the standard. The gold ' +
      'marker is you: a red bar trailing back to the left is the time you still have to find, and a green bar past ' +
      'the wall is how far inside the cut you already are.';
    box.appendChild(lg);
    return box;
  }

  /* Vertical: same idea as the horizontal view, turned on its side. Every standard sits
     on one fixed wall line near the top of the plot, and each column's gap hangs down
     from it to the swimmer's gold marker (or rises above when the cut is already met). */
  function buildScaleChart(have) {
    var box = el('div', 'vchart');
    var deltas = have.map(function (f) { return myTime != null ? myTime - f.row.seconds : 0; });
    var maxIn = Math.max.apply(null, deltas.map(function (d) { return d < 0 ? -d : 0; }));
    var maxOut = Math.max.apply(null, deltas.map(function (d) { return d > 0 ? d : 0; }));

    var WALL = maxIn > 0 ? 34 : 14;                            // % from the top of the plot
    var unitOut = maxOut > 0 ? (100 - WALL - 14) / maxOut : 0;  // % per second, hanging down
    var unitIn = maxIn > 0 ? (WALL - 10) / maxIn : 0;           // % per second, rising above

    var plotWrap = el('div', 'v-wrap');

    var axis = el('div', 'v-axis');
    axis.appendChild(el('span', 'a-top', 'Faster \u25b2'));
    axis.appendChild(el('span', 'a-bot', '\u25bc Slower'));
    var wchip = el('span', 'v-wall-tag', 'STANDARD');
    wchip.style.top = WALL + '%';
    axis.appendChild(wchip);
    plotWrap.appendChild(axis);

    var plot = el('div', 'v-plot');

    var wall = el('div', 'v-wall');            // the wall, right across the plot
    wall.style.top = WALL + '%';
    plot.appendChild(wall);

    have.forEach(function (f) {
      var col = el('div', 'v-col');

      var tl = el('span', 'v-std', isNarrow() ? f.row.time : f.level.label + '  ' + f.row.time);
      tl.style.top = WALL + '%';
      col.appendChild(tl);

      if (myTime != null) {
        var d = myTime - f.row.seconds;            // >0 = still to drop
        var ok = d <= 0;
        var mag = Math.max(Math.abs(d) * (ok ? unitIn : unitOut), 0.5);
        var top = ok ? WALL - mag : WALL;

        var bar = el('div', 'v-bar ' + (ok ? 'in' : 'out'));
        bar.style.top = top + '%';
        bar.style.height = mag + '%';
        col.appendChild(bar);

        var you = el('div', 'v-you-mark');         // where the swimmer actually is
        you.style.top = (ok ? WALL - mag : WALL + mag) + '%';
        you.title = 'Your time ' + fmt(myTime);
        col.appendChild(you);

        var dl = el('span', 'v-delta ' + (ok ? 'in' : 'out'),
          (ok ? '\u2212' : '+') + fmt(Math.abs(d)));
        dl.style.top = (top + mag / 2) + '%';
        col.appendChild(dl);
      }

      plot.appendChild(col);
    });

    plotWrap.appendChild(plot);
    box.appendChild(plotWrap);

    /* column footer: level name, tier and status */
    var foot = el('div', 'v-foot');
    foot.appendChild(el('div', 'v-foot-pad', ''));
    var cols = el('div', 'v-foot-cols');
    have.forEach(function (f) {
      var cell = el('div', 'v-foot-cell');
      var sw = el('span', 'sw'); sw.style.background = f.level.color;
      var nm = el('div', 'nm'); nm.appendChild(sw);
      nm.appendChild(document.createTextNode(f.level.label));
      cell.appendChild(nm);
      cell.appendChild(el('div', 'sb', f.level.sub));
      if (myTime != null) {
        var okf = myTime <= f.row.seconds;
        cell.appendChild(el('span', 'badge ' + (okf ? 'met' : 'gap'), okf ? 'Qualified' : 'Not yet'));
      }
      cols.appendChild(cell);
    });
    foot.appendChild(cols);
    box.appendChild(foot);

    var lg = el('p', 'marker-legend');
    lg.textContent = myTime != null
      ? 'The navy line across the chart is the wall \u2014 every standard sits on it. The gold marker is you: a red ' +
        'column hanging below the wall is the time you still have to drop, and a green column above it is how far ' +
        'inside that cut you already are.'
      : 'The navy line across the chart is the wall \u2014 every standard sits on it. Enter your best time above to ' +
        'see how far below each wall you are.';
    box.appendChild(lg);
    return box;
  }

  /* ---------------------------------------------------- side by side */
  function renderCompare() {
    var s = sel();
    var panel = $('comparePanel');
    panel.textContent = '';

    var have = [];
    LEVELS.forEach(function (l) {
      var r = lookup(l.key, s.gender, s.age, s.course, s.dist, s.stroke);
      if (r) have.push({ level: l, row: r });
    });

    var head = el('div', 'cmp-head');
    head.appendChild(el('h3', null, s.dist + 'm ' + s.stroke));
    head.appendChild(el('span', 'meta', s.gender + ' · ' + s.age + ' · ' + s.course));

    var tog = el('div', 'chart-toggle');
    [['bars', 'Horizontal'], ['scale', 'Vertical']].forEach(function (m) {
      var b = el('button', 'tog' + (chartMode === m[0] ? ' on' : ''), m[1]);
      b.type = 'button';
      b.addEventListener('click', function () { chartMode = m[0]; modeChosen = true; renderCompare(); });
      tog.appendChild(b);
    });
    head.appendChild(tog);
    panel.appendChild(head);

    if (!have.length) {
      panel.appendChild(el('p', 'missing',
        'No published standard for this combination — the event is not offered for this age band or course.'));
      renderStanding([], s);
      return;
    }

    panel.appendChild(chartMode === 'scale' ? buildScaleChart(have) : buildBarChart(have));

    /* table */
    var wrap = el('div', 'table-scroll');
    var tbl = el('table', 'aj-table');
    var withTime = myTime != null;
    var cols = withTime
      ? ['Level', 'Tier', 'Your PB', 'Standard', 'Your Gap', 'Status']
      : ['Level', 'Tier', 'Standard'];
    var thead = el('thead'), htr = el('tr');
    cols.forEach(function (c, i) { htr.appendChild(el('th', i >= 2 ? 'num' : null, c)); });
    thead.appendChild(htr); tbl.appendChild(thead);

    var tb = el('tbody');
    have.forEach(function (f) {
      var tr = el('tr');
      var tdL = el('td', 'lv', f.level.label);
      tdL.appendChild(el('small', null, f.level.sub));
      tr.appendChild(tdL);
      tr.appendChild(el('td', null, f.level.tier));

      if (withTime) tr.appendChild(el('td', 'num pb', fmt(myTime)));
      tr.appendChild(el('td', 'num', f.row.time));

      if (withTime) {
        var d = myTime - f.row.seconds;
        var ok = d <= 0;
        tr.appendChild(el('td', 'num ' + (ok ? 'val-met' : 'val-far'), (ok ? '\u2212' : '+') + fmt(Math.abs(d))));
        tr.appendChild(el('td', 'num ' + (ok ? 'val-met' : 'val-far'),
          ok ? 'Qualified' : (d / myTime * 100).toFixed(1) + '% off'));
      }
      tb.appendChild(tr);
    });
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    panel.appendChild(wrap);

    panel.appendChild(el('p', 'tbl-note', withTime
      ? 'Your Gap is the drop-time between your best time and each standard \u2014 negative and green once you are ' +
        'inside the cut, positive and red while there is still time to find.'
      : 'Enter your best time above to add your PB, your gap to each cut and your qualifying status to this table.'));

    if (myTime != null) {
      var met = have.some(function (f) { return myTime <= f.row.seconds; });
      panel.appendChild(el('p', 'coach-note ' + (met ? 'good' : 'wait'), met
        ? 'You have met at least one standard here \u2014 check with your coach before counting on it. Cuts, ' +
          'qualifying windows and meet entry rules are occasionally revised at short notice.'
        : 'No standard met here yet \u2014 check with your coach before ruling anything out. Cuts, qualifying ' +
          'windows and meet entry rules are occasionally revised at short notice.'));
    }

    renderStanding(have, s);
  }

  /* ---------------------------------------------------- time entry */
  function applyTime() {
    var raw = $('myTime').value;
    var fb = $('timeFeedback');
    if (!raw.trim()) {
      myTime = null; fb.className = 'time-feedback'; fb.textContent = '';
      renderCompare(); return;
    }
    var t = parseTime(raw);
    if (t == null) {
      myTime = null;
      fb.className = 'time-feedback bad';
      fb.textContent = 'Could not read that time. Use 2:31.44, 31.44 or 231.44.';
      renderCompare(); return;
    }
    myTime = t;
    fb.className = 'time-feedback';
    fb.textContent = 'Comparing ' + fmt(t) + '.';
    renderCompare();
  }

  $('applyBtn').addEventListener('click', applyTime);
  $('myTime').addEventListener('change', applyTime);
  $('myTime').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); applyTime(); }
  });
  $('clearBtn').addEventListener('click', function () {
    $('myTime').value = ''; applyTime();
  });
  var rz;
  window.addEventListener('resize', function () {
    clearTimeout(rz);
    rz = setTimeout(function () {
      if (modeChosen) return;
      var want = isNarrow() ? 'scale' : 'bars';
      if (want !== chartMode) { chartMode = want; renderCompare(); } else { renderCompare(); }
    }, 180);
  });

  ['cGender', 'cAge', 'cCourse', 'cEvent'].forEach(function (id) {
    $(id).addEventListener('change', renderCompare);
  });

  renderCompare();
})();
