/* <Rpcdce.h> shim for the ToonTalk WASM port (phase 0, compile-only).
 *
 * defs.h pulls this in (under TT_DIRECT_PLAY) for UUID/GUID generation used to
 * tag networked nests. We provide UUID == GUID and the UuidCreate API. Bodies
 * linked later. NB: the include in defs.h is "Rpcdce.h" with this exact casing;
 * keep the filename matching so it resolves on case-sensitive lookups too. */
#ifndef _RPCDCE_SHIM_H_
#define _RPCDCE_SHIM_H_

#include <windows.h>

typedef GUID UUID, *PUUID;
typedef long RPC_STATUS;

#ifndef RPC_S_OK
#define RPC_S_OK 0
#endif

RPC_STATUS UuidCreate(UUID *Uuid);
RPC_STATUS UuidCreateSequential(UUID *Uuid);
RPC_STATUS UuidToStringA(UUID *Uuid, unsigned char **StringUuid);
RPC_STATUS UuidFromStringA(unsigned char *StringUuid, UUID *Uuid);
RPC_STATUS RpcStringFreeA(unsigned char **String);
/* ANSI/Unicode-neutral aliases (TT_UNICODE is 0, so map onto the A variants). */
#define UuidToString   UuidToStringA
#define UuidFromString UuidFromStringA
#define RpcStringFree  RpcStringFreeA
int        UuidCompare(UUID *Uuid1, UUID *Uuid2, RPC_STATUS *Status);
int        UuidEqual(UUID *Uuid1, UUID *Uuid2, RPC_STATUS *Status);
int        UuidIsNil(UUID *Uuid, RPC_STATUS *Status);

#endif /* _RPCDCE_SHIM_H_ */
