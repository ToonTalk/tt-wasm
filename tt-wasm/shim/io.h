/* <io.h> shim for the ToonTalk WASM port (phase 0).
 *
 * The MSVC low-level POSIX-ish file API. log.cpp uses _open/_read/_write/_close.
 * musl/emscripten ships these without the leading underscore in <fcntl.h> /
 * <unistd.h>, so alias the MSVC names onto the POSIX ones. */
#ifndef _IO_SHIM_H_
#define _IO_SHIM_H_

#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>
#include <sys/stat.h>

#ifndef _open
#define _open    open
#define _close   close
#define _read    read
#define _write   write
#define _lseek   lseek
#define _access  access
#define _unlink  unlink
#define _dup     dup
#define _dup2    dup2
#define _fileno  fileno
#define _isatty  isatty
#endif

/* MSVC _O_* open-mode flags map onto the POSIX O_* macros from <fcntl.h>. */
#ifndef _O_RDONLY
#define _O_RDONLY  O_RDONLY
#define _O_WRONLY  O_WRONLY
#define _O_RDWR    O_RDWR
#define _O_APPEND  O_APPEND
#define _O_CREAT   O_CREAT
#define _O_TRUNC   O_TRUNC
#define _O_EXCL    O_EXCL
#endif
#ifndef _O_BINARY
#define _O_BINARY  0   /* no text/binary distinction on POSIX */
#define _O_TEXT    0
#endif

#endif /* _IO_SHIM_H_ */
