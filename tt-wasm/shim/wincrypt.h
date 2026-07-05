/* <wincrypt.h> shim for the ToonTalk WASM port (phase 0).
 *
 * hash.cpp computes an MD5 of save files via the legacy CryptoAPI
 * (CryptAcquireContext / CryptCreateHash / CryptHashData / CryptGetHashParam).
 * Declarations + the handful of constants only; bodies are unresolved externals
 * in phase 0 (mapped to a JS/wasm MD5 later). */
#ifndef _WINCRYPT_SHIM_H_
#define _WINCRYPT_SHIM_H_

#include <windows.h>

typedef ULONG_PTR HCRYPTPROV;
typedef ULONG_PTR HCRYPTKEY;
typedef ULONG_PTR HCRYPTHASH;
typedef unsigned int ALG_ID;

/* provider types */
#ifndef PROV_RSA_FULL
#define PROV_RSA_FULL        1
#define PROV_RSA_AES         24
#endif

/* CryptAcquireContext dwFlags */
#ifndef CRYPT_VERIFYCONTEXT
#define CRYPT_VERIFYCONTEXT  0xF0000000
#define CRYPT_NEWKEYSET      0x00000008
#define CRYPT_SILENT         0x00000040
#endif

/* algorithm class / type bit-fields (just enough to build CALG_MD5). */
#ifndef ALG_CLASS_HASH
#define ALG_CLASS_HASH       (4 << 13)
#define ALG_TYPE_ANY         (0)
#define ALG_SID_MD5          3
#define ALG_SID_SHA1         4
#endif
#ifndef CALG_MD5
#define CALG_MD5  (ALG_CLASS_HASH | ALG_TYPE_ANY | ALG_SID_MD5)
#define CALG_SHA1 (ALG_CLASS_HASH | ALG_TYPE_ANY | ALG_SID_SHA1)
#endif

/* CryptGetHashParam dwParam selectors */
#ifndef HP_HASHVAL
#define HP_ALGID    0x0001
#define HP_HASHVAL  0x0002
#define HP_HASHSIZE 0x0004
#endif

#ifdef __cplusplus
extern "C" {
#endif

BOOL CryptAcquireContextA(HCRYPTPROV *phProv, LPCSTR szContainer, LPCSTR szProvider, DWORD dwProvType, DWORD dwFlags);
BOOL CryptReleaseContext(HCRYPTPROV hProv, DWORD dwFlags);
BOOL CryptCreateHash(HCRYPTPROV hProv, ALG_ID Algid, HCRYPTKEY hKey, DWORD dwFlags, HCRYPTHASH *phHash);
BOOL CryptHashData(HCRYPTHASH hHash, const BYTE *pbData, DWORD dwDataLen, DWORD dwFlags);
BOOL CryptGetHashParam(HCRYPTHASH hHash, DWORD dwParam, BYTE *pbData, DWORD *pdwDataLen, DWORD dwFlags);
BOOL CryptDestroyHash(HCRYPTHASH hHash);

#ifdef __cplusplus
}
#endif

#ifndef CryptAcquireContext
#define CryptAcquireContext CryptAcquireContextA
#endif

#endif /* _WINCRYPT_SHIM_H_ */
