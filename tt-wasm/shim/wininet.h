/* <wininet.h> shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * ToonTalk uses the WinInet API for reading URLs (URLFile in file.cpp), the
 * WinInet URL cache (file.cpp), and FTP upload (ftp.cpp / ttftp.cpp). None of
 * the three phase-0 object targets (number/cubby/robot) actually call these,
 * but globals.h pulls <wininet.h> in unconditionally, so the surface has to
 * parse. Declarations only; real bodies are linked later (phase 1 maps these
 * onto fetch()/XHR or stubs them out). */
#ifndef _WININET_SHIM_H_
#define _WININET_SHIM_H_

#include <windows.h>

/* HINTERNET is just an opaque handle in the real API too. */
typedef LPVOID HINTERNET;
typedef HINTERNET *LPHINTERNET;

/* TCP port number type used by InternetConnect. */
typedef WORD INTERNET_PORT;

/* ---- InternetOpen access types ---- */
#define INTERNET_OPEN_TYPE_PRECONFIG                   0
#define INTERNET_OPEN_TYPE_DIRECT                      1
#define INTERNET_OPEN_TYPE_PROXY                       3

/* ---- well-known ports / services ---- */
#define INTERNET_DEFAULT_FTP_PORT                      21
#define INTERNET_DEFAULT_HTTP_PORT                     80
#define INTERNET_DEFAULT_HTTPS_PORT                    443

#define INTERNET_SERVICE_FTP                           1
#define INTERNET_SERVICE_GOPHER                        2
#define INTERNET_SERVICE_HTTP                          3

/* ---- common request / open flags ---- */
#define INTERNET_FLAG_RELOAD                           0x80000000
#define INTERNET_FLAG_EXISTING_CONNECT                 0x20000000
#define INTERNET_FLAG_NO_CACHE_WRITE                   0x04000000
#define INTERNET_FLAG_KEEP_CONNECTION                  0x00400000

/* ---- FTP transfer types ---- */
#define FTP_TRANSFER_TYPE_UNKNOWN                      0x00000000
#define FTP_TRANSFER_TYPE_ASCII                        0x00000001
#define FTP_TRANSFER_TYPE_BINARY                       0x00000002

/* ---- HTTP status codes referenced by ToonTalk ---- */
#define HTTP_STATUS_BAD_REQUEST                        400
#define HTTP_STATUS_DENIED                             401
#define HTTP_STATUS_FORBIDDEN                          403
#define HTTP_STATUS_NOT_FOUND                          404
#define HTTP_STATUS_SERVER_ERROR                       500
#define HTTP_STATUS_NOT_SUPPORTED                      501

/* ---- WinInet error codes (INTERNET_ERROR_BASE == 12000) ---- */
#define INTERNET_ERROR_BASE                            12000
#define ERROR_INTERNET_OUT_OF_HANDLES                  (INTERNET_ERROR_BASE + 1)
#define ERROR_INTERNET_TIMEOUT                         (INTERNET_ERROR_BASE + 2)
#define ERROR_INTERNET_EXTENDED_ERROR                  (INTERNET_ERROR_BASE + 3)
#define ERROR_INTERNET_INTERNAL_ERROR                  (INTERNET_ERROR_BASE + 4)
#define ERROR_INTERNET_NAME_NOT_RESOLVED               (INTERNET_ERROR_BASE + 13)
#define ERROR_INTERNET_PROTOCOL_NOT_FOUND              (INTERNET_ERROR_BASE + 14)
#define ERROR_FTP_TRANSFER_IN_PROGRESS                 (INTERNET_ERROR_BASE + 110)
#define ERROR_FTP_DROPPED                              (INTERNET_ERROR_BASE + 111)

/* ---- URL-cache SetUrlCacheEntryInfo field-control flags ---- */
#define CACHE_ENTRY_ATTRIBUTE_FC                       0x00000004
#define CACHE_ENTRY_HITRATE_FC                         0x00000010
#define CACHE_ENTRY_MODTIME_FC                         0x00000040
#define CACHE_ENTRY_EXPTIME_FC                         0x00000080
#define CACHE_ENTRY_ACCTIME_FC                         0x00000100
#define CACHE_ENTRY_SYNCTIME_FC                        0x00000200

/* ---- URL cache entry info structure (subset of fields used by file.cpp) ---- */
typedef struct _INTERNET_CACHE_ENTRY_INFOA {
    DWORD     dwStructSize;
    LPSTR     lpszSourceUrlName;
    LPSTR     lpszLocalFileName;
    DWORD     CacheEntryType;
    DWORD     dwUseCount;
    DWORD     dwHitRate;
    DWORD     dwSizeLow;
    DWORD     dwSizeHigh;
    FILETIME  LastModifiedTime;
    FILETIME  ExpireTime;
    FILETIME  LastAccessTime;
    FILETIME  LastSyncTime;
    LPSTR     lpHeaderInfo;
    DWORD     dwHeaderInfoSize;
    LPSTR     lpszFileExtension;
    union {
        DWORD dwReserved;
        DWORD dwExemptDelta;
    };
} INTERNET_CACHE_ENTRY_INFOA, *LPINTERNET_CACHE_ENTRY_INFOA;
#define INTERNET_CACHE_ENTRY_INFO    INTERNET_CACHE_ENTRY_INFOA
#define LPINTERNET_CACHE_ENTRY_INFO  LPINTERNET_CACHE_ENTRY_INFOA

/* ---- connection / session ---- */
HINTERNET InternetOpenA(LPCSTR lpszAgent, DWORD dwAccessType, LPCSTR lpszProxy,
                        LPCSTR lpszProxyBypass, DWORD dwFlags);
#define InternetOpen InternetOpenA

HINTERNET InternetConnectA(HINTERNET hInternet, LPCSTR lpszServerName,
                           INTERNET_PORT nServerPort, LPCSTR lpszUserName,
                           LPCSTR lpszPassword, DWORD dwService, DWORD dwFlags,
                           DWORD_PTR dwContext);
#define InternetConnect InternetConnectA

HINTERNET InternetOpenUrlA(HINTERNET hInternet, LPCSTR lpszUrl, LPCSTR lpszHeaders,
                           DWORD dwHeadersLength, DWORD dwFlags, DWORD_PTR dwContext);
#define InternetOpenUrl InternetOpenUrlA

BOOL InternetCloseHandle(HINTERNET hInternet);

BOOL InternetReadFile(HINTERNET hFile, LPVOID lpBuffer, DWORD dwNumberOfBytesToRead,
                      LPDWORD lpdwNumberOfBytesRead);

BOOL InternetQueryDataAvailable(HINTERNET hFile, LPDWORD lpdwNumberOfBytesAvailable,
                                DWORD dwFlags, DWORD_PTR dwContext);

BOOL InternetGetLastResponseInfoA(LPDWORD lpdwError, LPSTR lpszBuffer,
                                  LPDWORD lpdwBufferLength);
#define InternetGetLastResponseInfo InternetGetLastResponseInfoA

/* ---- FTP ---- */
BOOL FtpPutFileA(HINTERNET hConnect, LPCSTR lpszLocalFile, LPCSTR lpszNewRemoteFile,
                 DWORD dwFlags, DWORD_PTR dwContext);
#define FtpPutFile FtpPutFileA

BOOL FtpSetCurrentDirectoryA(HINTERNET hConnect, LPCSTR lpszDirectory);
#define FtpSetCurrentDirectory FtpSetCurrentDirectoryA

/* ---- URL cache ---- */
BOOL GetUrlCacheEntryInfoA(LPCSTR lpszUrlName, LPINTERNET_CACHE_ENTRY_INFOA lpCacheEntryInfo,
                           LPDWORD lpdwCacheEntryInfoBufferSize);
#define GetUrlCacheEntryInfo GetUrlCacheEntryInfoA

BOOL SetUrlCacheEntryInfoA(LPCSTR lpszUrlName, LPINTERNET_CACHE_ENTRY_INFOA lpCacheEntryInfo,
                           DWORD dwFieldControl);
#define SetUrlCacheEntryInfo SetUrlCacheEntryInfoA

BOOL RetrieveUrlCacheEntryFileA(LPCSTR lpszUrlName, LPINTERNET_CACHE_ENTRY_INFOA lpCacheEntryInfo,
                                LPDWORD lpdwCacheEntryInfoBufferSize, DWORD dwReserved);
#define RetrieveUrlCacheEntryFile RetrieveUrlCacheEntryFileA

HANDLE FindFirstUrlCacheEntryA(LPCSTR lpszUrlSearchPattern,
                               LPINTERNET_CACHE_ENTRY_INFOA lpFirstCacheEntryInfo,
                               LPDWORD lpdwFirstCacheEntryInfoBufferSize);
#define FindFirstUrlCacheEntry FindFirstUrlCacheEntryA

BOOL FindNextUrlCacheEntryA(HANDLE hEnumHandle,
                            LPINTERNET_CACHE_ENTRY_INFOA lpNextCacheEntryInfo,
                            LPDWORD lpdwNextCacheEntryInfoBufferSize);
#define FindNextUrlCacheEntry FindNextUrlCacheEntryA

BOOL FindCloseUrlCache(HANDLE hEnumHandle);
BOOL DeleteUrlCacheEntryA(LPCSTR lpszUrlName);
#define DeleteUrlCacheEntry DeleteUrlCacheEntryA

/* file.cpp reserves a cache slot (CreateUrlCacheEntry) for a downloaded URL, then
 * commits the local copy (CommitUrlCacheEntry). */
BOOL CreateUrlCacheEntryA(LPCSTR lpszUrlName, DWORD dwExpectedFileSize,
                          LPCSTR lpszFileExtension, LPSTR lpszFileName, DWORD dwReserved);
#define CreateUrlCacheEntry CreateUrlCacheEntryA

BOOL CommitUrlCacheEntryA(LPCSTR lpszUrlName, LPCSTR lpszLocalFileName,
                          FILETIME ExpireTime, FILETIME LastModifiedTime,
                          DWORD CacheEntryType, LPBYTE lpHeaderInfo, DWORD dwHeaderSize,
                          LPCSTR lpszFileExtension, LPCSTR lpszOriginalUrl);
#define CommitUrlCacheEntry CommitUrlCacheEntryA

/* CacheEntryType bits (file.cpp commits with NORMAL_CACHE_ENTRY). */
#ifndef NORMAL_CACHE_ENTRY
#define NORMAL_CACHE_ENTRY      0x00000001
#define STICKY_CACHE_ENTRY      0x00000004
#define EDITED_CACHE_ENTRY      0x00000008
#define TRACK_OFFLINE_CACHE_ENTRY 0x00000010
#define TRACK_ONLINE_CACHE_ENTRY  0x00000020
#define SPARSE_CACHE_ENTRY      0x00010000
#define COOKIE_CACHE_ENTRY      0x00100000
#define URLHISTORY_CACHE_ENTRY  0x00200000
#endif

#endif /* _WININET_SHIM_H_ */
