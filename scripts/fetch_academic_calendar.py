"""Sync Hongik's publicly displayed undergraduate calendar; no student login used."""
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import urllib.parse
import urllib.request

SOURCE_URL = 'https://www.hongik.ac.kr/kr/education/academic-schedule001.do'
ENDPOINT = 'https://www.hongik.ac.kr/sso/APICipher.jsp'
ROOT = Path(__file__).resolve().parent.parent


def normalize(payload, year):
    """Use the same public query as the official page, not its obsolete HTML stub."""
    if not isinstance(payload, dict) or payload.get('result') != 'Y' or not isinstance(payload.get('data'), list):
        raise ValueError('Official calendar response shape changed')
    days, months = [], []
    for row in payload['data']:
        if not isinstance(row, dict):
            raise ValueError('Invalid official calendar record')
        start, end = row.get('START', ''), row.get('END', '')
        title = urllib.parse.unquote_plus(row.get('TITLE', ''), errors='strict').strip()
        if not title or len(title) > 500:
            raise ValueError('Missing or invalid event title')
        if not isinstance(start, str) or not isinstance(end, str):
            raise ValueError('Invalid date fields')
        identity = hashlib.sha256((start + '|' + end + '|' + re.sub(r'\s+', '', title)).encode()).hexdigest()[:16]
        common = {'id': identity, 'title': title, 'type': 'academic', 'sourceUrl': SOURCE_URL}
        if re.fullmatch(r'\d{4}-\d{2}-\d{2}', start) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', end):
            first, last = dt.date.fromisoformat(start), dt.date.fromisoformat(end)
            if first > last or (last - first).days > 400 or not (year - 1 <= first.year <= year + 1):
                raise ValueError('Official event date outside expected range')
            days.append(dict(common, date=start, endDate=end))
        elif re.fullmatch(r'\d{4}-\d{2}', start) and re.fullmatch(r'\d{4}-\d{2}', end):
            dt.date.fromisoformat(start + '-01')
            dt.date.fromisoformat(end + '-01')
            if start > end or not (year - 1 <= int(start[:4]) <= year + 1):
                raise ValueError('Invalid month period: ' + start + ' / ' + end + ' for ' + str(year))
            # A source that only specifies months must never become invented day dates.
            months.append(dict(common, startMonth=start, endMonth=end))
        else:
            raise ValueError('Unsupported official date precision: ' + start + ' / ' + end)
    return days, months


def fetch(year):
    query = {'url': '/schedule/get_schedule.php', 'url2': '&GUBUN=', 'url3': '0', 'url4': '&YEAR=', 'url5': str(year)}
    body = urllib.parse.urlencode({'data': json.dumps(query)}).encode()
    request = urllib.request.Request(ENDPOINT, data=body, headers={
        'User-Agent': 'HISEM academic calendar sync (+https://github.com/oh519/hisem)',
        'Referer': SOURCE_URL,
    })
    with urllib.request.urlopen(request, timeout=30) as response:
        if response.status != 200:
            raise ValueError('Official calendar unavailable')
        return json.loads(response.read(2_000_000).decode('utf-8-sig'))


def snapshot(years, fetcher=fetch):
    events, notices, loaded = {}, {}, []
    for year in years:
        days, months = normalize(fetcher(year), year)
        if days or months:
            loaded.append(year)
        for event in days:
            previous = events.get(event['id'])
            if previous is None or len(event['title']) > len(previous['title']):
                events[event['id']] = event
        for notice in months:
            previous = notices.get(notice['id'])
            if previous is None or len(notice['title']) > len(previous['title']):
                notices[notice['id']] = notice
    if not events:
        raise ValueError('No dated academic events; existing snapshot will be retained')
    return {
        'schemaVersion': 1,
        'source': {'label': '홍익대학교 공식 학사일정', 'url': SOURCE_URL},
        'fetchedAt': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
        'academicYears': loaded,
        'events': sorted(events.values(), key=lambda item: (item['date'], item['title'])),
        'notices': sorted(notices.values(), key=lambda item: (item['startMonth'], item['title'])),
    }


def atomic_write(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    serialized = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
    temporary = None
    try:
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', newline='\n', dir=path.parent, delete=False) as handle:
            temporary = handle.name
            handle.write(serialized)
        os.replace(temporary, path)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)


def main():
    year = dt.datetime.now(dt.timezone(dt.timedelta(hours=9))).year
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--years', type=int, nargs='+', default=[year - 1, year])
    parser.add_argument('--output', type=Path, default=ROOT / 'data' / 'academic-calendar.json')
    args = parser.parse_args()
    result = snapshot(args.years)
    atomic_write(args.output, result)
    print('Academic calendar saved:', len(result['events']), 'dated events,', len(result['notices']), 'month notices')


if __name__ == '__main__':
    main()
