#include "lua_eventmsg.h"
#include "../../core/utils/debug.h"
#include <Arduino.h>
#include <set>

// ═══════════════════════════════════════════════════════
// INTERNAL STATE
// ═══════════════════════════════════════════════════════

// Storage for Lua callbacks
struct EventCallback {
    lua_State* L;
    int functionRef;
};

static std::map<std::string, std::vector<EventCallback>> eventCallbacks;
static lua_State* mainLuaState = nullptr;

// Set of event names we're listening for
static std::set<std::string> registeredEvents;

// Pending events queue
struct PendingEvent {
    String eventName;
    String data;
};

static QueueHandle_t pendingQueue = nullptr;

// ═══════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════

// Convert Lua value to string
static String lua_value_to_data(lua_State* L, int index) {
    if (lua_isstring(L, index)) {
        size_t len;
        const char* str = lua_tolstring(L, index, &len);
        return String(str);
    } else if (lua_isnumber(L, index)) {
        return String(lua_tonumber(L, index));
    } else if (lua_isboolean(L, index)) {
        return lua_toboolean(L, index) ? "true" : "false";
    } else if (lua_isnil(L, index)) {
        return "";
    }
    return "";
}

// Universal event handler - catches events we've registered for
static void handleIncomingEvent(const String& eventName, const std::vector<uint8_t>& data) {
    // Check if this is an event we're listening for
    if (registeredEvents.find(eventName.c_str()) == registeredEvents.end()) {
        return;  // Not our event
    }

    if (!pendingQueue) return;

    // Allocate pending event
    PendingEvent* evPtr = new PendingEvent();
    evPtr->eventName = eventName;
    evPtr->data = "";

    // Convert data to String
    for (uint8_t byte : data) {
        evPtr->data += (char)byte;
    }

    // Try to enqueue
    if (xQueueSend(pendingQueue, &evPtr, 0) != pdTRUE) {
        // Queue full, drop oldest then retry
        PendingEvent* tmpPtr;
        if (xQueueReceive(pendingQueue, &tmpPtr, 0) == pdTRUE) {
            delete tmpPtr;
        }
        // Retry once
        if (xQueueSend(pendingQueue, &evPtr, 0) != pdTRUE) {
            delete evPtr;
        }
    }
}

// Process pending events and call Lua callbacks
static size_t drainPending(bool isBlocking, uint32_t timeoutMs, size_t maxEvents) {
    if (!pendingQueue) return 0;

    size_t processed = 0;
    TickType_t firstWait = isBlocking ? pdMS_TO_TICKS(timeoutMs) : 0;

    do {
        PendingEvent* evPtr = nullptr;
        BaseType_t ok = xQueueReceive(pendingQueue, &evPtr, processed == 0 ? firstWait : 0);
        if (ok != pdTRUE) break;

        // Find callbacks for this event
        auto it = eventCallbacks.find(evPtr->eventName.c_str());
        if (it != eventCallbacks.end()) {
            for (auto& callback : it->second) {
                // Push callback function
                lua_rawgeti(callback.L, LUA_REGISTRYINDEX, callback.functionRef);

                // Push data as argument
                lua_pushlstring(callback.L, evPtr->data.c_str(), evPtr->data.length());

                // Call Lua function
                if (lua_pcall(callback.L, 1, 0, 0) != LUA_OK) {
                    const char* error = lua_tostring(callback.L, -1);
                    LOG_ERROR("LUA_EVENTMSG", "Callback error for '%s': %s", evPtr->eventName.c_str(), error);
                    lua_pop(callback.L, 1);
                }
            }
        }

        // Free the event
        delete evPtr;
        processed++;
    } while (processed < maxEvents);

    return processed;
}

// ═══════════════════════════════════════════════════════
// LUA API FUNCTIONS
// ═══════════════════════════════════════════════════════

// Register event handler: eventmsg.on(eventName, callback)
static int lua_on(lua_State* L) {
    const char* eventName = luaL_checkstring(L, 1);
    luaL_checktype(L, 2, LUA_TFUNCTION);

    // Store function reference
    lua_pushvalue(L, 2);
    int ref = luaL_ref(L, LUA_REGISTRYINDEX);

    // Add to callbacks
    EventCallback callback = {L, ref};
    eventCallbacks[eventName].push_back(callback);

    // Add to registered events set
    registeredEvents.insert(eventName);

    LOG_DEBUG("LUA_EVENTMSG", "Handler registered: %s", eventName);
    return 0;
}

// Send message: eventmsg.send(eventName, data)
static int lua_send(lua_State* L) {
    const char* eventName = luaL_checkstring(L, 1);
    String data = lua_value_to_data(L, 2);

    event_msg_send(eventName, (const uint8_t*)data.c_str(), data.length());

    return 0;
}

// Remove event handler: eventmsg.off(eventName)
static int lua_off(lua_State* L) {
    const char* eventName = luaL_checkstring(L, 1);

    auto it = eventCallbacks.find(eventName);
    if (it != eventCallbacks.end()) {
        // Unref all callbacks
        for (auto& callback : it->second) {
            luaL_unref(callback.L, LUA_REGISTRYINDEX, callback.functionRef);
        }
        eventCallbacks.erase(it);

        // Remove from registered events
        registeredEvents.erase(eventName);

        LOG_DEBUG("LUA_EVENTMSG", "Handler removed: %s", eventName);
    }

    return 0;
}

// Process pending events: eventmsg.update([isBlocking, timeoutMs, maxEvents])
static int lua_update(lua_State* L) {
    bool isBlocking = false;
    uint32_t timeoutMs = 0;
    size_t maxEvents = 8;

    if (lua_gettop(L) >= 1) {
        isBlocking = lua_toboolean(L, 1);
    }
    if (lua_gettop(L) >= 2) {
        timeoutMs = (uint32_t)lua_tonumber(L, 2);
    }
    if (lua_gettop(L) >= 3) {
        maxEvents = (size_t)lua_tonumber(L, 3);
    }

    size_t processed = drainPending(isBlocking, timeoutMs, maxEvents);
    lua_pushinteger(L, processed);
    return 1;
}

// ═══════════════════════════════════════════════════════
// MODULE REGISTRATION
// ═══════════════════════════════════════════════════════

void lua_eventmsg_init() {
    // Create pending events queue
    if (!pendingQueue) {
        pendingQueue = xQueueCreate(16, sizeof(PendingEvent*));
    }

    // Register as unhandled event handler to catch all events
    event_msg_on_unhandled(handleIncomingEvent);

    LOG_DEBUG("LUA_EVENTMSG", "Module initialized");
}

void lua_eventmsg_register(lua_State* L) {
    mainLuaState = L;

    // Create eventmsg table
    lua_newtable(L);

    // Register functions
    lua_pushcfunction(L, lua_on);
    lua_setfield(L, -2, "on");

    lua_pushcfunction(L, lua_send);
    lua_setfield(L, -2, "send");

    lua_pushcfunction(L, lua_off);
    lua_setfield(L, -2, "off");

    lua_pushcfunction(L, lua_update);
    lua_setfield(L, -2, "update");

    // Set as global
    lua_setglobal(L, "eventmsg");

    LOG_DEBUG("LUA_EVENTMSG", "Module registered");
}

void lua_eventmsg_cleanup() {
    // Unregister all event handlers
    for (auto& pair : eventCallbacks) {
        for (auto& callback : pair.second) {
            luaL_unref(callback.L, LUA_REGISTRYINDEX, callback.functionRef);
        }
    }
    eventCallbacks.clear();
    registeredEvents.clear();

    // Drain and delete pending events
    if (pendingQueue) {
        PendingEvent* evPtr;
        while (xQueueReceive(pendingQueue, &evPtr, 0) == pdTRUE) {
            delete evPtr;
        }
    }

    LOG_DEBUG("LUA_EVENTMSG", "Module cleaned up");
}
