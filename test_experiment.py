#!/usr/bin/env python3
"""Cross-reader checks plus malformed and privacy-boundary fixtures."""
import hashlib
import json
import os
from pathlib import Path
import struct
import subprocess
import tempfile
import zipfile
import reader

ROOT = Path(__file__).resolve().parent
SAMPLE = ROOT / 'specimen/One-file-two-readings.else'
SWIFT = ROOT / 'output/Else Experiment.app/Contents/MacOS/ElseExperiment'
NODE = os.environ.get('ELSE_NODE', 'node')
checks = []


def run(*args):
    return subprocess.run([str(SWIFT), *map(str, args)], capture_output=True)


def browser(*args):
    return subprocess.run([NODE, str(ROOT / 'web/check.mjs'), *map(str, args)], capture_output=True)


def encode(obj):
    return (json.dumps(obj, sort_keys=True, separators=(',', ':')) + '\n').encode()


with zipfile.ZipFile(SAMPLE) as z:
    original = {name: z.read(name) for name in z.namelist()}


def write_archive(path, entries, *, duplicate=False, compression=0, symlink=False):
    with zipfile.ZipFile(path, 'w', compression=compression) as z:
        for name, data in entries.items():
            info = zipfile.ZipInfo(name, (2026, 10, 11, 0, 0, 0))
            info.compress_type = compression
            info.external_attr = (0o120777 if symlink and name == 'mimetype' else 0o100644) << 16
            z.writestr(info, data)
        if duplicate:
            z.writestr('mimetype', entries['mimetype'])


def indexed(entries):
    entries = dict(entries)
    entries['integrity/files.json'] = encode({'files': {name: {'sha256': reader.digest(data), 'bytes': len(data)} for name, data in entries.items() if name != 'integrity/files.json'}})
    return entries


def changed_record(entries, ref, field, value):
    entries = dict(entries)
    old = 'records/' + ref + '.json'
    record = json.loads(entries.pop(old))
    record[field] = value
    data = encode(record)
    new = reader.digest(data)
    entries['records/' + new + '.json'] = data
    return entries, new


def bad(name, entries, folder, **options):
    path = folder / (name + '.else')
    write_archive(path, entries, **options)
    try:
        reader.read_package(path)
    except (ValueError, zipfile.BadZipFile, UnicodeError, KeyError, TypeError, struct.error, RecursionError):
        pass
    else:
        raise AssertionError('Python accepted ' + name)
    native = run('--inspect', path)
    assert native.returncode != 0, 'Swift accepted ' + name
    assert not native.stdout, 'Swift emitted a valid model for ' + name
    js = browser('--inspect', path)
    assert js.returncode != 0 and not js.stdout, 'Browser accepted ' + name
    checks.append(name + ': all three readers reject')
    return path


def main():
    model, pdf = reader.read_package(SAMPLE)
    swift = run('--inspect', SAMPLE)
    assert swift.returncode == 0, swift.stderr.decode()
    assert json.loads(swift.stdout) == model, 'Reader model mismatch'
    js = browser('--inspect', SAMPLE)
    assert js.returncode == 0 and json.loads(js.stdout) == model, js.stderr.decode()
    checks.append('All three readers independently recover identical material, attribution, interpretations and evidence')
    context = run('--context', SAMPLE)
    assert context.returncode == 0 and context.stdout.decode() == reader.ai_context(model), 'AI view mismatch'
    js_context = browser('--context', SAMPLE)
    assert js_context.returncode == 0 and js_context.stdout.decode() == reader.ai_context(model), 'Browser AI view mismatch'
    checks.append('All three readers independently generate identical AI-readable context')
    bundled_report = SWIFT.parent.parent / 'Resources/Inspection-reader.html'
    assert bundled_report.read_text(encoding='utf-8') == reader.browser_report(model, pdf)
    checks.append('Bundled offline inspection report matches the independent reader and needs no installed Python for the default specimen')
    native_pdf_text = run('--pdf-text', SAMPLE)
    assert native_pdf_text.returncode == 0
    assert native_pdf_text.stdout.decode().split() == model['sourceText'].split(), 'PDF text derivative mismatch'
    checks.append('PDFKit independently reads one PDF page and confirms the source-text derivative')
    assert len(model['interpretations']) == 2
    assert all(r['target'] == model['materialID'] for r in model['interpretations'])
    assert all(r['author']['kind'] == 'ai' for r in model['interpretations'])
    assert model['verification']['signatures'] == 'none'
    with tempfile.TemporaryDirectory(prefix='else-specimen-tests-') as folder_name:
        folder = Path(folder_name)
        before = reader.digest(SAMPLE.read_bytes())
        created = folder / 'Created.else'
        writer = subprocess.run([NODE, str(ROOT / 'web/test_writer.mjs'), str(ROOT / 'specimen/A-file-and-its-conversation.pdf'), str(created)], capture_output=True)
        assert writer.returncode == 0, writer.stderr.decode()
        created_model, created_pdf = reader.read_package(created)
        assert created_pdf == pdf and created_model['title'] == 'Local creation <img> ✓'
        assert [r['author']['kind'] for r in created_model['interpretations']] == ['human', 'ai']
        for inspect in (run, browser):
            result = inspect('--inspect', created)
            assert result.returncode == 0 and json.loads(result.stdout) == created_model, result.stderr.decode()
            result = inspect('--context', created)
            assert result.returncode == 0 and result.stdout.decode() == reader.ai_context(created_model), result.stderr.decode()
        assert 'experimental human contribution' in reader.ai_context(created_model)
        checks.append('Browser writer output independently opens in all three readers with mixed human and AI attribution, matching context and unchanged PDF bytes; 9 writer boundaries rejected')
        for label in ('python', 'swift', 'browser'):
            output = folder / (label + '.pdf')
            if label == 'python':
                reader.write_new(output, pdf)
            elif label == 'swift':
                response = run('--extract', SAMPLE, output)
                assert response.returncode == 0, response.stderr.decode()
            else:
                response = browser('--extract', SAMPLE, output)
                assert response.returncode == 0, response.stderr.decode()
            assert output.read_bytes() == pdf
            assert reader.digest(output.read_bytes()) == model['pdfSHA']
            assert output.suffix == '.pdf'
            assert b'Carry-like reading' not in output.read_bytes()
            assert b'Dear Elsewhere-like reading' not in output.read_bytes()
        output = folder / 'swift.pdf'
        output.write_bytes(b'External edited copy')
        response = run('--extract', SAMPLE, output)
        assert response.returncode != 0 and output.read_bytes() == b'External edited copy'
        output = folder / 'browser.pdf'
        output.write_bytes(b'External edited copy')
        response = browser('--extract', SAMPLE, output)
        assert response.returncode != 0 and output.read_bytes() == b'External edited copy'
        assert reader.digest(SAMPLE.read_bytes()) == before
        checks.append('Exact PDF extraction in all three readers, context-free payload, no overwrite and unchanged package after external edit')
        m = json.loads(original['manifest.json'])
        altered = dict(original)
        pdf_name = 'blobs/sha256/' + model['pdfSHA']
        altered[pdf_name] += b'changed'
        bad('changed-pdf', altered, folder)
        bad('renamed-hash-not-updated', indexed(altered), folder)
        missing = dict(original)
        del missing[pdf_name]
        bad('missing-pdf', indexed(missing), folder)
        bad('duplicate-entry', original, folder, duplicate=True)
        unsafe = dict(original)
        unsafe['../outside.pdf'] = pdf
        bad('unsafe-archive-path', indexed(unsafe), folder)
        private = dict(original)
        private_bytes = b'SYNTHETIC_PRIVATE_NOTE_DO_NOT_EXPORT'
        private['blobs/sha256/' + reader.digest(private_bytes)] = private_bytes
        bad('unselected-private-note', indexed(private), folder)
        mutated, new_ref = changed_record(original, m['material'], 'filename', '../outside.pdf')
        mutated['manifest.json'] = encode({**m, 'material': new_ref})
        bad('unsafe-export-name', indexed(mutated), folder)
        mutated, new_ref = changed_record(original, m['contexts'][1], 'target', '0' * 64)
        mutated['manifest.json'] = encode({**m, 'contexts': [m['contexts'][0], new_ref]})
        bad('wrong-interpretation-target', indexed(mutated), folder)
        duplicate_json = dict(original)
        duplicate_json['manifest.json'] = original['manifest.json'].replace(b'{', b'{"format":"other",', 1)
        bad('duplicate-json-key', indexed(duplicate_json), folder)
        escaped_duplicate = dict(original)
        escaped_duplicate['manifest.json'] = original['manifest.json'].replace(b'{', b'{"\\u0066ormat":"other",', 1)
        bad('escaped-duplicate-json-key', indexed(escaped_duplicate), folder)
        bom = dict(original)
        bom['manifest.json'] = b'\xef\xbb\xbf' + original['manifest.json']
        bad('json-with-unexpected-bom', indexed(bom), folder)
        capabilities = dict(original)
        capabilities['manifest.json'] = encode({**m, 'requiredCapabilities': ['unknown']})
        bad('unknown-required-capability', indexed(capabilities), folder)
        version = dict(original)
        version['manifest.json'] = encode({**m, 'version': '9.0'})
        bad('unknown-format-version', indexed(version), folder)
        signatures = dict(original)
        signatures['manifest.json'] = encode({**m, 'signatures': ['claimed-proof']})
        bad('unsupported-signature-claim', indexed(signatures), folder)
        deep = dict(original)
        deep['manifest.json'] = b'[' * 70 + b'0' + b']' * 70
        bad('excessive-json-depth', indexed(deep), folder)
        bad('compressed-archive', original, folder, compression=zipfile.ZIP_DEFLATED)
        bad('archive-symlink', original, folder, symlink=True)
        oversized = dict(original)
        oversized['blobs/sha256/' + '0' * 64] = b'0' * (reader.MAX_BLOB + 1)
        bad('oversized-blob', indexed(oversized), folder)
        forged_index = dict(original)
        index = json.loads(forged_index['integrity/files.json'])
        index['files']['mimetype']['bytes'] = True
        forged_index['integrity/files.json'] = encode(index)
        bad('boolean-byte-count', forged_index, folder)
        truncated = folder / 'truncated.else'
        truncated.write_bytes(SAMPLE.read_bytes()[:-1])
        try:
            reader.read_package(truncated)
        except ValueError:
            pass
        else:
            raise AssertionError('Python accepted truncated archive')
        assert run('--inspect', truncated).returncode != 0
        assert browser('--inspect', truncated).returncode != 0
        checks.append('truncated archive: all three readers reject')
        from browser_fixtures import write_fixtures
        changed = write_fixtures(folder / 'browser-fixtures')
        changed_model, changed_pdf = reader.read_package(changed)
        for response in [run('--inspect', changed), browser('--inspect', changed)]:
            assert response.returncode == 0 and json.loads(response.stdout) == changed_model
        assert browser('--context', changed).stdout.decode() == reader.ai_context(changed_model)
        assert changed_pdf == pdf and 'LOCAL_CONTEXT_SENTINEL' in reader.ai_context(changed_model)
        checks.append('Changed attributed Unicode readings recover identically without changing the original PDF')
        assert 'SYNTHETIC_PRIVATE_NOTE_DO_NOT_EXPORT' not in reader.ai_context(model)
        assert all(b'SYNTHETIC_PRIVATE_NOTE_DO_NOT_EXPORT' not in value for value in original.values())
    output = ROOT / 'output'
    output.mkdir(exist_ok=True)
    (output / 'checks.json').write_text(json.dumps({'passed': len(checks), 'checks': checks, 'pdfSHA256': model['pdfSHA'], 'packageSHA256': reader.digest(SAMPLE.read_bytes())}, indent=2) + '\n')
    print(f'{len(checks)} checks passed')


if __name__ == '__main__':
    main()
