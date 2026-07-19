/* dunzip_impl.cpp — a real implementation of the DynaZip unzip entry point (dunzip) over zlib.
 *
 * Every ToonTalk save file (.xml.cty cities, .xml.tt gadgets, <user>.bok.xml notebooks,
 * <user>.<n>.xml notebook pages) is a PKZIP archive holding "data.xml" (+ media). The engine
 * funnels ALL reading through zip.cpp's wrappers, which fill a DynaZip UNZIPCMDSTRUCT and call
 * dunzip() — previously a zero-stub, so every save-file load silently produced nothing.
 *
 * Minimal ZIP reader: scan the End-Of-Central-Directory record, parse the central directory,
 * select a member by (quoted) name or by index, inflate it (raw deflate via zlib, -15 window)
 * or copy if stored. The engine reads members INCREMENTALLY (lStartingOffset advances a few
 * bytes per call — length-prefixed strings), so the whole uncompressed member is cached and
 * reused while archive+member stay the same. Zip WRITING (dzip) remains stubbed for now.
 */
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <sys/stat.h>
#include <zlib.h>
#include "dunzdll.h"

namespace {

struct Entry { char name[300]; unsigned method; unsigned long csize, usize, lho; };

unsigned long rd16(const unsigned char *p) { return (unsigned long)p[0] | ((unsigned long)p[1] << 8); }
unsigned long rd32(const unsigned char *p) {
    return (unsigned long)p[0] | ((unsigned long)p[1] << 8) | ((unsigned long)p[2] << 16) | ((unsigned long)p[3] << 24);
}

/* ---- archive cache (file bytes + parsed central directory) ---- */
char g_arc_path[512] = {0};
unsigned char *g_arc = nullptr;
long g_arc_len = 0;
Entry *g_entries = nullptr;
int g_entry_count = 0;

/* ---- member cache (uncompressed contents) ---- */
char g_mem_name[300] = {0};
unsigned char *g_mem = nullptr;
unsigned long g_mem_size = 0;

void drop_member() { free(g_mem); g_mem = nullptr; g_mem_size = 0; g_mem_name[0] = 0; }
void drop_archive() {
    free(g_arc); g_arc = nullptr; g_arc_len = 0;
    free(g_entries); g_entries = nullptr; g_entry_count = 0;
    g_arc_path[0] = 0;
    drop_member();
}

bool load_archive(const char *path) {
    if (g_arc && strcmp(path, g_arc_path) == 0) return true;
    drop_archive();
    FILE *f = fopen(path, "rb");
    if (!f) return false;
    fseek(f, 0, SEEK_END); long len = ftell(f); fseek(f, 0, SEEK_SET);
    if (len < 22) { fclose(f); return false; }
    unsigned char *buf = (unsigned char *)malloc(len);
    if (!buf || fread(buf, 1, len, f) != (size_t)len) { free(buf); fclose(f); return false; }
    fclose(f);
    /* EOCD scan (comment can pad up to 64K) */
    long i = len - 22, stop = len - 22 - 65535; if (stop < 0) stop = 0;
    for (; i >= stop; i--) if (rd32(buf + i) == 0x06054b50UL) break;
    if (i < stop) { free(buf); return false; }
    int n = (int)rd16(buf + i + 10);
    unsigned long cdofs = rd32(buf + i + 16);
    Entry *es = (Entry *)calloc(n > 0 ? n : 1, sizeof(Entry));
    const unsigned char *p = buf + cdofs;
    for (int k = 0; k < n; k++) {
        if (p + 46 > buf + len || rd32(p) != 0x02014b50UL) { free(es); free(buf); return false; }
        unsigned nlen = (unsigned)rd16(p + 28), xlen = (unsigned)rd16(p + 30), clen = (unsigned)rd16(p + 32);
        es[k].method = (unsigned)rd16(p + 10);
        es[k].csize = rd32(p + 20); es[k].usize = rd32(p + 24);
        es[k].lho = rd32(p + 42);
        unsigned c = nlen < 299 ? nlen : 299;
        memcpy(es[k].name, p + 46, c); es[k].name[c] = 0;
        p += 46 + nlen + xlen + clen;
    }
    g_arc = buf; g_arc_len = len; g_entries = es; g_entry_count = n;
    strncpy(g_arc_path, path, sizeof(g_arc_path) - 1);
    return true;
}

/* case-insensitive wildcard match ('*' = any run, '?' = any char; '\' and '/' equivalent);
 * the engine quotes names (quote_file_name), so strip quotes. "*.*" matches names without
 * dots too (DOS convention). */
char fold(char c) {
    if (c >= 'A' && c <= 'Z') return (char)(c + 32);
    if (c == '\\') return '/';
    return c;
}
bool wild_match(const char *pat, const char *name) {
    if (*pat == 0) return *name == 0;
    if (*pat == '*') {
        for (const char *n = name; ; n++) {
            if (wild_match(pat + 1, n)) return true;
            if (*n == 0) return false;
        }
    }
    if (*name == 0) return false;
    if (*pat == '?' || fold(*pat) == fold(*name)) return wild_match(pat + 1, name + 1);
    return false;
}
bool name_match(const char *pat, const char *name) {
    char clean[300]; int j = 0;
    for (const char *s = pat; *s && j < 299; s++) if (*s != '"') clean[j++] = *s;
    clean[j] = 0;
    if (strcmp(clean, "*") == 0 || strcmp(clean, "*.*") == 0) return true;
    /* DOS "x\*.*" idiom: also accept dotless names under x\ */
    int len = j;
    if (len >= 4 && strcmp(clean + len - 4, "*.*") == 0) clean[len - 2] = 0;   /* "...*.*" -> "...*" */
    return wild_match(clean, name);
}

int find_member(const char *spec, unsigned index) {
    if (spec && spec[0]) {
        for (int k = 0; k < g_entry_count; k++) if (name_match(spec, g_entries[k].name)) return k;
        return -1;
    }
    return (index < (unsigned)g_entry_count) ? (int)index : -1;
}

bool extract_member(int k) {
    const Entry &e = g_entries[k];
    if (g_mem && strcmp(g_mem_name, e.name) == 0) return true;
    drop_member();
    const unsigned char *p = g_arc + e.lho;
    if (p + 30 > g_arc + g_arc_len || rd32(p) != 0x04034b50UL) return false;
    unsigned nlen = (unsigned)rd16(p + 26), xlen = (unsigned)rd16(p + 28);
    const unsigned char *data = p + 30 + nlen + xlen;
    if (data + e.csize > g_arc + g_arc_len) return false;
    unsigned char *out = (unsigned char *)malloc(e.usize ? e.usize : 1);
    if (!out) return false;
    if (e.method == 0) {
        memcpy(out, data, e.usize);
    } else if (e.method == 8) {
        z_stream zs; memset(&zs, 0, sizeof zs);
        if (inflateInit2(&zs, -15) != Z_OK) { free(out); return false; }
        zs.next_in = (Bytef *)data; zs.avail_in = e.csize;
        zs.next_out = out; zs.avail_out = e.usize;
        int r = inflate(&zs, Z_FINISH);
        inflateEnd(&zs);
        if (r != Z_STREAM_END && !(r == Z_OK && zs.avail_out == 0)) { free(out); return false; }
    } else {
        free(out); return false;
    }
    g_mem = out; g_mem_size = e.usize;
    strncpy(g_mem_name, e.name, sizeof(g_mem_name) - 1);
    return true;
}

} // namespace

static int dz_log = 0;
extern "C" int dunzip(LPUNZIPCMDSTRUCT u) {
    if (!u || !u->lpszZIPFile) return UE_NOFILE;
    if (dz_log < 80) { dz_log++;
        printf("[tt] dunzip: fn=%d zip='%s' spec='%s' idx=%lu off=%ld size=%ld\n",
               (int)u->function, u->lpszZIPFile, u->lpszFilespec ? u->lpszFilespec : "(null)",
               (unsigned long)u->index, (long)u->lStartingOffset, (long)u->lMemBlockSize);
        fflush(stdout);
    }
    if (!load_archive(u->lpszZIPFile)) {
        if (dz_log <= 80) { printf("[tt] dunzip: ARCHIVE OPEN FAILED '%s'\n", u->lpszZIPFile); fflush(stdout); }
        return UE_NOFILE;
    }
    switch (u->function) {
        case UNZIP_COUNTALLZIPMEMBERS:
            u->returnCount = g_entry_count;
            return UE_OK;
        case UNZIP_COUNTNAMEDZIPMEMBERS: {
            int c = 0;
            for (int k = 0; k < g_entry_count; k++)
                if (u->lpszFilespec && name_match(u->lpszFilespec, g_entries[k].name)) c++;
            u->returnCount = c;
            return c > 0 ? UE_OK : UE_NOFILE;
        }
        case UNZIP_GETNEXTNAMEDZIPINFO:
        case UNZIP_GETINDEXEDZIPINFO: {
            int k = (u->function == UNZIP_GETINDEXEDZIPINFO)
                        ? find_member(nullptr, u->index)
                        : find_member(u->lpszFilespec, 0);
            if (k < 0) return UE_NOFILE;
            if (u->pZinfoEx) {
                memset(u->pZinfoEx, 0, sizeof(*u->pZinfoEx));
                u->pZinfoEx->ulSize = g_entries[k].usize;
                u->pZinfoEx->uloSizeLowPart = g_entries[k].usize; /* zip.cpp reads THIS field for sizes */
                u->pZinfoEx->ulindex = (DWORD)k;
                strncpy(u->pZinfoEx->szFileName, g_entries[k].name, MAX_PATH - 1);
            }
            return UE_OK;
        }
        case UNZIP_EXTRACT: {
            /* extract matching members to lpszDestination (the private media directory —
             * user pictures/sounds inside notebook zips live under "Media\..."; without this
             * every media picture rendered black/invisible, e.g. the Pong game's background
             * and ball). noDirectoryNamesFlag drops the archive's path components. */
            if (!u->lpszDestination) return UE_NOFILE;
            char destdir[600];
            size_t dl = 0;
            for (const char *d = u->lpszDestination; *d && dl < 570; d++) destdir[dl++] = (*d == '\\') ? '/' : *d;
            if (dl > 0 && destdir[dl-1] != '/') destdir[dl++] = '/';
            destdir[dl] = 0;
            int wrote = 0, matched = 0;
            for (int k = 0; k < g_entry_count; k++) {
                if (!u->lpszFilespec || !u->lpszFilespec[0] || name_match(u->lpszFilespec, g_entries[k].name)) {
                    matched++;
                    if (g_entries[k].name[0] == 0) continue;
                    if (g_entries[k].name[strlen(g_entries[k].name)-1] == '/') continue; /* directory entry */
                    if (!extract_member(k)) continue;
                    /* output name: strip path components when asked (the engine passes
                     * preserve_path_names=FALSE for media) */
                    const char *nm = g_entries[k].name;
                    if (u->noDirectoryNamesFlag) {
                        for (const char *s = nm; *s; s++) if (*s == '/' || *s == '\\') nm = s + 1;
                    }
                    char path[900];
                    size_t pl = dl;
                    memcpy(path, destdir, dl);
                    for (const char *s = nm; *s && pl < 890; s++) path[pl++] = (*s == '\\') ? '/' : *s;
                    path[pl] = 0;
                    /* ensure intermediate dirs exist (when preserving paths) */
                    for (size_t i = dl; i < pl; i++) {
                        if (path[i] == '/') { path[i] = 0; mkdir(path, 0777); path[i] = '/'; }
                    }
                    if (!u->overWriteFlag) {
                        FILE *probe = fopen(path, "rb");
                        if (probe) { fclose(probe); continue; }
                    }
                    FILE *out = fopen(path, "wb");
                    if (!out) continue;
                    fwrite(g_mem, 1, g_mem_size, out);
                    fclose(out);
                    wrote++;
                }
            }
            if (dz_log <= 80) {
                printf("[tt] dunzip: EXTRACT matched=%d wrote=%d -> '%s'\n", matched, wrote, destdir); fflush(stdout);
            }
            return matched > 0 ? UE_OK : UE_NOFILE;
        }
        case UNZIP_FILETOMEM: {
            int k = find_member(u->lpszFilespec, u->index);
            if (k < 0) return UE_NOFILE;
            if (!extract_member(k)) return UE_OUTPUT;
            long off = u->lStartingOffset;
            if (off < 0 || (unsigned long)off >= g_mem_size + (g_mem_size == 0 ? 1 : 0)) {
                if (!(off == 0 && g_mem_size == 0)) return UE_SKIP;
            }
            long want = u->lMemBlockSize;
            if (!u->lpMemBlock || want < 0) return UE_MEM;
            if ((unsigned long)off + (unsigned long)want > g_mem_size) return UE_SKIP; /* engine reads exact lengths */
            memcpy(u->lpMemBlock, g_mem + off, (size_t)want);
            return UE_OK;
        }
        default:
            return UE_SKIP;
    }
}
