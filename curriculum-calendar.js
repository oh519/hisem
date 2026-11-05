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
  function noticesInMonth(notices, month) {
    return notices.filter(function (notice) { return /^\d{4}-\d{2}$/.test(notice.startMonth) && /^\d{4}-\d{2}$/.test(notice.endMonth) && validDate(notice.startMonth + '-01') && validDate(notice.endMonth + '-01') && notice.startMonth <= month && month <= notice.endMonth && typeof notice.title === 'string' && notice.title.trim(); });
  }
  if (typeof module === 'object' && module.exports) module.exports = { monthCells: monthCells, moveMonth: moveMonth, validDate: validDate, eventsOn: eventsOn, academicEvents: academicEvents, noticesInMonth: noticesInMonth };
  if (typeof document === 'undefined') return;
  var body = document.getElementById('calendar-days');
  if (!body) return;
  var events = Array.isArray(window.HISEM_CURRICULUM_EVENTS) ? window.HISEM_CURRICULUM_EVENTS : [];
  var manualEvents = events.slice(), monthNotices = [];
  var calendar = body.closest('.curriculum-calendar');
  var academicInfo = document.createElement('div'); academicInfo.className = 'calendar-academic-info';
  var sourceNote = document.createElement('p'); sourceNote.className = 'calendar-source-note'; sourceNote.setAttribute('aria-live', 'polite');
  var monthNoticeList = document.createElement('div'); monthNoticeList.className = 'calendar-month-notices';
  academicInfo.append(sourceNote, monthNoticeList); calendar.appendChild(academicInfo);
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
      var empty = document.createElement('p'); empty.className = 'calendar-empty'; empty.textContent = '이날은 등록된 일정이 없습니다.'; agenda.appendChild(empty); return;
    }
    var list = document.createElement('ul'); list.className = 'calendar-event-list';
    items.forEach(function (event) {
      var item = document.createElement('li'), title = document.createElement('h4');
      var kind = document.createElement('span'); kind.className = 'calendar-event-kind'; kind.textContent = event.type === 'academic' ? '학사일정' : '학회 일정'; item.appendChild(kind);
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
    var cells = monthCells(year, month), row;
    cells.forEach(function (cell, index) {
      if (index % 7 === 0) { row = document.createElement('tr'); body.appendChild(row); }
      var td = document.createElement('td'), button = document.createElement('button');
      var items = eventsOn(events, cell.date);
      button.type = 'button'; button.dataset.date = cell.date; button.textContent = String(cell.day);
      button.className = 'calendar-day' + (cell.inMonth ? '' : ' is-outside') + (items.length ? ' has-event' : '') + (items.some(function (event) { return event.type === 'academic'; }) ? ' has-academic' : '');
      button.setAttribute('aria-label', dayFormat.format(parse(cell.date)) + (items.length ? ', 일정 ' + items.length + '개' : ''));
      button.setAttribute('aria-pressed', String(cell.date === selected));
      button.tabIndex = cell.date === selected ? 0 : -1;
      if (cell.date === today()) button.setAttribute('aria-current', 'date');
      td.appendChild(button); row.appendChild(td);
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
  render(false);
  fetch('data/academic-calendar.json', { cache: 'no-cache' }).then(function (response) {
    if (!response.ok) throw new Error('Calendar snapshot unavailable');
    return response.json();
  }).then(function (data) {
    var academic = academicEvents(data);
    if (!academic.length) throw new Error('Invalid calendar snapshot');
    events = manualEvents.concat(academic); monthNotices = Array.isArray(data.notices) ? data.notices : [];
    sourceNote.replaceChildren();
    var sourceLink = document.createElement('a'); sourceLink.href = 'https://www.hongik.ac.kr/kr/education/academic-schedule001.do'; sourceLink.target = '_blank'; sourceLink.rel = 'noopener noreferrer'; sourceLink.textContent = '홍익대 공식 학사일정'; sourceNote.appendChild(sourceLink);
    var fetched = new Date(data.fetchedAt);
    if (!isNaN(fetched)) sourceNote.appendChild(document.createTextNode(' · ' + new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric' }).format(fetched) + ' 확인'));
    render(body.contains(document.activeElement));
  }).catch(function () {
    sourceNote.textContent = '학사일정을 불러오지 못했습니다. '; var link = document.createElement('a'); link.href = 'https://www.hongik.ac.kr/kr/education/academic-schedule001.do'; link.textContent = '공식 일정 확인'; link.target = '_blank'; link.rel = 'noopener noreferrer'; sourceNote.appendChild(link);
  });
})();
