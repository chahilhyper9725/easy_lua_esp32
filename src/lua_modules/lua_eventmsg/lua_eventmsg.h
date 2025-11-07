#pragma once

#include "../../core/lua_engine.h"
#include "../../core/event_msg.h"
#include <map>
#include <vector>
#include <string>

// Lua EventMsg module - wrapper around C event_msg system
void lua_eventmsg_init();
void lua_eventmsg_register(lua_State* L);
void lua_eventmsg_cleanup();