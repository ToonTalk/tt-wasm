/* dzip_impl.cpp — a real implementation of the DynaZip write entry point (dzip) over zlib.
 *
 * The mirror of dunzip_impl.cpp. Everything ToonTalk WRITES into a PKZIP archive goes through
 * zip.cpp's wrappers, which fill a ZIPCMDSTRUCT and call dzip(): time-travel log segments and
 * city snapshots (log.cpp close_log / save_city_since_end_of_logging), the TimeTravelData
 * description XML, and saved cities/notebooks. As a zero-stub dzip returned ZE_OK without doing
 * anything, so recording a session produced log segments on disk but never an archive to hold
 * them — which is what made free-play time travel and "save the demo" impossible.
 *
 * Archives here are small (log segments a few KB, dozens of entries), so rather than splice a
 * ZIP in place this reads the whole archive into memory, mutates the entry list, and rewrites
 * it. Stored bytes are carried across untouched, so re-writing never re-compresses.
 *
 * Only the four functions the engine actually issues are implemented: ZIP_ADD, ZIP_DELETE,
 * ZIP_MEMTOFILE and ZIP_MEMTOFILE_STREAM.
 */
#include <cstdio>
#include <cstring>
#include <cstdlib>
#include <ctime>
#include <string>
#include <vector>
#include <dirent.h>
#include <sys/stat.h>
#include <zlib.h>
#include "windows.h"
#include "dzipdll.h"

extern "C" void tt_zip_forget_archive(const char *path); /* dunzip_impl.cpp */

namespace {

typedef std::vector<unsigned char> Bytes;

struct Member {
    std::string   name;      /* as stored in the archive */
    unsigned      method;    /* 0 = stored, 8 = deflate */
    unsigned long crc;
    unsigned long usize;
    Bytes         stored;    /* exactly the bytes that go in the file, already in `method` form */
    unsigned long dos_time;  /* packed DOS date+time, high word = date */
};

/* ---- little-endian helpers ---- */
unsigned long rd16(const unsigned char *p) { return (unsigned long)p[0] | ((unsigned long)p[1] << 8); }
unsigned long rd32(const unsigned char *p) {
    return (unsigned long)p[0] | ((unsigned long)p[1] << 8) | ((unsigned long)p[2] << 16) | ((unsigned long)p[3] << 24);
}
void put16(Bytes &b, unsigned v) { b.push_back((unsigned char)(v & 0xFF)); b.push_back((unsigned char)((v >> 8) & 0xFF)); }
void put32(Bytes &b, unsigned long v) {
    b.push_back((unsigned char)(v & 0xFF));        b.push_back((unsigned char)((v >> 8) & 0xFF));
    b.push_back((unsigned char)((v >> 16) & 0xFF)); b.push_back((unsigned char)((v >> 24) & 0xFF));
}

unsigned long dos_now() {
    time_t t = time(NULL);
    struct tm *lt = localtime(&t);
    if (lt == NULL || lt->tm_year < 80) return ((unsigned long)((1980 - 1980) << 9 | 1 << 5 | 1) << 16);
    unsigned date = (unsigned)(((lt->tm_year - 80) << 9) | ((lt->tm_mon + 1) << 5) | lt->tm_mday);
    unsigned tim  = (unsigned)((lt->tm_hour << 11) | (lt->tm_min << 5) | (lt->tm_sec / 2));
    return ((unsigned long)date << 16) | tim;
}

/* ---- name handling ----
 * The engine quotes names (zip.cpp quote_file_name) and may hand over several at once. Paths are
 * Windows-flavoured; the FS is not. */
char fold(char c) {
    if (c >= 'A' && c <= 'Z') return (char)(c + 32);
    if (c == '\\') return '/';
    return c;
}
std::string slashes(const std::string &s) {
    std::string out = s;
    for (size_t i = 0; i < out.size(); i++) if (out[i] == '\\') out[i] = '/';
    return out;
}
std::string basename_of(const std::string &s) {
    std::string p = slashes(s);
    size_t at = p.find_last_of('/');
    return at == std::string::npos ? p : p.substr(at + 1);
}
/* Entry names are stored without a leading slash or drive letter. */
std::string archive_name_for(const std::string &path, bool basename_only) {
    std::string n = basename_only ? basename_of(path) : slashes(path);
    while (!n.empty() && n[0] == '/') n.erase(0, 1);
    if (n.size() > 1 && n[1] == ':') n.erase(0, 2);
    while (!n.empty() && n[0] == '/') n.erase(0, 1);
    return n;
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
bool same_name(const std::string &a, const std::string &b) {
    if (a.size() != b.size()) return false;
    for (size_t i = 0; i < a.size(); i++) if (fold(a[i]) != fold(b[i])) return false;
    return true;
}

/* Split a (possibly quoted, possibly multi-entry) item list into individual paths. */
std::vector<std::string> split_items(const char *list) {
    std::vector<std::string> out;
    if (list == NULL) return out;
    const char *p = list;
    while (*p) {
        while (*p == ' ' || *p == '\t') p++;
        if (!*p) break;
        std::string one;
        if (*p == '"') {
            p++;
            while (*p && *p != '"') one += *p++;
            if (*p == '"') p++;
        } else {
            while (*p && *p != ' ' && *p != '\t') one += *p++;
        }
        if (!one.empty()) out.push_back(one);
    }
    return out;
}

/* ---- reading an existing archive ---- */
bool read_file(const std::string &path, Bytes &out) {
    FILE *f = fopen(path.c_str(), "rb");
    if (!f) return false;
    fseek(f, 0, SEEK_END); long len = ftell(f); fseek(f, 0, SEEK_SET);
    if (len < 0) { fclose(f); return false; }
    out.resize((size_t)len);
    size_t got = len > 0 ? fread(&out[0], 1, (size_t)len, f) : 0;
    fclose(f);
    out.resize(got);
    return true;
}

/* Parse into members, carrying compressed bytes across verbatim. A malformed or absent archive
 * simply yields an empty list — the engine's first ZIP_ADD then creates it. */
bool load_members(const std::string &path, std::vector<Member> &members) {
    members.clear();
    Bytes arc;
    if (!read_file(path, arc) || arc.size() < 22) return false;
    const unsigned char *buf = &arc[0];
    long len = (long)arc.size();
    long i = len - 22, stop = len - 22 - 65535; if (stop < 0) stop = 0;
    for (; i >= stop; i--) if (rd32(buf + i) == 0x06054b50UL) break;
    if (i < stop) return false;
    int n = (int)rd16(buf + i + 10);
    unsigned long cdofs = rd32(buf + i + 16);
    const unsigned char *p = buf + cdofs;
    for (int k = 0; k < n; k++) {
        if (p + 46 > buf + len || rd32(p) != 0x02014b50UL) return false;
        unsigned nlen = (unsigned)rd16(p + 28), xlen = (unsigned)rd16(p + 30), clen = (unsigned)rd16(p + 32);
        Member m;
        m.method   = (unsigned)rd16(p + 10);
        m.dos_time = rd32(p + 12);
        m.crc      = rd32(p + 16);
        unsigned long csize = rd32(p + 20);
        m.usize    = rd32(p + 24);
        unsigned long lho = rd32(p + 42);
        m.name.assign((const char *)(p + 46), nlen);
        /* local header: name and extra lengths can differ from the central copies */
        if (lho + 30 > (unsigned long)len || rd32(buf + lho) != 0x04034b50UL) return false;
        unsigned long lnlen = rd16(buf + lho + 26), lxlen = rd16(buf + lho + 28);
        unsigned long data = lho + 30 + lnlen + lxlen;
        if (data + csize > (unsigned long)len) return false;
        m.stored.assign(buf + data, buf + data + csize);
        members.push_back(m);
        p += 46 + nlen + xlen + clen;
    }
    return true;
}

/* ---- writing ---- */
bool write_members(const std::string &path, const std::vector<Member> &members) {
    Bytes out;
    std::vector<unsigned long> offsets(members.size(), 0);
    for (size_t k = 0; k < members.size(); k++) {
        const Member &m = members[k];
        offsets[k] = (unsigned long)out.size();
        put32(out, 0x04034b50UL);
        put16(out, 20);                       /* version needed */
        put16(out, 0);                        /* flags — sizes are in this header, no descriptor */
        put16(out, m.method);
        put32(out, m.dos_time);
        put32(out, m.crc);
        put32(out, (unsigned long)m.stored.size());
        put32(out, m.usize);
        put16(out, (unsigned)m.name.size());
        put16(out, 0);
        out.insert(out.end(), m.name.begin(), m.name.end());
        if (!m.stored.empty()) out.insert(out.end(), m.stored.begin(), m.stored.end());
    }
    unsigned long cdofs = (unsigned long)out.size();
    for (size_t k = 0; k < members.size(); k++) {
        const Member &m = members[k];
        put32(out, 0x02014b50UL);
        put16(out, 20);                       /* version made by */
        put16(out, 20);                       /* version needed */
        put16(out, 0);
        put16(out, m.method);
        put32(out, m.dos_time);
        put32(out, m.crc);
        put32(out, (unsigned long)m.stored.size());
        put32(out, m.usize);
        put16(out, (unsigned)m.name.size());
        put16(out, 0);                        /* extra */
        put16(out, 0);                        /* comment */
        put16(out, 0);                        /* disk */
        put16(out, 0);                        /* internal attrs */
        put32(out, 0);                        /* external attrs */
        put32(out, offsets[k]);
        out.insert(out.end(), m.name.begin(), m.name.end());
    }
    unsigned long cdsize = (unsigned long)out.size() - cdofs;
    put32(out, 0x06054b50UL);
    put16(out, 0); put16(out, 0);
    put16(out, (unsigned)members.size());
    put16(out, (unsigned)members.size());
    put32(out, cdsize);
    put32(out, cdofs);
    put16(out, 0);                            /* comment length */

    FILE *f = fopen(path.c_str(), "wb");
    if (!f) return false;
    size_t wrote = out.empty() ? 0 : fwrite(&out[0], 1, out.size(), f);
    fclose(f);
    tt_zip_forget_archive(path.c_str());      /* the reader caches by path */
    return wrote == out.size();
}

/* Compress into a member. compFactor 0 means "already compressed, just store it" — the engine
 * passes that when adding a city snapshot, which is itself a zip. */
void fill_member(Member &m, const unsigned char *data, size_t len, int compFactor) {
    m.usize = (unsigned long)len;
    m.crc   = (unsigned long)crc32(0L, data, (uInt)len);
    m.dos_time = dos_now();
    m.stored.clear();
    if (compFactor > 0 && len > 0) {
        z_stream zs;
        memset(&zs, 0, sizeof zs);
        int level = compFactor > 9 ? 9 : compFactor;
        if (deflateInit2(&zs, level, Z_DEFLATED, -15, 8, Z_DEFAULT_STRATEGY) == Z_OK) {
            unsigned long bound = deflateBound(&zs, (uLong)len) + 64;
            m.stored.resize((size_t)bound);
            zs.next_in   = (Bytef *)data;
            zs.avail_in  = (uInt)len;
            zs.next_out  = &m.stored[0];
            zs.avail_out = (uInt)bound;
            int r = deflate(&zs, Z_FINISH);
            unsigned long produced = bound - zs.avail_out;
            deflateEnd(&zs);
            if (r == Z_STREAM_END && produced < len) {   /* only keep it if it actually helped */
                m.stored.resize((size_t)produced);
                m.method = 8;
                return;
            }
            m.stored.clear();
        }
    }
    m.method = 0;
    if (len > 0) m.stored.assign(data, data + len);
}

int find_member(const std::vector<Member> &members, const std::string &name) {
    for (size_t k = 0; k < members.size(); k++) if (same_name(members[k].name, name)) return (int)k;
    return -1;
}

void set_member(std::vector<Member> &members, const std::string &name,
                const unsigned char *data, size_t len, int compFactor) {
    Member m;
    m.name = name;
    fill_member(m, data, len, compFactor);
    int at = find_member(members, name);
    if (at >= 0) members[(size_t)at] = m; else members.push_back(m);
}

/* Expand one item, which may end in a wildcard, into real file paths. */
void expand_item(const std::string &item, std::vector<std::string> &files) {
    std::string p = slashes(item);
    if (p.find('*') == std::string::npos && p.find('?') == std::string::npos) {
        FILE *f = fopen(p.c_str(), "rb");
        if (f) { fclose(f); files.push_back(p); }
        return;
    }
    size_t at = p.find_last_of('/');
    std::string dir = at == std::string::npos ? std::string(".") : p.substr(0, at);
    std::string pat = at == std::string::npos ? p : p.substr(at + 1);
    /* "*.*" is the DOS spelling of "everything", including names with no dot at all — the engine
     * uses it to sweep the temporary file cache into an archive. */
    bool everything = (pat == "*.*" || pat == "*");
    DIR *d = opendir(dir.c_str());
    if (d == NULL) return;
    struct dirent *e;
    while ((e = readdir(d)) != NULL) {
        if (strcmp(e->d_name, ".") == 0 || strcmp(e->d_name, "..") == 0) continue;
        if (!everything && !wild_match(pat.c_str(), e->d_name)) continue;
        std::string full = dir + "/" + e->d_name;
        struct stat st;
        if (stat(full.c_str(), &st) == 0 && S_ISREG(st.st_mode)) files.push_back(full);
    }
    closedir(d);
}

/* ---- ZIP_MEMTOFILE continuation state ----
 * open_zip_file() sets the entry name but does not call dzip; write_zip_file() then issues one
 * ZIP_MEMTOFILE per chunk and close_zip_file() just resets fields. So consecutive ZIP_MEMTOFILE
 * calls naming the same entry in the same archive are appends; anything else starts fresh. */
std::string g_last_archive;
std::string g_last_mem_name;
int         g_last_function = 0;

int g_log = 0;

} // namespace

extern "C" int FAR PASCAL dzip(LPZIPCMDSTRUCT z) {
    if (z == NULL || z->lpszZIPFile == NULL) return ZE_WRITE;
    std::string archive = slashes(z->lpszZIPFile);
    std::vector<Member> members;
    load_members(archive, members);           /* absent//empty archive -> start a new one */

    std::vector<std::string> items = split_items(z->lpszItemList);
    int result = ZE_OK;

    switch (z->function) {
        case ZIP_ADD: {
            bool basename_only = z->noDirectoryNamesFlag != 0;
            int added = 0;
            for (size_t i = 0; i < items.size(); i++) {
                std::vector<std::string> files;
                expand_item(items[i], files);
                for (size_t k = 0; k < files.size(); k++) {
                    Bytes data;
                    if (!read_file(files[k], data)) continue;
                    set_member(members, archive_name_for(files[k], basename_only),
                               data.empty() ? (const unsigned char *)"" : &data[0], data.size(),
                               z->compFactor);
                    added++;
                    if (z->deleteOriginalFlag) remove(files[k].c_str());
                }
            }
            if (added == 0) result = ZE_NONE;
            break;
        }
        case ZIP_DELETE: {
            for (size_t i = 0; i < items.size(); i++) {
                std::string pat = archive_name_for(items[i], false);
                for (size_t k = members.size(); k-- > 0; ) {
                    if (same_name(members[k].name, pat) ||
                        wild_match(pat.c_str(), members[k].name.c_str()) ||
                        same_name(members[k].name, basename_of(items[i]))) {
                        members.erase(members.begin() + (long)k);
                    }
                }
            }
            break;
        }
        case ZIP_MEMTOFILE: {
            if (items.empty() || z->lpMemBlock == NULL || z->lMemBlockSize < 0) { result = ZE_WRITE; break; }
            std::string name = archive_name_for(items[0], true);
            const unsigned char *src = (const unsigned char *)z->lpMemBlock;
            size_t len = (size_t)z->lMemBlockSize;
            bool continuing = (g_last_function == ZIP_MEMTOFILE &&
                               same_name(g_last_archive, archive) && same_name(g_last_mem_name, name));
            int at = find_member(members, name);
            if (continuing && at >= 0 && members[(size_t)at].method == 0) {
                /* append to what is already there — kept STORED while it is being built up */
                Member &m = members[(size_t)at];
                m.stored.insert(m.stored.end(), src, src + len);
                m.usize = (unsigned long)m.stored.size();
                m.crc = (unsigned long)crc32(0L, m.stored.empty() ? (const Bytef *)"" : &m.stored[0],
                                             (uInt)m.stored.size());
                m.dos_time = dos_now();
            } else {
                set_member(members, name, src, len, 0 /* store: more chunks may follow */);
            }
            g_last_mem_name = name;
            break;
        }
        case ZIP_MEMTOFILE_STREAM: {
            if (items.empty() || z->lpCallbackStruct == NULL ||
                z->lpCallbackStruct->lpMemToMemProc == NULL) { result = ZE_WRITE; break; }
            std::string name = archive_name_for(items[0], true);
            Bytes all;
            const DWORD chunk = 32768;
            std::vector<unsigned char> buf((size_t)chunk);
            long ret = MEM_CONTINUE;
            DWORD guard = 0;
            while (ret == MEM_CONTINUE && guard++ < 100000) {
                DWORD size = chunk;
                ret = MEM_CONTINUE;
                ((void (FAR PASCAL *)(long, LPVOID, DWORD *, DWORD, DWORD, DWORD, DWORD, LPVOID, long *))
                    z->lpCallbackStruct->lpMemToMemProc)
                    (MEM_READ_DATA, &buf[0], &size, (DWORD)all.size(), 0, (DWORD)all.size(), 0,
                     z->lpCallbackStruct->lpUserData, &ret);
                if (ret == MEM_ERROR) { result = ZE_WRITE; break; }
                if (size > chunk) size = chunk;
                if (size > 0) all.insert(all.end(), buf.begin(), buf.begin() + (size_t)size);
                if (ret == MEM_DONE) break;
            }
            if (result == ZE_OK) {
                set_member(members, name, all.empty() ? (const unsigned char *)"" : &all[0],
                           all.size(), z->compFactor);
            }
            break;
        }
        default:
            return ZE_OK;                     /* nothing else is issued on any path we support */
    }

    if (result == ZE_OK && !write_members(archive, members)) result = ZE_WRITE;

    g_last_archive  = archive;
    g_last_function = z->function;
    if (z->function != ZIP_MEMTOFILE) g_last_mem_name.clear();

    if (g_log < 30) { g_log++;
        printf("[tt] dzip: fn=%d archive='%s' items=%d members=%d -> %d\n",
               z->function, archive.c_str(), (int)items.size(), (int)members.size(), result);
        fflush(stdout);
    }
    return result;
}
