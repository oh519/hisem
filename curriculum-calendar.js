(function () {
  'use strict';
  function iso(date) { return date.toISOString().slice(0, 10); }
  function parse(value) { return new Date(value + 'T12:00:00Z'); }
  function validDate(value) {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(parse(value)) && iso(parse(value)) === value;
  }
  function monthCells(year, month) {
    var first = new Date(Date.UTC(year, month, 1, 12));
    var start = first.getUTCDate() - first.getUTCDay();
    return Array.from({ length: 42 }, function (_, index) {
      var date = new Date(Date.UTC(year, month, start + index, 12));
      return { date: iso(date), day: date.getUTCDate(), inMonth: date.getUTCMonth() === month && date.getUTCFullYear() === year };
    });
  }
  function moveMonth(value, amount) {
    var date = parse(value), day = date.getUTCDate();
    var target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + amount, 1, 12));
    var last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 12)).getUTCDate();
    target.setUTCDate(Math.min(day, last));
    return iso(target);
  }
  function eventsOn(events, date) {
    if (!validDate(date)) return [];
    return events.filter(function (event) {
      var end = event.endDate || event.date;
      return validDate(event.date) && validDate(end) && event.date <= end && event.date <= date && date <= end && typeof event.title === 'string' && event.title.trim();
    });
  }
  function academicEvents(data) {
    if (!data || data.schemaVersion !== 1 || !Array.isArray(data.events)) return [];
    return data.events.filter(function (event) {
      return event.type === 'academic' && typeof event.title === 'string' && event.title.trim() && validDate(event.date) && validDate(event.endDate) && event.endDate >= event.date;
    }).map(function (event) { return { date: event.date, endDate: event.endDate, title: event.title, type: 'academic', sourceUrl: 'https://www.hongik.ac.kr/kr/education/academic-schedule001.do' }; });
  }
  function shortTitle(title) {
    return title.replace(/^\d{4}(?:학년도|년)\s*/, '').replace(/^[12]학기\s*/, '').replace(/^공휴일로 인한 수업보강기간$/, '수업 보강');
  }
  function calendarEvents(manual, academic, holidays) {
    return holidays.concat(manual, academic.filter(function (event) {
      var name = shortTitle(event.title).replace(/\s|\(공휴일\)/g, '').replace(/기독탄신일|크리스마스/g, '성탄절');
      return !holidays.some(function (holiday) { return event.date === holiday.date && event.endDate === holiday.endDate && name === holiday.title.replace(/\s/g, ''); });
    }));
  }
  function weekSegments(events, cells) {
    var valid = events.filter(function (event) { return validDate(event.date) && validDate(event.endDate || event.date) && event.date <= (event.endDate || event.date) && typeof event.title === 'string' && event.title.trim(); });
    var preferred = new Map();
    return Array.from({ length: 6 }, function (_, week) {
      var days = cells.slice(week * 7, week * 7 + 7), first = days[0].date, last = days[6].date, occupied = [];
      var segments = valid.filter(function (event) { return event.date <= last && (event.endDate || event.date) >= first; }).map(function (event) {
        var start = event.date < first ? first : event.date, end = (event.endDate || event.date) > last ? last : (event.endDate || event.date);
        return { event: event, start: days.findIndex(function (day) { return day.date === start; }), end: days.findIndex(function (day) { return day.date === end; }), date: start, before: event.date < first, after: (event.endDate || event.date) > last };
      }).sort(function (a, b) { return Number(b.before) - Number(a.before) || (b.end - b.start) - (a.end - a.start) || a.start - b.start || a.event.title.localeCompare(b.event.title, 'ko'); });
      segments.forEach(function (segment) {
        function free(lane) { return !occupied[lane] || !occupied[lane].some(function (other) { return segment.start <= other.end && segment.end >= other.start; }); }
        var lane = preferred.get(segment.event);
        if (lane == null || !free(lane)) { lane = 0; while (!free(lane)) lane++; }
        (occupied[lane] || (occupied[lane] = [])).push(segment); preferred.set(segment.event, lane); segment.lane = lane;
      });
      return { days: days, segments: segments, lanes: occupied.length };
    });
  }
  function noticesInMonth(notices, month) {
    return notices.filter(function (notice) { return /^\d{4}-\d{2}$/.test(notice.startMonth) && /^\d{4}-\d{2}$/.test(notice.endMonth) && validDate(notice.startMonth + '-01') && validDate(notice.endMonth + '-01') && notice.startMonth <= month && month <= notice.endMonth && typeof notice.title === 'string' && notice.title.trim(); });
  }
  function loadAcademicSnapshot(fetcher, fallback) {
    return Promise.resolve().then(function () { return fetcher('data/academic-calendar.json', { cache: 'no-cache' }); }).then(function (response) {
      if (!response.ok) throw new Error('Calendar snapshot unavailable');
      return response.json();
    }).then(function (data) {
      if (!academicEvents(data).length) throw new Error('Invalid calendar snapshot');
      return { data: data, saved: false };
    }).catch(function (error) {
      if (academicEvents(fallback).length) return { data: fallback, saved: true };
      throw error;
    });
  }
  if (typeof module === 'object' && module.exports) module.exports = { monthCells: monthCells, moveMonth: moveMonth, validDate: validDate, eventsOn: eventsOn, academicEvents: academicEvents, noticesInMonth: noticesInMonth, loadAcademicSnapshot: loadAcademicSnapshot, weekSegments: weekSegments, shortTitle: shortTitle, calendarEvents: calendarEvents };
  if (typeof document === 'undefined') return;
  var body = document.getElementById('calendar-days');
  if (!body) return;
  var events = Array.isArray(window.HISEM_CURRICULUM_EVENTS) ? window.HISEM_CURRICULUM_EVENTS : [];
  var manualEvents = events.slice(), monthNotices = [], academicState = 'loading';
  var holidays = Array.isArray(window.HISEM_KR_HOLIDAYS) ? window.HISEM_KR_HOLIDAYS : [];
  events = calendarEvents(manualEvents, [], holidays);
  var calendar = body.closest('.curriculum-calendar');
  var academicInfo = document.createElement('div'); academicInfo.className = 'calendar-academic-info';
  var sourceNote = document.createElement('p'); sourceNote.className = 'calendar-source-note'; sourceNote.setAttribute('aria-live', 'polite');
  var monthNoticeList = document.createElement('div'); monthNoticeList.className = 'calendar-month-notices';
  academicInfo.append(sourceNote, monthNoticeList); calendar.appendChild(academicInfo);
  var holidaySource = document.createElement('p'); holidaySource.className = 'calendar-holiday-source';
  var holidayLink = document.createElement('a'); holidayLink.href = 'https://astro.kasi.re.kr/kor/life/post/calendarData?year=2027'; holidayLink.target = '_blank'; holidayLink.rel = 'noopener noreferrer'; holidayLink.textContent = '대한민국 공휴일 · 2026–2027년 확인 자료'; holidaySource.appendChild(holidayLink); academicInfo.appendChild(holidaySource);
  sourceNote.textContent = '홍익대 학사일정 불러오는 중';
  function today() {
    var parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    function part(type) { return parts.find(function (item) { return item.type === type; }).value; }
    return part('year') + '-' + part('month') + '-' + part('day');
  }
  var selected = today(), year = parse(selected).getUTCFullYear(), month = parse(selected).getUTCMonth();
  var heading = document.getElementById('calendar-month-title');
  var selectedHeading = document.getElementById('calendar-selected-title');
  var agenda = document.getElementById('calendar-events');
  var dayFormat = new Intl.DateTimeFormat('ko-KR', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  function showAgenda() {
    selectedHeading.textContent = dayFormat.format(parse(selected));
    agenda.replaceChildren();
    var items = eventsOn(events, selected);
    if (!items.length) {
      var empty = document.createElement('p'); empty.className = 'calendar-empty'; empty.textContent = academicState === 'loading' ? '학사일정을 확인하고 있습니다.' : academicState === 'error' ? '학사일정을 불러오지 못해 이 날짜의 일정을 확인할 수 없습니다.' : academicState === 'saved' ? '저장된 학사일정에는 이 날짜의 일정이 없습니다.' : '이날은 날짜가 지정된 일정이 없습니다.'; agenda.appendChild(empty); return;
    }
    var list = document.createElement('ul'); list.className = 'calendar-event-list';
    items.forEach(function (event) {
      var item = document.createElement('li'), title = document.createElement('h4');
      var kind = document.createElement('span'); kind.className = 'calendar-event-kind'; kind.textContent = event.type === 'holiday' ? '공휴일' : event.type === 'academic' ? '학사일정' : '학회 일정'; item.appendChild(kind);
      title.textContent = event.title; item.appendChild(title);
      if (event.endDate && event.endDate !== event.date) { var period = document.createElement('p'); period.className = 'calendar-event-period'; period.textContent = event.date + ' ~ ' + event.endDate; item.appendChild(period); }
      if (typeof event.description === 'string' && event.description.trim()) { var text = document.createElement('p'); text.textContent = event.description; item.appendChild(text); }
      list.appendChild(item);
    });
    agenda.appendChild(list);
  }
  function render(focusDate) {
    heading.textContent = year + '년 ' + (month + 1) + '월';
    body.replaceChildren();
    var cells = monthCells(year, month);
    weekSegments(events, cells).forEach(function (week) {
      if (!week.days.some(function (day) { return day.inMonth; })) return;
      var row = document.createElement('div'); row.className = 'calendar-week';
      var dates = document.createElement('div'); dates.className = 'calendar-week-dates'; row.appendChild(dates);
      week.days.forEach(function (cell, index) {
      var button = document.createElement('button');
      var items = eventsOn(events, cell.date);
      button.type = 'button'; button.dataset.date = cell.date; button.textContent = String(cell.day);
      button.className = 'calendar-day' + (cell.inMonth ? '' : ' is-outside') + (index === 0 ? ' is-sunday' : index === 6 ? ' is-saturday' : '') + (items.some(function (event) { return event.type === 'holiday'; }) ? ' is-holiday' : '');
      button.setAttribute('aria-label', dayFormat.format(parse(cell.date)) + (items.length ? ', ' + items.map(function (event) { return event.title; }).join(', ') : ''));
      button.setAttribute('aria-pressed', String(cell.date === selected));
      button.tabIndex = cell.date === selected ? 0 : -1;
      if (cell.date === today()) button.setAttribute('aria-current', 'date');
      dates.appendChild(button);
      });
      var bars = document.createElement('div'); bars.className = 'calendar-week-events';
      week.segments.forEach(function (segment) {
        var event = segment.event, button = document.createElement('button'); button.type = 'button'; button.dataset.date = segment.date;
        button.className = 'calendar-event-bar event-' + (event.type === 'holiday' ? 'holiday' : event.type === 'academic' ? 'academic' : 'study') + (segment.before ? ' continues-before' : '') + (segment.after ? ' continues-after' : '');
        button.style.gridColumn = (segment.start + 1) + ' / span ' + (segment.end - segment.start + 1); button.style.gridRow = String(segment.lane + 1);
        button.textContent = (segment.before ? '↳ ' : '') + shortTitle(event.title);
        button.title = event.title + ' · ' + event.date + ' ~ ' + (event.endDate || event.date);
        button.setAttribute('aria-label', (event.type === 'holiday' ? '공휴일 ' : '') + button.title);
        bars.appendChild(button);
      });
      row.appendChild(bars); body.appendChild(row);
    });
    showAgenda();
    monthNoticeList.replaceChildren();
    var monthKey = String(year).padStart(4, '0') + '-' + String(month + 1).padStart(2, '0');
    var notices = noticesInMonth(monthNotices, monthKey);
    if (notices.length) {
      var label = document.createElement('p'); label.className = 'calendar-notices-label'; label.textContent = '이달 학사 안내 · 세부 날짜 별도 공지'; monthNoticeList.appendChild(label);
      var noticeItems = document.createElement('ul');
      notices.forEach(function (notice) { var item = document.createElement('li'); item.textContent = notice.title; noticeItems.appendChild(item); });
      monthNoticeList.appendChild(noticeItems);
    }
    if (focusDate) { var target = body.querySelector('[data-date="' + selected + '"]'); if (target) target.focus({ preventScroll: true }); }
  }
  function select(value, focusDate) {
    selected = value; var date = parse(value); year = date.getUTCFullYear(); month = date.getUTCMonth(); render(focusDate);
  }
  body.addEventListener('click', function (event) { var button = event.target.closest('button[data-date]'); if (button) select(button.dataset.date, true); });
  body.addEventListener('keydown', function (event) {
    var button = event.target.closest('button[data-date]'); if (!button) return;
    var date = parse(button.dataset.date), delta;
    if (event.key === 'PageUp' || event.key === 'PageDown') { event.preventDefault(); select(moveMonth(button.dataset.date, event.key === 'PageUp' ? -1 : 1), true); return; }
    if (event.key === 'ArrowLeft') delta = -1;
    else if (event.key === 'ArrowRight') delta = 1;
    else if (event.key === 'ArrowUp') delta = -7;
    else if (event.key === 'ArrowDown') delta = 7;
    else if (event.key === 'Home') delta = -date.getUTCDay();
    else if (event.key === 'End') delta = 6 - date.getUTCDay();
    else return;
    event.preventDefault(); date.setUTCDate(date.getUTCDate() + delta); select(iso(date), true);
  });
  document.getElementById('calendar-prev').addEventListener('click', function () { select(moveMonth(selected, -1), false); });
  document.getElementById('calendar-next').addEventListener('click', function () { select(moveMonth(selected, 1), false); });
  document.getElementById('calendar-today').addEventListener('click', function () { select(today(), false); });
  function applyAcademicSnapshot(data, saved) {
    var academic = academicEvents(data);
    if (!academic.length) return;
    academicState = saved ? 'saved' : 'ready';
    events = calendarEvents(manualEvents, academic, holidays); monthNotices = Array.isArray(data.notices) ? data.notices : [];
    sourceNote.replaceChildren();
    var sourceLink = document.createElement('a'); sourceLink.href = 'https://www.hongik.ac.kr/kr/education/academic-schedule001.do'; sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer'; sourceLink.textContent = '홍익대 공식 학사일정'; sourceNote.appendChild(sourceLink);
    var fetched = new Date(data.fetchedAt);
    if (!isNaN(fetched)) sourceNote.appendChild(document.createTextNode(' · ' + new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric' }).format(fetched) + ' 확인'));
    if (saved) sourceNote.appendChild(document.createTextNode(' · 저장된 학사일정 표시'));
    render(body.contains(document.activeElement));
  }
  render(false);
  // Render a verified snapshot before requesting fresher data. A blocked JSON
  // request must not empty the calendar or claim that a date has no events.
  var fallback = window.HISEM_ACADEMIC_FALLBACK;
  applyAcademicSnapshot(fallback, true);
  loadAcademicSnapshot(window.fetch.bind(window), fallback).then(function (result) {
    applyAcademicSnapshot(result.data, result.saved);
    if (result.saved) sourceNote.appendChild(document.createTextNode(' · 최신 갱신 실패'));
  }).catch(function () {
    academicState = 'error'; render(false);
    sourceNote.textContent = '학사일정을 불러오지 못했습니다. '; var link = document.createElement('a'); link.href = 'https://www.hongik.ac.kr/kr/education/academic-schedule001.do'; link.textContent = '공식 일정 확인'; link.target = '_blank'; link.rel = 'noopener noreferrer'; sourceNote.appendChild(link);
  });
})();
