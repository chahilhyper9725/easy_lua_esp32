--- LuatOS System Module - Coroutine Scheduler
-- Provides event loop, timers, and task management
-- @module sys
-- @version 1.0.0

local sys = {}

-- Cache frequently used functions
local coroutine = coroutine
local table = table
local unpack = table.unpack
local rtos = rtos or require("rtos")

-- Timer ID ranges
local TASK_TIMER_ID_MAX = 0x1FFFFF
local MSG_TIMER_ID_MAX = 0x7FFFFF

-- Internal state
local taskTimerId = 0       -- Task timer ID counter
local msgId = TASK_TIMER_ID_MAX  -- Message timer ID counter
local timerPool = {}        -- Active timers
local para = {}             -- Timer parameters
local subscribers = {}      -- Message subscribers
local messageQueue = {}     -- Internal message queue

print("=== LuaSys Module Loading ===")

------------------------------------------ Coroutine Error Handling ------------------------------------------

--- Coroutine resume wrapper with error handling
local function wrapper(co, ...)
    local arg = {...}
    if not arg[1] then
        local traceBack = debug.traceback(co)
        traceBack = (traceBack and traceBack ~= "") and (arg[2] .. "\r\n" .. traceBack) or arg[2]
        print("ERROR: " .. traceBack)
        -- Could add restart logic here
    end
    return ...
end

sys.coresume = function(...)
    local arg = {...}
    return wrapper(arg[1], coroutine.resume(...))
end

--- Check if we're in a coroutine (not main thread)
function sys.check_task()
    local co, ismain = coroutine.running()
    if ismain then
        error(debug.traceback("attempt to yield from outside a coroutine"))
    end
    return co
end

------------------------------------------ Task Management ------------------------------------------

--- Task delay function (only use in task coroutines)
-- @param ms Delay time in milliseconds
-- @return nil on timeout, or values passed by sys.publish if woken early
function sys.wait(ms)
    local co = sys.check_task()

    -- Allocate timer ID
    while true do
        if taskTimerId >= TASK_TIMER_ID_MAX - 1 then
            taskTimerId = 0
        else
            taskTimerId = taskTimerId + 1
        end
        if timerPool[taskTimerId] == nil then
            break
        end
    end

    local timerid = taskTimerId
    timerPool[timerid] = co

    -- Start OS timer
    if 1 ~= rtos.timer_start(timerid, ms) then
        print("ERROR: rtos.timer_start failed")
        return
    end

    -- Yield this coroutine
    local message = {coroutine.yield()}

    -- If woken by message, stop timer
    if #message ~= 0 then
        rtos.timer_stop(timerid)
        timerPool[timerid] = nil
        return unpack(message)
    end
end

--- Wait for a specific message with optional timeout
-- @param id Message ID to wait for
-- @param ms Timeout in milliseconds (optional)
-- @return success (true if got message, false if timeout), message data
function sys.waitUntil(id, ms)
    local co = sys.check_task()
    sys.subscribe(id, co)
    local message = ms and {sys.wait(ms)} or {coroutine.yield()}
    sys.unsubscribe(id, co)
    return message[1] ~= nil, unpack(message, 2, #message)
end

--- Create and start a task coroutine
-- @param fun Task function
-- @param ... Arguments to pass to task function
-- @return coroutine handle
function sys.taskInit(fun, ...)
    local co = coroutine.create(fun)
    sys.coresume(co, ...)
    return co
end

------------------------------------------ Timer Management ------------------------------------------

--- Compare two tables (shallow comparison)
local function cmpTable(t1, t2)
    if not t2 then return #t1 == 0 end
    if #t1 == #t2 then
        for i = 1, #t1 do
            if unpack(t1, i, i) ~= unpack(t2, i, i) then
                return false
            end
        end
        return true
    end
    return false
end

--- Stop a timer
-- @param val Timer ID (number) or callback function
-- @param ... Parameters (if val is a function)
function sys.timerStop(val, ...)
    if type(val) == 'number' then
        -- Stop by timer ID
        timerPool[val], para[val] = nil, nil
        rtos.timer_stop(val)
    else
        -- Stop by callback function
        for k, v in pairs(timerPool) do
            if v == val then
                if cmpTable({...}, para[k]) then
                    rtos.timer_stop(k)
                    timerPool[k], para[k] = nil, nil
                    break
                end
            end
        end
    end
end

--- Stop all timers with same callback
-- @param fnc Callback function
function sys.timerStopAll(fnc)
    for k, v in pairs(timerPool) do
        if v == fnc then
            rtos.timer_stop(k)
            timerPool[k], para[k] = nil, nil
        end
    end
end

--- Start a timer (internal, advanced version)
-- @param fnc Callback function
-- @param ms Timeout in milliseconds
-- @param _repeat Repeat count (0=once, -1=infinite)
-- @param ... Arguments to callback
-- @return Timer ID or nil on failure
function sys.timerAdvStart(fnc, ms, _repeat, ...)
    local arg = {...}

    -- Stop any existing identical timer
    if #arg == 0 then
        sys.timerStop(fnc)
    else
        sys.timerStop(fnc, ...)
    end

    -- Allocate timer ID
    while true do
        if msgId >= MSG_TIMER_ID_MAX then
            msgId = TASK_TIMER_ID_MAX
        end
        msgId = msgId + 1
        if timerPool[msgId] == nil then
            timerPool[msgId] = fnc
            break
        end
    end

    -- Start timer
    if rtos.timer_start(msgId, ms, _repeat) ~= 1 then
        return nil
    end

    -- Store parameters if any
    if #arg ~= 0 then
        para[msgId] = arg
    end

    return msgId
end

--- Start a one-shot timer
-- @param fnc Callback function
-- @param ms Timeout in milliseconds
-- @param ... Arguments to callback
-- @return Timer ID or nil on failure
function sys.timerStart(fnc, ms, ...)
    return sys.timerAdvStart(fnc, ms, 0, ...)
end

--- Start a repeating timer
-- @param fnc Callback function
-- @param ms Period in milliseconds
-- @param ... Arguments to callback
-- @return Timer ID or nil on failure
function sys.timerLoopStart(fnc, ms, ...)
    return sys.timerAdvStart(fnc, ms, -1, ...)
end

--- Check if timer is active
-- @param val Timer ID (number) or callback function
-- @param ... Parameters (if val is a function)
-- @return true if active, nil otherwise
function sys.timerIsActive(val, ...)
    if type(val) == "number" then
        return timerPool[val] ~= nil
    else
        for k, v in pairs(timerPool) do
            if v == val then
                if cmpTable({...}, para[k]) then
                    return true
                end
            end
        end
    end
end

------------------------------------------ Publish/Subscribe ------------------------------------------

--- Subscribe to a message
-- @param id Message ID
-- @param callback Callback function or coroutine
function sys.subscribe(id, callback)
    if type(id) == "table" then
        -- Subscribe to multiple messages
        for _, v in pairs(id) do
            sys.subscribe(v, callback)
        end
        return
    end
    if not subscribers[id] then
        subscribers[id] = {}
    end
    subscribers[id][callback] = true
end

--- Unsubscribe from a message
-- @param id Message ID
-- @param callback Callback function or coroutine
function sys.unsubscribe(id, callback)
    if type(id) == "table" then
        -- Unsubscribe from multiple messages
        for _, v in pairs(id) do
            sys.unsubscribe(v, callback)
        end
        return
    end
    if subscribers[id] then
        subscribers[id][callback] = nil
    end
end

--- Publish a message (internal queue)
-- @param ... Message ID and parameters
function sys.publish(...)
    table.insert(messageQueue, {...})
end

--- Dispatch internal messages to subscribers
local function dispatch()
    while #messageQueue > 0 do
        local message = table.remove(messageQueue, 1)
        if subscribers[message[1]] then
            local tmpt = {}
            for callback, _ in pairs(subscribers[message[1]]) do
                table.insert(tmpt, callback)
            end
            for _, callback in ipairs(tmpt) do
                if type(callback) == "function" then
                    callback(unpack(message, 2, #message))
                elseif type(callback) == "thread" then
                    sys.coresume(callback, unpack(message))
                end
            end
        end
    end
end

------------------------------------------ Main Event Loop ------------------------------------------

--- Process one iteration of event loop (safe wrapper)
function sys.safeRun()
    -- Dispatch internal Lua messages
    dispatch()

    -- Block waiting for RTOS messages (timers, etc.)
    local msg, param, exparam = rtos.receive(rtos.INF_TIMEOUT)

    -- Handle timer messages
    if msg == rtos.MSG_TIMER and timerPool[param] then
        if param < TASK_TIMER_ID_MAX then
            -- Task timer - resume coroutine
            local taskId = timerPool[param]
            timerPool[param] = nil
            sys.coresume(taskId)
        else
            -- Callback timer - call function
            local cb = timerPool[param]
            if exparam == 0 then
                timerPool[param] = nil
            end
            if para[param] ~= nil then
                cb(unpack(para[param]))
                if exparam == 0 then
                    para[param] = nil
                end
            else
                cb()
            end
        end
    end
end

--- Main event loop - run forever
-- Call this as the last line of your main script
function sys.run()
    print("=== sys.run() starting event loop ===")
    while true do
        sys.safeRun()
    end
end

-- Make sys global
_G.sys = sys

return sys
