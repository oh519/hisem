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
    return events.filter(function (event) { return validDate(event.date) && event.date === date && typeof event.title === 'string' && event.title.trim(); });
  }
  if (typeof module === 'object' && module.exports) module.exports = { monthCells: monthCells, moveMonth: moveMonth, validDate: validDate, eventsOn: eventsOn };
  if (typeof document === 'undefined') return;
  var body = document.getElementById('calendar-days');
  if (!body) return;
  var events = Array.isArray(window.HISEM_CURRICULUM_EVENTS) ? window.HISEM_CURRICULUM_EVENTS : [];
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
      title.textContent = event.title; item.appendChild(title);
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
      button.className = 'calendar-day' + (cell.inMonth ? '' : ' is-outside') + (items.length ? ' has-event' : '');
      button.setAttribute('aria-label', dayFormat.format(parse(cell.date)) + (items.length ? ', 일정 ' + items.length + '개' : ''));
      button.setAttribute('aria-pressed', String(cell.date === selected));
      button.tabIndex = cell.date === selected ? 0 : -1;
      if (cell.date === today()) button.setAttribute('aria-current', 'date');
      td.appendChild(button); row.appendChild(td);
    });
    showAgenda();
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
})();
