# LuaSys Library - CMake Configuration for ESP-IDF
# Compatible with ESP32, ESP32-S2, ESP32-S3, ESP32-C3

idf_component_register(
    SRCS
        "src/luat_msgbus_freertos.c"
        "src/luat_timer_freertos.c"
        "src/luat_lib_rtos.c"

    INCLUDE_DIRS
        "include"

    REQUIRES
        freertos
        lua
)

# Optional: Copy Lua files to build directory
set(LUA_SYS_FILES
    ${CMAKE_CURRENT_SOURCE_DIR}/lua/sys.lua
)

# Install Lua files to appropriate location (if using SPIFFS/LittleFS)
# Uncomment and adjust if needed:
# add_custom_target(copy_lua_sys ALL
#     COMMAND ${CMAKE_COMMAND} -E copy_directory
#     ${CMAKE_CURRENT_SOURCE_DIR}/lua
#     ${CMAKE_BINARY_DIR}/lua_modules
# )
