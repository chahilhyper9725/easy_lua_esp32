#include <Arduino.h>
#include <cassert>

#include "lua.hpp"

lua_State *L;

static int
lua_millis(lua_State *L)
{
	lua_pushinteger(L, millis());
	return 1;
}


// lua vm debug callback to avoid watchdog bites
static void debug_hook(lua_State *state, lua_Debug *dbg){
	(void)state;
	(void)dbg;

	yield();
}

void setup(){
	Serial.begin(115200);

	L = luaL_newstate();
	assert(L != nullptr);
	lua_sethook(L, debug_hook, LUA_MASKCOUNT, 50000);
	luaL_openlibs(L);
	lua_register(L, "millis", lua_millis);
}

void loop(){
	luaL_dostring(L, "print(millis())");
	delay(1000);
}
