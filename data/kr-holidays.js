// Verified 2026-11-06. KASI calendar tables plus MPM's 2026 holiday amendment.
// A dated snapshot, not an automatic feed for future temporary holidays.
(function () {
  var events = [];
  function add(year, monthDay, title, end) {
    events.push({ date: year + '-' + monthDay, endDate: year + '-' + (end || monthDay), title: title, type: 'holiday' });
  }
  [2026, 2027].forEach(function (year) {
    [['01-01','신정'],['03-01','삼일절'],['05-01','노동절'],['05-05','어린이날'],['06-06','현충일'],['07-17','제헌절'],['08-15','광복절'],['10-03','개천절'],['10-09','한글날'],['12-25','성탄절']].forEach(function (item) { add(year,item[0],item[1]); });
  });
  add(2026,'02-16','설날 연휴','02-18');
  add(2026,'03-02','대체공휴일(삼일절)');
  add(2026,'05-24','부처님오신날'); add(2026,'05-25','대체공휴일(부처님오신날)');
  add(2026,'06-03','전국동시지방선거'); add(2026,'08-17','대체공휴일(광복절)');
  add(2026,'09-24','추석 연휴','09-26'); add(2026,'10-05','대체공휴일(개천절)');
  add(2027,'02-06','설날 연휴','02-08'); add(2027,'02-09','대체공휴일(설날)');
  add(2027,'05-03','대체공휴일(노동절)'); add(2027,'05-13','부처님오신날');
  add(2027,'07-19','대체공휴일(제헌절)'); add(2027,'08-16','대체공휴일(광복절)');
  add(2027,'09-14','추석 연휴','09-16'); add(2027,'10-04','대체공휴일(개천절)');
  add(2027,'10-11','대체공휴일(한글날)'); add(2027,'12-27','대체공휴일(성탄절)');
  window.HISEM_KR_HOLIDAYS = events;
})();
