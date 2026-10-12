#!/usr/bin/env python3
"""Permit publication only from passing platform jobs for the exact existing tag."""
import json
import os
import subprocess

repository = 'doctorillumination/else-file-format'
run_id = os.environ['ELSE_SOURCE_RUN']
tag = os.environ['ELSE_RELEASE_TAG']
if not run_id.isdecimal() or tag != 'v0.2.0-experiment':
    raise SystemExit('Review the source run and release manifest before publishing.')


def api(route):
    return json.loads(subprocess.check_output(['gh', 'api', 'repos/' + repository + '/' + route], text=True))


run = api('actions/runs/' + run_id)
ref = api('git/ref/tags/' + tag)
if ref['object']['type'] != 'commit' or run['head_sha'] != ref['object']['sha'] or run['path'] != '.github/workflows/desktop.yml':
    raise SystemExit('The tested build must match the exact lightweight release tag and desktop workflow.')
jobs = api('actions/runs/' + run_id + '/jobs?per_page=100')['jobs']
required = ['desktop (macos-14,', 'desktop (windows-latest,', 'desktop (ubuntu-22.04,', 'mac-intel']
for prefix in required:
    matches = [job for job in jobs if job['name'].startswith(prefix)]
    if len(matches) != 1 or matches[0]['conclusion'] != 'success':
        raise SystemExit('A required platform check has not passed: ' + prefix)
print('Verified source build', run_id, 'for', tag, 'at', run['head_sha'])
