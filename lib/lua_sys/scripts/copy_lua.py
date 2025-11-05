#!/usr/bin/env python3
"""
PlatformIO pre-script to copy Lua files to data directory
This ensures sys.lua is available for SPIFFS upload
"""

Import("env")
import shutil
import os

# Get project directories
project_dir = env.get("PROJECT_DIR")
data_dir = os.path.join(project_dir, "data")
lua_dir = os.path.join(project_dir, "lua")

# Create data directory if it doesn't exist
if not os.path.exists(data_dir):
    os.makedirs(data_dir)
    print(f"Created data directory: {data_dir}")

# Copy sys.lua if it exists
sys_lua_src = os.path.join(lua_dir, "sys.lua")
sys_lua_dst = os.path.join(data_dir, "sys.lua")

if os.path.exists(sys_lua_src):
    shutil.copy2(sys_lua_src, sys_lua_dst)
    print(f"Copied sys.lua to data folder")
else:
    print(f"WARNING: sys.lua not found at {sys_lua_src}")

print("Pre-build script completed")
