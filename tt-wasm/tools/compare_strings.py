"""Compare the SHIPPED string table (extracted from USVer22.dll) with the one the port serves
(shim/resstrings.js, generated from the .rc sources). The .rc is the development source; the DLL
is what ToonTalk actually shipped, so where they disagree the DLL wins."""
import json, re, io, sys

ship = {int(k): v for k, v in json.load(open('tools/shipped_strings.json')).items()}
src = io.open('shim/resstrings.js', encoding='utf-8').read()

port = {}
pat = re.compile(r'^\s*(\d+):\s*"((?:\\.|[^"\\])*)"', re.M)
for m in pat.finditer(src):
    port[int(m.group(1))] = m.group(2)

print('shipped DLL: %d   port resstrings.js: %d' % (len(ship), len(port)))

missing = sorted(set(ship) - set(port))
extra = sorted(set(port) - set(ship))
print('in DLL but NOT in port: %d' % len(missing))
for k in missing[:10]:
    print('   %5d  %r' % (k, ship[k][:60]))
print('in port but not in DLL: %d' % len(extra))


def unesc(s):
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c == '\\' and i + 1 < len(s):
            n = s[i + 1]
            out.append({'n': '\n', 'r': '', 't': '\t', '"': '"', "'": "'", '\\': '\\'}.get(n, n))
            i += 2
        else:
            out.append(c)
            i += 1
    return ''.join(out)


shared = sorted(set(ship) & set(port))
diff = [k for k in shared if ship[k].replace('\r', '').strip() != unesc(port[k]).replace('\r', '').strip()]
print('shared ids whose TEXT differs: %d of %d' % (len(diff), len(shared)))
for k in diff[:8]:
    print('   %5d  DLL=%r' % (k, ship[k][:46]))
    print('          port=%r' % (unesc(port[k])[:46],))
