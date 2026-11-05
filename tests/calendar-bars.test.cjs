const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const cal = require('../curriculum-calendar.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../data/kr-holidays.js'),'utf8'), context);
const holidays = context.window.HISEM_KR_HOLIDAYS;

test('verified Korean holidays include 2026 amendments, election and substitutes', () => {
  for (const date of ['2026-05-01','2026-07-17','2026-06-03','2026-08-17','2026-12-25','2027-02-09','2027-05-03','2027-07-19','2027-12-27']) assert.equal(cal.eventsOn(holidays,date).length,1,date);
  for (const date of ['2026-11-06','2026-06-08','2027-06-07']) assert.equal(cal.eventsOn(holidays,date).length,0,date);
  holidays.forEach(event => { assert.ok(cal.validDate(event.date)); assert.ok(cal.validDate(event.endDate)); });
});
test('a 19–24 inclusive event wraps at Sunday with no missing or duplicated days', () => {
  const event = { date:'2026-12-19',endDate:'2026-12-24',title:'성적 정정 기간',type:'academic' };
  const weeks = cal.weekSegments([event],cal.monthCells(2026,11));
  const segments = weeks.flatMap(week=>week.segments);
  assert.equal(segments.length,2);
  assert.equal(segments[0].start,6); assert.equal(segments[0].end,6); assert.equal(segments[0].after,true);
  assert.equal(segments[1].start,0); assert.equal(segments[1].end,4); assert.equal(segments[1].before,true);
  assert.equal(segments[0].lane,segments[1].lane);
  assert.equal(segments.reduce((sum,part)=>sum+part.end-part.start+1,0),6);
});
test('overlapping events occupy separate lanes and cross-year periods keep their original range', () => {
  const events = [
    {date:'2026-12-15',endDate:'2027-01-04',title:'성적입력 및 정정(예정)'},
    {date:'2026-12-15',endDate:'2026-12-21',title:'보강기간'},
    {date:'2026-12-25',endDate:'2026-12-25',title:'성탄절',type:'holiday'}
  ];
  const weeks = cal.weekSegments(events,cal.monthCells(2026,11));
  for (const week of weeks) for (const a of week.segments) for (const b of week.segments) {
    if (a!==b && a.start<=b.end && a.end>=b.start) assert.notEqual(a.lane,b.lane);
  }
  assert.equal(weeks.flatMap(w=>w.segments).filter(s=>s.event===events[0]).length,4);
  assert.equal(events[0].endDate,'2027-01-04');
});
test('equivalent academic holiday is shown once while unrelated events on that date stay', () => {
  const academic = [
    {date:'2026-12-25',endDate:'2026-12-25',title:'2026학년도 성탄절',type:'academic'},
    {date:'2026-12-25',endDate:'2026-12-25',title:'크리스마스',type:'academic'},
    {date:'2026-12-25',endDate:'2026-12-25',title:'연구 발표',type:'academic'}
  ];
  const events = cal.calendarEvents([],academic,holidays);
  assert.equal(cal.eventsOn(events,'2026-12-25').length,2);
  assert.equal(cal.shortTitle('2026학년도 2학기 성적입력 및 정정(예정)'),'성적입력 및 정정(예정)');
});
