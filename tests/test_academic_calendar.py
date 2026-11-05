import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('academic', Path(__file__).resolve().parents[1] / 'scripts' / 'fetch_academic_calendar.py')
academic = importlib.util.module_from_spec(spec)
spec.loader.exec_module(academic)


class CalendarSyncTests(unittest.TestCase):
    def test_day_span_and_month_precision_stay_distinct(self):
        payload = {'result': 'Y', 'data': [
            {'START': '2026-12-15', 'END': '2027-01-04', 'TITLE': '%EC%84%B1%EC%A0%81%20%EC%A0%95%EC%A0%95'},
            {'START': '2026-11', 'END': '2026-12', 'TITLE': '%EC%9E%A5%ED%95%99%EA%B8%88%20%EC%8B%A0%EC%B2%AD'},
        ]}
        days, months = academic.normalize(payload, 2026)
        self.assertEqual(days[0]['title'], '성적 정정')
        self.assertEqual(days[0]['endDate'], '2027-01-04')
        self.assertEqual(months[0]['startMonth'], '2026-11')
        self.assertNotIn('date', months[0])

    def test_reject_invalid_data_before_replacing_snapshot(self):
        for payload in [{'result': 'N', 'data': []}, {'result': 'Y', 'data': [
            {'START': '2026-02-30', 'END': '2026-03-01', 'TITLE': 'Invalid date'}]}, {'result': 'Y', 'data': []}]:
            with self.assertRaises(ValueError):
                academic.snapshot([2026], lambda _: payload)

    def test_duplicate_records_collapse_and_write_is_atomic(self):
        payload = {'result': 'Y', 'data': [{'START': '2026-11-05', 'END': '2026-11-06', 'TITLE': 'Fixture event'}] * 2}
        data = academic.snapshot([2026], lambda _: payload)
        self.assertEqual(len(data['events']), 1)
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as folder:
            path = Path(folder) / 'calendar.json'
            path.write_text('old', encoding='utf-8')
            academic.atomic_write(path, data)
            self.assertEqual(json.loads(path.read_text(encoding='utf-8')), data)
            self.assertEqual(len(list(Path(folder).iterdir())), 1)

    def test_spacing_variants_collapse_but_other_dates_and_campuses_remain(self):
        payload = {'result': 'Y', 'data': [
            {'START': '2026-11-05', 'END': '2026-11-06', 'TITLE': '복학신청'},
            {'START': '2026-11-05', 'END': '2026-11-06', 'TITLE': '복학 신청'},
            {'START': '2026-11-07', 'END': '2026-11-07', 'TITLE': '복학 신청'},
            {'START': '2026-11-05', 'END': '2026-11-06', 'TITLE': '서울캠퍼스 복학 신청'},
        ]}
        data = academic.snapshot([2026], lambda _: payload)
        self.assertEqual(len(data['events']), 3)
        self.assertEqual(next(event['title'] for event in data['events'] if event['date'] == '2026-11-05' and not event['title'].startswith('서울')), '복학 신청')


if __name__ == '__main__':
    unittest.main()
