/* DirectInput device GUIDs + data-format descriptors referenced by input.cpp.
 * DirectInput is replaced by DOM mouse/keyboard events in the browser, so these
 * are placeholder/zero stubs that only need to exist for the link. */
#include "windows.h"
#include "dinput.h"

extern const GUID IID_IDirectInputDevice2 = { 0, 0, 0, { 0, 0, 0, 0, 0, 0, 0, 0 } };
extern const GUID GUID_SysMouse          = { 0, 0, 0, { 0, 0, 0, 0, 0, 0, 0, 0 } };
extern const DIDATAFORMAT c_dfDIMouse    = {};
extern const DIDATAFORMAT c_dfDIJoystick = {};
